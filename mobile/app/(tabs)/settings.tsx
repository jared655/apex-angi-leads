import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useLeads } from "@/context/LeadsContext";
import { api, ApiError } from "@/lib/api";
import { colors } from "@/lib/theme";
import { Button, TitleBlock } from "@/components/Ui";
import type { SyncStatus } from "@/lib/types";

export default function SettingsScreen() {
  const { user, teammates, logout, updateName } = useAuth();
  const { refresh } = useLeads();
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [json, setJson] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);

  useEffect(() => {
    setName(user?.displayName || "");
  }, [user?.displayName]);

  useEffect(() => {
    void api<SyncStatus>("/sync/status")
      .then(setSync)
      .catch(() => setSync(null));
  }, []);

  async function saveName() {
    setSaving(true);
    setError(null);
    try {
      await updateName(name);
      setMessage("Display name updated. Teammate phones will pick this up on the next refresh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save name");
    } finally {
      setSaving(false);
    }
  }

  async function simulate() {
    setError(null);
    try {
      const result = await api<{ message: string }>("/sync/simulate", { method: "POST" });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Simulate failed");
    }
  }

  async function runAngi() {
    setError(null);
    try {
      const result = await api<{ message: string }>("/sync/angi", { method: "POST" });
      setMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Angi sync failed — use CSV/JSON import.");
    }
  }

  async function importJson() {
    setError(null);
    try {
      const parsed = JSON.parse(json);
      const result = await api<{ message: string }>("/import/json", {
        method: "POST",
        body: JSON.stringify(parsed),
      });
      setMessage(result.message);
      setJson("");
      await refresh();
    } catch (err) {
      setError(err instanceof SyntaxError ? "JSON is invalid" : err instanceof Error ? err.message : "Import failed");
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <TitleBlock kicker="Crew" title="Settings" meta={user?.displayName} />

      <View style={styles.card}>
        <Text style={styles.section}>Signed in as</Text>
        <Text style={styles.strong}>{user?.displayName}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={[styles.section, { marginTop: 16 }]}>Display name</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} />
        <Button label={saving ? "Saving…" : "Save name"} onPress={saveName} disabled={saving} style={{ marginTop: 10 }} />
        <Text style={[styles.section, { marginTop: 18 }]}>Teammates</Text>
        {teammates.map((mate) => (
          <Text key={mate.id} style={styles.muted}>
            {mate.displayName} · {mate.email}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Angi sync</Text>
        <Text style={styles.body}>
          Angi has no public leads API. Production path: point Angi CRM / Zapier at POST /api/webhooks/angi, or drop an All leads CSV/JSON export here. Optional polling uses ANGI_SESSION_COOKIE or ANGI_EMAIL + ANGI_PASSWORD.
        </Text>
        <Text style={styles.muted}>
          Polling {sync?.pollingEnabled ? "configured" : "off"} · webhook {sync?.webhookEnabled ? "key set" : "off"}
          {sync?.lastSyncAt ? ` · last ${sync.lastSyncAt}` : ""}
        </Text>
        <View style={styles.row}>
          <Button label="Inject demo lead" onPress={simulate} />
          <Button label="Poll Angi now" tone="ghost" onPress={runAngi} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Import JSON</Text>
        <TextInput
          value={json}
          onChangeText={setJson}
          style={[styles.input, styles.area]}
          multiline
          placeholder='{"leadId":"ANGI-1","firstName":"Alex","lastName":"Kim","taskName":"House plans"}'
          placeholderTextColor={colors.muted}
        />
        <Button label="Import" tone="ghost" onPress={importJson} style={{ marginTop: 10 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Push notifications</Text>
        <Text style={styles.body}>
          {Platform.OS === "web"
            ? "This web preview uses live inbox banners. Install on iPhone (TestFlight) or Android (internal testing) to receive Expo push when a new lead arrives."
            : "This device will request notification permission and register an Expo push token. Both users are notified on every new lead."}
        </Text>
      </View>

      {message ? <Text style={styles.ok}>{message}</Text> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Pressable onPress={logout} style={styles.signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 48 },
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
    marginBottom: 6,
  },
  strong: { fontSize: 20, fontWeight: "700", color: colors.navy },
  muted: { color: colors.muted, marginTop: 3, fontSize: 13 },
  body: { color: colors.ink, lineHeight: 21, fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  area: { minHeight: 110, textAlignVertical: "top", fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  row: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  ok: { color: colors.success, marginTop: 4, marginBottom: 8 },
  err: { color: colors.danger, marginTop: 4, marginBottom: 8 },
  signOut: { marginTop: 8, alignItems: "center", padding: 14 },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
