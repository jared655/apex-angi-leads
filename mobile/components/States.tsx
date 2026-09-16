import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Button } from "@/components/Ui";
import { colors } from "@/lib/theme";

export function EmptyState({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action && onAction ? <Button label={action} onPress={onAction} style={{ marginTop: 16, alignSelf: "flex-start" }} /> : null}
    </View>
  );
}

export function LoadingBlock({ label = "Loading leads…" }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.navy} />
      <Text style={[styles.body, { marginTop: 10 }]}>{label}</Text>
    </View>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Couldn’t load</Text>
      <Text style={styles.body}>{message}</Text>
      <Button label="Try again" onPress={onRetry} style={{ marginTop: 16, alignSelf: "flex-start" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 36 },
  title: { fontSize: 18, fontWeight: "700", color: colors.navy, marginBottom: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
