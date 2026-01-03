import React, {createContext, useContext, useEffect, useState} from 'react';
import messaging, {FirebaseMessagingTypes} from '@react-native-firebase/messaging';
import PushNotification from 'react-native-push-notification';
import {Notification} from '@types/index';
import {showToast} from '@utils/toast';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  requestPermission: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    initializeNotifications();
    setupMessageHandlers();
    configurePushNotifications();
  }, []);

  useEffect(() => {
    const count = notifications.filter(n => !n.isRead).length;
    setUnreadCount(count);
  }, [notifications]);

  const initializeNotifications = async () => {
    try {
      // Request permission on app start
      await requestPermission();
      
      // Get FCM token
      const token = await getToken();
      if (token) {
        console.log('FCM Token:', token);
        // Send token to your backend to associate with user
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  };

  const configurePushNotifications = () => {
    PushNotification.configure({
      onRegister: function (token) {
        console.log('Push notification token:', token);
      },

      onNotification: function (notification) {
        console.log('Local notification received:', notification);
        
        if (notification.userInteraction) {
          // User tapped on notification
          handleNotificationTap(notification);
        }
      },

      onRegistrationError: function (err) {
        console.error('Push notification registration error:', err);
      },

      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      popInitialNotification: true,
      requestPermissions: true,
    });

    PushNotification.createChannel(
      {
        channelId: 'syncquote-default',
        channelName: 'SyncQuote Notifications',
        channelDescription: 'Default notifications for SyncQuote',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Channel created: ${created}`)
    );
  };

  const setupMessageHandlers = () => {
    // Handle messages when app is in foreground
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('Foreground message received:', remoteMessage);
      
      // Add to notifications list
      if (remoteMessage.data) {
        addNotification(createNotificationFromMessage(remoteMessage));
      }

      // Show local notification
      showLocalNotification(remoteMessage);
    });

    // Handle messages when app is in background/quit
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Background notification opened:', remoteMessage);
      if (remoteMessage.data) {
        handleNotificationTap(remoteMessage.data);
      }
    });

    // Check if app was opened from a notification when it was quit
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from quit state notification:', remoteMessage);
        if (remoteMessage.data) {
          handleNotificationTap(remoteMessage.data);
        }
      }
    });

    return unsubscribeForeground;
  };

  const createNotificationFromMessage = (message: FirebaseMessagingTypes.RemoteMessage): Notification => {
    return {
      id: message.messageId || `notif_${Date.now()}`,
      type: (message.data?.type as any) || 'system',
      title: message.notification?.title || 'SyncQuote',
      message: message.notification?.body || '',
      isRead: false,
      createdAt: new Date().toISOString(),
      data: message.data,
    };
  };

  const showLocalNotification = (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    PushNotification.localNotification({
      channelId: 'syncquote-default',
      title: remoteMessage.notification?.title || 'SyncQuote',
      message: remoteMessage.notification?.body || '',
      data: remoteMessage.data,
      importance: 'high',
      priority: 'high',
      vibrate: true,
      playSound: true,
    });
  };

  const handleNotificationTap = (data: any) => {
    console.log('Handling notification tap:', data);
    
    // Navigate based on notification type
    switch (data.type) {
      case 'proposal_viewed':
        // Navigate to proposal detail
        break;
      case 'proposal_signed':
        // Navigate to proposal detail
        break;
      case 'proposal_rejected':
        // Navigate to proposal detail
        break;
      case 'reminder':
        // Navigate to reminders/tasks
        break;
      default:
        // Navigate to notifications screen
        break;
    }
  };

  const addNotification = (notification: Notification) => {
    setNotifications(prev => [notification, ...prev]);
  };

  const requestPermission = async (): Promise<boolean> => {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted');
        return true;
      } else {
        console.log('Notification permission denied');
        showToast('warning', 'Notifications Disabled', 'Enable notifications to stay updated');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };

  const getToken = async (): Promise<string | null> => {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? {...notification, isRead: true}
          : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({...notification, isRead: true}))
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const contextValue: NotificationContextType = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    requestPermission,
    getToken,
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};