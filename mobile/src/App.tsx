import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {Provider} from 'react-redux';
import {PersistGate} from 'redux-persist/integration/react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {store, persistor} from '@store/index';
import AppNavigator from '@navigation/AppNavigator';
import LoadingScreen from '@screens/LoadingScreen';
import {NotificationProvider} from '@services/NotificationService';
import {OfflineProvider} from '@services/OfflineService';
import {AuthProvider} from '@services/AuthService';

const App: React.FC = () => {
  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PersistGate loading={<LoadingScreen />} persistor={persistor}>
            <AuthProvider>
              <OfflineProvider>
                <NotificationProvider>
                  <NavigationContainer>
                    <AppNavigator />
                  </NavigationContainer>
                  <Toast />
                </NotificationProvider>
              </OfflineProvider>
            </AuthProvider>
          </PersistGate>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

export default App;