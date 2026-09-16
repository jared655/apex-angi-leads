import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Badge, Button } from "@/components/Ui";
import { useAuth } from "@/context/AuthContext";
import { useLeads } from "@/context/LeadsContext";
import { ApiError } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { colors } from "@/lib/theme";
import type { Lead } from "@/lib/types";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getLead, loadLead, claim, followUp, sold, lost, addNote } = useLeads();
  const [lead, setLead] = useState<Lead | undefined>(id ? getLead(id) : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionNote, setActionNote] = useState("");

  useEffect(() => {
    if (!id) return;
    void loadLead(id)
      .then(setLead)
      .catch((err) => setError(err instanceof Error ? err.message : "Lead not found"));
  }, [id, loadLead]);

  async function run(fn: () => Promise<Lead>) {
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      setLead(next);
      setActionNote("");
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
      if (id) {
        try {
          setLead(await loadLead(id));
        } catch {
          // keep current
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (!lead) {
    return (
      <View style={styles.center}>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.navy} />}
      </View>
    );
  }

  const mine = lead.claimedBy === user?.id;
  const location = lead.fullAddress || [lead.city, lead.state, lead.zip].filter(Boolean).join(", ");

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>{lead.service || "Angi lead"}</Text>
        <Text style={styles.name}>{lead.customerName}</Text>
        <View style={styles.badges}>
          {lead.stage === "unclaimed" ? <Badge label="Unclaimed" tone="brass" /> : null}
          {lead.stage === "claimed" ? <Badge label={lead.needsFollowUp ? "Follow up" : "Active"} tone={lead.needsFollowUp ? "warn" : "info"} /> : null}
          {lead.stage === "sold" ? <Badge label="Sold" tone="success" /> : null}
          {lead.stage === "lost" ? <Badge label="Lost" tone="danger" /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Row label="Phone" value={lead.phone} onPress={lead.phone ? () => Linking.openURL(`tel:${lead.phone}`) : undefined} />
        <Row label="Email" value={lead.email} onPress={lead.email ? () => Linking.openURL(`mailto:${lead.email}`) : undefined} />
        <Row label="Address" value={location} />
        <Row label="Angi ID" value={lead.externalId} />
        <Row label="Angi URL" value={lead.angiUrl} onPress={lead.angiUrl ? () => Linking.openURL(lead.angiUrl!) : undefined} />
        <Row label="Received" value={formatWhen(lead.createdAt)} />
        <Row label="Claimed" value={lead.claimedByName ? `${lead.claimedByName} · ${formatWhen(lead.claimedAt)}` : "—"} />
        <Row label="Source" value={lead.source} />
      </View>

      {lead.description ? (
        <View style={styles.card}>
          <Text style={styles.section}>Job / message</Text>
          <Text style={styles.body}>{lead.description}</Text>
        </View>
      ) : null}

      {lead.interview?.length ? (
        <View style={styles.card}>
          <Text style={styles.section}>Interview</Text>
          {lead.interview.map((item, index) => (
            <View key={`${item.question}-${index}`} style={{ marginBottom: 10 }}>
              <Text style={styles.q}>{item.question}</Text>
              <Text style={styles.body}>{item.answer}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {lead.stage === "unclaimed" ? (
        <Button
          label={busy ? "Claiming…" : "Claim this lead"}
          onPress={() => run(() => claim(lead.id))}
          disabled={busy}
        />
      ) : null}

      {mine && lead.stage === "claimed" ? (
        <View style={styles.actions}>
          <TextInput
            value={actionNote}
            onChangeText={setActionNote}
            placeholder="Optional note for follow-up / sold / lost"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Button label="Follow up" tone="warn" disabled={busy} onPress={() => run(() => followUp(lead.id, actionNote || undefined))} />
          <View style={styles.row}>
            <Button label="Sold" tone="success" disabled={busy} onPress={() => run(() => sold(lead.id, actionNote || undefined))} style={{ flex: 1 }} />
            <Button label="Lost job" tone="danger" disabled={busy} onPress={() => run(() => lost(lead.id, actionNote || undefined))} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {lead.stage !== "unclaimed" && !mine ? (
        <Text style={styles.lock}>
          Claimed by {lead.claimedByName || "the other user"}. Client details stay on their pipeline.
        </Text>
      ) : null}

      {mine ? (
        <View style={styles.card}>
          <Text style={styles.section}>Add note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
            multiline
            placeholder="Call log, site visit, quote sent…"
            placeholderTextColor={colors.muted}
          />
          <Button
            label="Save note"
            tone="ghost"
            disabled={busy || !note.trim()}
            onPress={() => run(() => addNote(lead.id, note.trim()))}
            style={{ marginTop: 10 }}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.section}>Activity</Text>
        {lead.events.length === 0 ? <Text style={styles.body}>No activity yet.</Text> : null}
        {lead.events.map((event) => (
          <View key={event.id} style={styles.event}>
            <Text style={styles.eventType}>{event.type.replace("_", " ")}</Text>
            <Text style={styles.eventMeta}>
              {event.userName || "System"} · {formatWhen(event.createdAt)}
            </Text>
            {event.note ? <Text style={styles.body}>{event.note}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ label, value, onPress }: { label: string; value: string | null | undefined; onPress?: () => void }) {
  if (!value) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.rowItem}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, onPress && styles.link]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  header: { marginBottom: 16 },
  kicker: { color: colors.brassDark, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "700", fontSize: 11 },
  name: { fontSize: 28, fontWeight: "700", color: colors.navy, marginTop: 4 },
  badges: { flexDirection: "row", gap: 8, marginTop: 10 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  section: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.brassDark,
    fontWeight: "700",
    marginBottom: 8,
  },
  body: { color: colors.ink, lineHeight: 21, fontSize: 15 },
  q: { color: colors.muted, fontSize: 12, marginBottom: 2, fontWeight: "700" },
  actions: { gap: 10, marginBottom: 12 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    color: colors.ink,
  },
  error: { color: colors.danger, marginBottom: 10 },
  lock: { color: colors.muted, marginBottom: 14, lineHeight: 20 },
  rowItem: { marginBottom: 10 },
  rowLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  rowValue: { fontSize: 16, color: colors.navy, marginTop: 2 },
  link: { textDecorationLine: "underline" },
  event: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.paperDark },
  eventType: { fontWeight: "700", color: colors.navy, textTransform: "capitalize" },
  eventMeta: { color: colors.muted, fontSize: 12, marginBottom: 4 },
});
