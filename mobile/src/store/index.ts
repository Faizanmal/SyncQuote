import {configureStore} from '@reduxjs/toolkit';
import {persistStore, persistReducer} from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {combineReducers} from '@reduxjs/toolkit';

// Slices
import authSlice from './slices/authSlice';
import proposalsSlice from './slices/proposalsSlice';
import clientsSlice from './slices/clientsSlice';
import offlineSlice from './slices/offlineSlice';
import notificationsSlice from './slices/notificationsSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'offline', 'notifications'], // Only persist these reducers
  blacklist: ['proposals', 'clients'], // Don't persist these (they'll be fetched fresh)
};

const rootReducer = combineReducers({
  auth: authSlice,
  proposals: proposalsSlice,
  clients: clientsSlice,
  offline: offlineSlice,
  notifications: notificationsSlice,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: __DEV__,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;