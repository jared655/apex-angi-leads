import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import type { EmailResult, IntakeTemplateId, Lead } from "@/lib/types";
import { INTAKE_TEMPLATE_CHOICES } from "@/lib/types";

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { getLead, loadLead, claim, followUp, sold, lost, addNote } = useLeads();
  const [lead, setLead] = useState<Lead | undefined>(id ? getLead(id) : undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [soldPickerOpen, setSoldPickerOpen] = useState(false);
  const [emailGate, setEmailGate] = useState(false);
  const [emailBanner, setEmailBanner] = useState<string | null>(null);

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

  function describeEmail(email: EmailResult | undefined, template?: IntakeTemplateId): string {
    if (!email) return "Lead marked sold.";
    if (email.status === "sent") return email.detail || "Intake email sent.";
    if (email.status === "failed") return `Lead marked sold. Intake email failed: ${email.detail || "send error"}`;
    if (template) return email.detail || "Lead marked sold. Intake email was skipped.";
    return "Lead marked sold. Intake email skipped.";
  }

  async function completeSold(template?: IntakeTemplateId) {
    if (!lead) return;
    setSoldPickerOpen(false);
    setEmailGate(false);
    setBusy(true);
    setError(null);
    try {
      const result = await sold(lead.id, actionNote || undefined, template);
      setLead(result.lead);
      setActionNote("");
      const message = describeEmail(result.email, template);
      setEmailBanner(message);
      Alert.alert(result.lead.stage === "sold" ? "Sold" : "Updated", message);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Action failed";
      setError(message);
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

  function pickSoldTemplate(template: IntakeTemplateId | "skip") {
    if (template === "skip") {
      void completeSold(undefined);
      return;
    }
    if (!lead?.email?.trim()) {
      setEmailGate(true);
      return;
    }
    void completeSold(template);
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
    <>
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

      {emailBanner ? <Text style={styles.banner}>{emailBanner}</Text> : null}
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
            <Button
              label="Sold"
              tone="success"
              disabled={busy}
              onPress={() => {
                setEmailGate(false);
                setSoldPickerOpen(true);
              }}
              style={{ flex: 1 }}
            />
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
            <Text style={styles.eventType}>{event.type.replaceAll("_", " ")}</Text>
            <Text style={styles.eventMeta}>
              {event.userName || "System"} · {formatWhen(event.createdAt)}
            </Text>
            {event.note ? <Text style={styles.body}>{event.note}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
    <Modal
      visible={soldPickerOpen}
      transparent
      animationType="fade"
      onRequestClose={() => {
        setSoldPickerOpen(false);
        setEmailGate(false);
      }}
    >
      <View style={styles.sheetBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            setSoldPickerOpen(false);
            setEmailGate(false);
          }}
        />
        <View style={styles.sheet}>
          {emailGate ? (
            <>
              <Text style={styles.section}>Customer email required</Text>
              <Text style={styles.sheetBody}>
                This lead has no email on file. Add an email before sending, or skip the intake email to mark sold anyway.
              </Text>
              <Button
                label="Skip email"
                tone="ghost"
                disabled={busy}
                onPress={() => pickSoldTemplate("skip")}
                style={{ marginBottom: 8 }}
              />
              <Button
                label="Cancel"
                tone="warn"
                disabled={busy}
                onPress={() => {
                  setSoldPickerOpen(false);
                  setEmailGate(false);
                }}
              />
            </>
          ) : (
            <>
              <Text style={styles.section}>Post-sale intake email</Text>
              <Text style={styles.sheetBody}>Choose a template to send, or skip and still mark this lead sold.</Text>
              {INTAKE_TEMPLATE_CHOICES.map((choice) => (
                <Button
                  key={choice.id}
                  label={choice.label}
                  disabled={busy}
                  onPress={() => pickSoldTemplate(choice.id)}
                  style={{ marginBottom: 8 }}
                />
              ))}
              <Button
                label="Skip email"
                tone="ghost"
                disabled={busy}
                onPress={() => pickSoldTemplate("skip")}
                style={{ marginBottom: 8 }}
              />
              <Button
                label="Cancel"
                tone="warn"
                disabled={busy}
                onPress={() => {
                  setSoldPickerOpen(false);
                  setEmailGate(false);
                }}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
    </>
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
  banner: {
    color: colors.navy,
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    lineHeight: 20,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11, 28, 44, 0.45)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheet: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 1,
  },
  sheetBody: { color: colors.ink, lineHeight: 20, marginBottom: 12, fontSize: 15 },
  lock: { color: colors.muted, marginBottom: 14, lineHeight: 20 },
  rowItem: { marginBottom: 10 },
  rowLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase", fontWeight: "700" },
  rowValue: { fontSize: 16, color: colors.navy, marginTop: 2 },
  link: { textDecorationLine: "underline" },
  event: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.paperDark },
  eventType: { fontWeight: "700", color: colors.navy, textTransform: "capitalize" },
  eventMeta: { color: colors.muted, fontSize: 12, marginBottom: 4 },
});
