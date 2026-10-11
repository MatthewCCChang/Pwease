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
  extra: {
    "eas": {
      "projectId": "e24a417a-bfbd-4517-bf09-2dd64b8eea29"
    }
  },
  "owner": "heyheythere",
};

export default config;
