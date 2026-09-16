import { Pressable, StyleSheet, Text, View } from "react-native";
import { Badge } from "@/components/Ui";
import { timeAgo } from "@/lib/format";
import { colors } from "@/lib/theme";
import type { Lead } from "@/lib/types";

export function LeadCard({ lead, onPress, extra }: { lead: Lead; onPress: () => void; extra?: string }) {
  const location = [lead.city, lead.state].filter(Boolean).join(", ");
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.top}>
        <Text style={styles.name}>{lead.customerName}</Text>
        <Text style={styles.ago}>{timeAgo(lead.createdAt)}</Text>
      </View>
      <Text style={styles.service}>{lead.service || "Service not specified"}</Text>
      {location ? <Text style={styles.loc}>{location}</Text> : null}
      <View style={styles.flags}>
        {lead.stage === "unclaimed" ? <Badge label="Unclaimed" tone="brass" /> : null}
        {lead.stage === "claimed" && lead.needsFollowUp ? <Badge label="Follow up" tone="warn" /> : null}
        {lead.stage === "claimed" && !lead.needsFollowUp ? <Badge label="Active" tone="info" /> : null}
        {lead.stage === "sold" ? <Badge label="Sold" tone="success" /> : null}
        {lead.stage === "lost" ? <Badge label="Lost" tone="danger" /> : null}
        {extra ? <Text style={styles.extra}>{extra}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: colors.navy },
  ago: { color: colors.muted, fontSize: 12, marginTop: 3 },
  service: { marginTop: 4, color: colors.ink, fontSize: 14 },
  loc: { marginTop: 2, color: colors.muted, fontSize: 13 },
  flags: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
  extra: { color: colors.muted, fontSize: 12 },
});
