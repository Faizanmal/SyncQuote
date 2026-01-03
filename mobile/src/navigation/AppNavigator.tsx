import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createDrawerNavigator} from '@react-navigation/drawer';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Auth Screens
import LoginScreen from '@screens/auth/LoginScreen';
import RegisterScreen from '@screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';
import BiometricSetupScreen from '@screens/auth/BiometricSetupScreen';

// Main Screens
import DashboardScreen from '@screens/main/DashboardScreen';
import ProposalsScreen from '@screens/main/ProposalsScreen';
import ClientsScreen from '@screens/main/ClientsScreen';
import AnalyticsScreen from '@screens/main/AnalyticsScreen';
import MoreScreen from '@screens/main/MoreScreen';

// Detail Screens
import ProposalDetailScreen from '@screens/detail/ProposalDetailScreen';
import ClientDetailScreen from '@screens/detail/ClientDetailScreen';
import CreateProposalScreen from '@screens/forms/CreateProposalScreen';
import EditProposalScreen from '@screens/forms/EditProposalScreen';
import SignatureCaptureScreen from '@screens/signature/SignatureCaptureScreen';
import DocumentViewerScreen from '@screens/document/DocumentViewerScreen';

// Settings & Profile
import SettingsScreen from '@screens/settings/SettingsScreen';
import ProfileScreen from '@screens/profile/ProfileScreen';
import NotificationsScreen from '@screens/notifications/NotificationsScreen';

import {RootStackParamList, AuthStackParamList, MainTabParamList} from '@types/index';
import {useAuth} from '@services/AuthService';
import LoadingScreen from '@screens/LoadingScreen';

const RootStack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator();

// Auth Navigator
const AuthNavigator = () => {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: '#fff'},
      }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="BiometricSetup" component={BiometricSetupScreen} />
    </AuthStack.Navigator>
  );
};

// Main Tab Navigator
const MainTabNavigator = () => {
  return (
    <MainTab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused, color, size}) => {
          let iconName = 'home';

          switch (route.name) {
            case 'Dashboard':
              iconName = 'view-dashboard';
              break;
            case 'Proposals':
              iconName = 'file-document-multiple';
              break;
            case 'Clients':
              iconName = 'account-group';
              break;
            case 'Analytics':
              iconName = 'chart-line';
              break;
            case 'More':
              iconName = 'menu';
              break;
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      })}>
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{title: 'Dashboard'}}
      />
      <MainTab.Screen
        name="Proposals"
        component={ProposalsScreen}
        options={{title: 'Proposals'}}
      />
      <MainTab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{title: 'Clients'}}
      />
      <MainTab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{title: 'Analytics'}}
      />
      <MainTab.Screen
        name="More"
        component={MoreScreen}
        options={{title: 'More'}}
      />
    </MainTab.Navigator>
  );
};

// Main Navigator with Drawer
const MainNavigator = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: true,
        drawerStyle: {
          backgroundColor: '#FFFFFF',
          width: 280,
        },
        drawerActiveTintColor: '#3B82F6',
        drawerInactiveTintColor: '#6B7280',
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          marginLeft: -10,
        },
      }}>
      <Drawer.Screen
        name="Main"
        component={MainTabNavigator}
        options={{
          title: 'SyncQuote',
          drawerIcon: ({color, size}) => (
            <Icon name="view-dashboard" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          drawerIcon: ({color, size}) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          drawerIcon: ({color, size}) => (
            <Icon name="cog" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          drawerIcon: ({color, size}) => (
            <Icon name="bell" size={size} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

// Root App Navigator
const AppNavigator = () => {
  const {isAuthenticated, isLoading} = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: {backgroundColor: '#fff'},
      }}>
      {isAuthenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Screen
            name="ProposalDetail"
            component={ProposalDetailScreen}
            options={{
              headerShown: true,
              title: 'Proposal Details',
              headerBackTitle: 'Back',
            }}
          />
          <RootStack.Screen
            name="ClientDetail"
            component={ClientDetailScreen}
            options={{
              headerShown: true,
              title: 'Client Details',
              headerBackTitle: 'Back',
            }}
          />
          <RootStack.Screen
            name="CreateProposal"
            component={CreateProposalScreen}
            options={{
              headerShown: true,
              title: 'New Proposal',
              headerBackTitle: 'Cancel',
            }}
          />
          <RootStack.Screen
            name="EditProposal"
            component={EditProposalScreen}
            options={{
              headerShown: true,
              title: 'Edit Proposal',
              headerBackTitle: 'Cancel',
            }}
          />
          <RootStack.Screen
            name="SignatureCapture"
            component={SignatureCaptureScreen}
            options={{
              headerShown: true,
              title: 'Signature',
              headerBackTitle: 'Back',
            }}
          />
          <RootStack.Screen
            name="DocumentViewer"
            component={DocumentViewerScreen}
            options={{
              headerShown: true,
              title: 'Document',
              headerBackTitle: 'Back',
            }}
          />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
};

export default AppNavigator;