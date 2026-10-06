import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Pwease',
  slug: 'pwease',
  version: '0.1.0',
  scheme: 'pwease',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  backgroundColor: '#FAF7F1',
  // Development placeholders. Choose permanent unique identifiers before signing builds.
  ios: { supportsTablet: true, bundleIdentifier: 'com.pwease' },
  android: { package: 'com.pwease' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-splash-screen', { backgroundColor: '#FAF7F1' }],
  ],
};

export default config;
