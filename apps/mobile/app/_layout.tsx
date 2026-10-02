import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '../src/providers';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Providers>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(workspace)" />
            <Stack.Screen name="request" options={{ presentation: 'modal', headerShown: true, title: 'Pretty pwease?', headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text }} />
          </Stack>
        </Providers>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
