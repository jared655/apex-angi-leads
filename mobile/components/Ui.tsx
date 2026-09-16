import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

export function TitleBlock({
  kicker,
  title,
  meta,
}: {
  kicker: string;
  title: string;
  meta?: string;
}) {
  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        <Text style={styles.kicker}>{kicker}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function Button({
  label,
  tone = "primary",
  disabled,
  ...props
}: PressableProps & { label: string; tone?: "primary" | "ghost" | "danger" | "success" | "warn" }) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        tone === "primary" && styles.btnPrimary,
        tone === "ghost" && styles.btnGhost,
        tone === "danger" && styles.btnDanger,
        tone === "success" && styles.btnSuccess,
        tone === "warn" && styles.btnWarn,
        (pressed || disabled) && { opacity: 0.7 },
        props.style as StyleProp<ViewStyle>,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          (tone === "ghost" || tone === "warn") && { color: colors.navy },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Badge({ label, tone = "info" }: { label: string; tone?: "info" | "success" | "danger" | "warn" | "brass" }) {
  const map = {
    info: [styles.badgeInfo, { color: colors.info }],
    success: [styles.badgeSuccess, { color: colors.success }],
    danger: [styles.badgeDanger, { color: colors.danger }],
    warn: [styles.badgeWarn, { color: colors.warn }],
    brass: [styles.badgeBrass, { color: colors.brassDark }],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, bg as object]}>
      <Text style={[styles.badgeText, fg as object]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleBlock: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingBottom: 12,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: colors.brassDark,
    fontWeight: "700",
  },
  meta: {
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 26,
    color: colors.navy,
    fontWeight: "700",
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnPrimary: { backgroundColor: colors.navy },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnSuccess: { backgroundColor: colors.success },
  btnWarn: { backgroundColor: colors.warnBg, borderWidth: 1, borderColor: "#E8C3A8" },
  btnText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  badgeInfo: { backgroundColor: colors.infoBg },
  badgeSuccess: { backgroundColor: colors.successBg },
  badgeDanger: { backgroundColor: colors.dangerBg },
  badgeWarn: { backgroundColor: colors.warnBg },
  badgeBrass: { backgroundColor: "#F3E6C8" },
});
