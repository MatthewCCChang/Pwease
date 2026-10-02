import { router } from 'expo-router';
import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import type { TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function TabButton({ isFocused, children, ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} ref={ref} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={[styles.tab, isFocused && styles.activeTab]}>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

// Custom Expo Router tabs keep the selected I1 top-tab structure without another navigator.
export default function WorkspaceLayout() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Tabs style={styles.root}>
        <TabList style={styles.tabs}>
          <TabTrigger name="home" href="/home" asChild><TabButton>Home</TabButton></TabTrigger>
          <TabTrigger name="approved" href="/approved" asChild><TabButton>Approved</TabButton></TabTrigger>
          <TabTrigger name="completed" href="/completed" asChild><TabButton>Completed</TabButton></TabTrigger>
        </TabList>
        <TabSlot style={styles.slot} />
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.back}>
            <Text style={styles.label}>Back to welcome</Text>
          </Pressable>
        </View>
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  slot: { flex: 1 },
  tabs: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  activeTab: { backgroundColor: '#F8E8DC', borderRadius: 16 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  footer: { padding: spacing.md, paddingBottom: spacing.lg, alignItems: 'center' },
  back: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
});
