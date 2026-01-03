# SyncQuote Mobile

Enterprise proposal management mobile application built with React Native.

## Features

- 📱 **Cross-Platform**: iOS and Android support
- 🔐 **Biometric Authentication**: Fingerprint and Face ID login
- 📴 **Offline Support**: Work offline with automatic sync
- 🔔 **Push Notifications**: Real-time proposal updates
- 📊 **Analytics Dashboard**: Comprehensive business insights
- ✍️ **Digital Signatures**: Capture signatures on mobile
- 📄 **Document Viewer**: View PDFs and documents
- 🎨 **Modern UI**: Clean, professional interface

## Tech Stack

- **Framework**: React Native 0.72.6
- **Navigation**: React Navigation 6
- **State Management**: Redux Toolkit + Redux Persist
- **Forms**: React Hook Form + Yup validation
- **Charts**: React Native Chart Kit
- **Notifications**: Firebase Cloud Messaging
- **Storage**: AsyncStorage + SQLite
- **Authentication**: Biometric authentication
- **Offline**: Background sync capabilities

## Prerequisites

- Node.js >= 16
- React Native CLI
- Android Studio (for Android development)
- Xcode (for iOS development)
- CocoaPods (for iOS dependencies)

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/syncquote-mobile.git
   cd syncquote-mobile
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **iOS Setup**
   ```bash
   cd ios && pod install && cd ..
   ```

4. **Android Setup**
   - Ensure Android SDK is properly configured
   - Update `android/local.properties` with SDK path

## Environment Configuration

Create a `.env` file in the root directory:

```env
API_BASE_URL=https://api.syncquote.com
GOOGLE_SERVICES_API_KEY=your_firebase_key
SENTRY_DSN=your_sentry_dsn
```

## Running the App

### Development

```bash
# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Production Builds

```bash
# Android Release
npm run build:android

# iOS Release
npm run build:ios
```

## Project Structure

```
src/
├── components/          # Reusable UI components
├── screens/            # App screens
│   ├── auth/          # Authentication screens
│   ├── main/          # Main app screens
│   ├── detail/        # Detail screens
│   ├── forms/         # Form screens
│   └── settings/      # Settings screens
├── navigation/         # Navigation configuration
├── services/          # API and other services
├── store/             # Redux store and slices
├── hooks/             # Custom React hooks
├── utils/             # Utility functions
├── types/             # TypeScript type definitions
├── constants/         # App constants
└── assets/            # Images, fonts, etc.
```

## Key Features

### Offline Support
- Automatic background sync when connection is restored
- Queue actions for later synchronization
- SQLite local storage for offline data

### Push Notifications
- Firebase Cloud Messaging integration
- Proposal status updates
- Custom notification channels
- Background notification handling

### Biometric Authentication
- Fingerprint authentication
- Face ID support (iOS)
- Secure credential storage
- Fallback to PIN/password

### Analytics Dashboard
- Real-time proposal metrics
- Revenue tracking
- Conversion rate analysis
- Interactive charts and graphs

### Document Management
- PDF viewer integration
- Document sharing capabilities
- Signature capture
- File upload/download

## Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React Native best practices
- Use functional components with hooks
- Implement proper error boundaries

### State Management
- Use Redux Toolkit for global state
- Local component state for UI-only state
- Redux Persist for data persistence
- Proper action/reducer patterns

### API Integration
- Centralized API service
- Automatic token refresh
- Request/response interceptors
- Error handling and retry logic

### Testing
```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Deployment

### Android
1. Generate signed APK/AAB
2. Upload to Google Play Console
3. Configure release management

### iOS
1. Archive the app in Xcode
2. Upload to App Store Connect
3. Submit for review

## Security

- Secure credential storage with Keychain
- API token management
- Biometric authentication
- Certificate pinning (production)
- Code obfuscation for releases

## Performance

- Image optimization and caching
- Lazy loading for large lists
- Background task management
- Memory leak prevention
- Bundle size optimization

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For technical support or questions:
- Email: mobile@syncquote.com
- Documentation: https://docs.syncquote.com/mobile
- Issues: https://github.com/your-org/syncquote-mobile/issues