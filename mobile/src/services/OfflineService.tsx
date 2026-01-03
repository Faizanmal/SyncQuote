import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import BackgroundSync from 'react-native-background-sync';
import {OfflineState, SyncItem} from '@types/index';
import {apiService} from './ApiService';
import {showToast} from '@utils/toast';

interface OfflineContextType extends OfflineState {
  addToSyncQueue: (item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  removeFromSyncQueue: (id: string) => Promise<void>;
  forcSync: () => Promise<void>;
  clearSyncQueue: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const useOffline = () => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};

const SYNC_QUEUE_KEY = 'sync_queue';
const LAST_SYNC_KEY = 'last_sync';

export const OfflineProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [offlineState, setOfflineState] = useState<OfflineState>({
    isOnline: true,
    syncQueue: [],
    lastSyncAt: null,
    syncInProgress: false,
  });

  useEffect(() => {
    initializeOfflineState();
    setupNetworkListener();
    setupBackgroundSync();
  }, []);

  useEffect(() => {
    // Auto-sync when coming online
    if (offlineState.isOnline && offlineState.syncQueue.length > 0 && !offlineState.syncInProgress) {
      processSync();
    }
  }, [offlineState.isOnline, offlineState.syncQueue.length]);

  const initializeOfflineState = async () => {
    try {
      const syncQueue = await loadSyncQueue();
      const lastSyncAt = await AsyncStorage.getItem(LAST_SYNC_KEY);
      
      setOfflineState(prev => ({
        ...prev,
        syncQueue,
        lastSyncAt,
      }));
    } catch (error) {
      console.error('Failed to initialize offline state:', error);
    }
  };

  const setupNetworkListener = () => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected && state.isInternetReachable === true;
      
      setOfflineState(prev => {
        if (prev.isOnline !== isOnline) {
          if (isOnline) {
            showToast('success', 'Back Online', 'Connection restored. Syncing data...');
          } else {
            showToast('warning', 'Offline Mode', 'You\'re now offline. Changes will sync when reconnected.');
          }
        }
        
        return {...prev, isOnline};
      });
    });

    return unsubscribe;
  };

  const setupBackgroundSync = () => {
    BackgroundSync.start({
      taskName: 'SyncQuoteDataSync',
      taskTitle: 'Syncing data',
      taskDesc: 'Syncing your proposals and data with the server',
      taskIcon: {
        name: 'sync',
        type: 'FontAwesome',
      },
    });

    BackgroundSync.on('background', () => {
      if (offlineState.isOnline && offlineState.syncQueue.length > 0) {
        processSync();
      }
    });
  };

  const loadSyncQueue = async (): Promise<SyncItem[]> => {
    try {
      const queueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('Failed to load sync queue:', error);
      return [];
    }
  };

  const saveSyncQueue = async (queue: SyncItem[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  };

  const addToSyncQueue = useCallback(async (item: Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>) => {
    const syncItem: SyncItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    const newQueue = [...offlineState.syncQueue, syncItem];
    
    setOfflineState(prev => ({...prev, syncQueue: newQueue}));
    await saveSyncQueue(newQueue);

    // Try immediate sync if online
    if (offlineState.isOnline && !offlineState.syncInProgress) {
      processSync();
    }
  }, [offlineState.syncQueue, offlineState.isOnline, offlineState.syncInProgress]);

  const removeFromSyncQueue = useCallback(async (id: string) => {
    const newQueue = offlineState.syncQueue.filter(item => item.id !== id);
    
    setOfflineState(prev => ({...prev, syncQueue: newQueue}));
    await saveSyncQueue(newQueue);
  }, [offlineState.syncQueue]);

  const processSync = async () => {
    if (offlineState.syncInProgress || !offlineState.isOnline || offlineState.syncQueue.length === 0) {
      return;
    }

    setOfflineState(prev => ({...prev, syncInProgress: true}));

    try {
      const failedItems: SyncItem[] = [];
      
      for (const item of offlineState.syncQueue) {
        try {
          await processSyncItem(item);
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          
          // Increment retry count
          const updatedItem = {...item, retryCount: item.retryCount + 1};
          
          // Keep in queue if retry count is less than max
          if (updatedItem.retryCount < 3) {
            failedItems.push(updatedItem);
          } else {
            console.error(`Max retries reached for item ${item.id}, removing from queue`);
          }
        }
      }

      // Update queue with failed items
      setOfflineState(prev => ({...prev, syncQueue: failedItems}));
      await saveSyncQueue(failedItems);

      // Update last sync time
      const lastSyncAt = new Date().toISOString();
      await AsyncStorage.setItem(LAST_SYNC_KEY, lastSyncAt);
      
      setOfflineState(prev => ({
        ...prev,
        lastSyncAt,
        syncInProgress: false,
      }));

      if (failedItems.length === 0) {
        showToast('success', 'Sync Complete', 'All data synchronized successfully');
      } else {
        showToast('warning', 'Partial Sync', `${failedItems.length} items failed to sync`);
      }
    } catch (error) {
      console.error('Sync process error:', error);
      setOfflineState(prev => ({...prev, syncInProgress: false}));
      showToast('error', 'Sync Failed', 'Failed to synchronize data');
    }
  };

  const processSyncItem = async (item: SyncItem): Promise<void> => {
    const {type, entity, data} = item;
    
    switch (entity) {
      case 'proposal':
        await syncProposal(type, data);
        break;
      case 'client':
        await syncClient(type, data);
        break;
      case 'document':
        await syncDocument(type, data);
        break;
      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  };

  const syncProposal = async (type: string, data: any): Promise<void> => {
    switch (type) {
      case 'create':
        await apiService.post('/proposals', data);
        break;
      case 'update':
        await apiService.put(`/proposals/${data.id}`, data);
        break;
      case 'delete':
        await apiService.delete(`/proposals/${data.id}`);
        break;
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
  };

  const syncClient = async (type: string, data: any): Promise<void> => {
    switch (type) {
      case 'create':
        await apiService.post('/clients', data);
        break;
      case 'update':
        await apiService.put(`/clients/${data.id}`, data);
        break;
      case 'delete':
        await apiService.delete(`/clients/${data.id}`);
        break;
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
  };

  const syncDocument = async (type: string, data: any): Promise<void> => {
    switch (type) {
      case 'create':
        await apiService.post('/documents', data);
        break;
      case 'update':
        await apiService.put(`/documents/${data.id}`, data);
        break;
      case 'delete':
        await apiService.delete(`/documents/${data.id}`);
        break;
      default:
        throw new Error(`Unknown sync type: ${type}`);
    }
  };

  const forceSync = useCallback(async () => {
    if (!offlineState.isOnline) {
      showToast('warning', 'Offline', 'Cannot sync while offline');
      return;
    }

    await processSync();
  }, [offlineState.isOnline]);

  const clearSyncQueue = useCallback(async () => {
    setOfflineState(prev => ({...prev, syncQueue: []}));
    await saveSyncQueue([]);
    showToast('info', 'Queue Cleared', 'Sync queue has been cleared');
  }, []);

  const contextValue: OfflineContextType = {
    ...offlineState,
    addToSyncQueue,
    removeFromSyncQueue,
    forcSync: forceSync,
    clearSyncQueue,
  };

  return (
    <OfflineContext.Provider value={contextValue}>
      {children}
    </OfflineContext.Provider>
  );
};