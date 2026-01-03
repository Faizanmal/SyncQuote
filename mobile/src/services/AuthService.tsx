import React, {createContext, useContext, useEffect, useState, useCallback} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Keychain from 'react-native-keychain';
import ReactNativeBiometrics from 'react-native-biometrics';
import {AuthState, User, LoginForm} from '@types/index';
import {apiService} from './ApiService';
import {showToast} from '@utils/toast';

interface AuthContextType extends AuthState {
  login: (credentials: LoginForm) => Promise<boolean>;
  logout: () => Promise<void>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const biometrics = new ReactNativeBiometrics();

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    biometricEnabled: false,
  });

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check for stored credentials
      const token = await AsyncStorage.getItem('auth_token');
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      const userJson = await AsyncStorage.getItem('user_data');
      const biometricEnabled = await AsyncStorage.getItem('biometric_enabled') === 'true';

      if (token && userJson) {
        const user = JSON.parse(userJson);
        setAuthState(prev => ({
          ...prev,
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          biometricEnabled,
          isLoading: false,
        }));

        // Verify token is still valid
        await refreshAuth();
      } else {
        setAuthState(prev => ({...prev, isLoading: false}));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      setAuthState(prev => ({...prev, isLoading: false}));
    }
  };

  const login = useCallback(async (credentials: LoginForm): Promise<boolean> => {
    try {
      setAuthState(prev => ({...prev, isLoading: true}));

      const response = await apiService.post('/auth/login', credentials);
      
      if (response.success) {
        const {user, token, refreshToken} = response.data;

        // Store credentials
        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('refresh_token', refreshToken);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));

        // Store in keychain if remember me is enabled
        if (credentials.rememberMe) {
          await Keychain.setCredentials('syncquote', credentials.email, credentials.password);
        }

        setAuthState(prev => ({
          ...prev,
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        }));

        showToast('success', 'Welcome back!', `Hello ${user.firstName}`);
        return true;
      } else {
        showToast('error', 'Login Failed', response.message || 'Invalid credentials');
        setAuthState(prev => ({...prev, isLoading: false}));
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('error', 'Login Failed', 'Network error. Please try again.');
      setAuthState(prev => ({...prev, isLoading: false}));
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Call logout API
      await apiService.post('/auth/logout');
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear local storage regardless of API success
      await AsyncStorage.multiRemove([
        'auth_token',
        'refresh_token',
        'user_data',
        'biometric_enabled'
      ]);
      
      // Clear keychain
      await Keychain.resetCredentials('syncquote');

      setAuthState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        biometricEnabled: false,
      });

      showToast('info', 'Logged Out', 'See you next time!');
    }
  }, []);

  const enableBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const {available, biometryType} = await biometrics.isSensorAvailable();
      
      if (!available) {
        showToast('error', 'Biometric Not Available', 'This device does not support biometric authentication');
        return false;
      }

      // Create biometric key
      const {success, error} = await biometrics.createKeys();
      
      if (success) {
        await AsyncStorage.setItem('biometric_enabled', 'true');
        setAuthState(prev => ({...prev, biometricEnabled: true}));
        
        showToast('success', 'Biometric Enabled', `${biometryType} authentication is now active`);
        return true;
      } else {
        console.error('Biometric setup error:', error);
        showToast('error', 'Setup Failed', 'Failed to enable biometric authentication');
        return false;
      }
    } catch (error) {
      console.error('Biometric enable error:', error);
      showToast('error', 'Setup Failed', 'An error occurred while setting up biometric authentication');
      return false;
    }
  }, []);

  const disableBiometric = useCallback(async (): Promise<void> => {
    try {
      await biometrics.deleteKeys();
      await AsyncStorage.setItem('biometric_enabled', 'false');
      setAuthState(prev => ({...prev, biometricEnabled: false}));
      
      showToast('info', 'Biometric Disabled', 'Biometric authentication has been turned off');
    } catch (error) {
      console.error('Biometric disable error:', error);
      showToast('error', 'Failed to Disable', 'An error occurred while disabling biometric authentication');
    }
  }, []);

  const authenticateWithBiometric = useCallback(async (): Promise<boolean> => {
    try {
      const {success, error} = await biometrics.simplePrompt({
        promptMessage: 'Authenticate to access SyncQuote',
        fallbackPromptMessage: 'Please use your passcode',
      });

      if (success) {
        // Biometric authentication successful, refresh auth state
        await refreshAuth();
        return true;
      } else {
        console.error('Biometric auth error:', error);
        return false;
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      const refreshToken = await AsyncStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiService.post('/auth/refresh', {refreshToken});
      
      if (response.success) {
        const {token, user} = response.data;
        
        await AsyncStorage.setItem('auth_token', token);
        await AsyncStorage.setItem('user_data', JSON.stringify(user));
        
        setAuthState(prev => ({
          ...prev,
          user,
          token,
          isAuthenticated: true,
        }));
      } else {
        // Refresh failed, logout user
        await logout();
      }
    } catch (error) {
      console.error('Auth refresh error:', error);
      // If refresh fails, logout user
      await logout();
    }
  }, [logout]);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    enableBiometric,
    disableBiometric,
    authenticateWithBiometric,
    refreshAuth,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};