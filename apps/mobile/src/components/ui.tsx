import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export function Screen({ children, insetTop = true }: PropsWithChildren<{ insetTop?: boolean }>) {
  return (
    <SafeAreaView style={styles.safeArea} edges={insetTop ? ['top', 'left', 'right', 'bottom'] : ['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Button({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress?: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button, secondary && styles.secondary,
        pressed && !secondary && styles.pressed, disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel, disabled && styles.disabledLabel]}>{label}</Text>
    </Pressable>
  );
}

export function Heading({ children }: PropsWithChildren) {
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}

export function Copy({ children }: PropsWithChildren) {
  return <Text style={styles.copy}>{children}</Text>;
}

export function Panel({ children }: PropsWithChildren) {
  return <View style={styles.panel}>{children}</View>;
}

export function Placeholder({ title, detail }: { title: string; detail: string }) {
  return <Panel><Text style={styles.panelTitle}>{title}</Text><Copy>{detail}</Copy></Panel>;
}

export function SkeletonNotice() {
  return <Text style={styles.notice}>Design shell · Features are not implemented</Text>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: spacing.lg },
  heading: { color: colors.text, fontSize: 30, fontWeight: '600' },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm },
  panelTitle: { color: colors.text, fontSize: 19, fontWeight: '600' },
  notice: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  button: { backgroundColor: colors.primary, minHeight: 48, borderRadius: radius.button, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: colors.onPrimary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  secondaryLabel: { color: colors.text },
  pressed: { backgroundColor: colors.primaryPressed },
  disabled: { backgroundColor: colors.disabled, borderColor: colors.disabled },
  disabledLabel: { color: colors.disabledText },
});
