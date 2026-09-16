import { useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useLeads } from "@/context/LeadsContext";
import { api, ApiError, getApiBase } from "@/lib/api";
import { colors } from "@/lib/theme";
import { Button, TitleBlock } from "@/components/Ui";
import type { SyncStatus } from "@/lib/types";

export default function SettingsScreen() {
  const { user, teammates, logout, updateName } = useAuth();
  const { refresh } = useLeads();
  const [name, setName] = useState(user?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [json, setJson] = useState("");
  const [cookie, setCookie] = useState("");
  const [angiEmail, setAngiEmail] = useState("apexdraftingllc@gmail.com");
  const [angiPassword, setAngiPassword] = useState("");
  const [leadsUrl, setLeadsUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [webhookShown, setWebhookShown] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.displayName || "");
  }, [user?.displayName]);

  async function loadStatus() {
    try {
      const next = await api<SyncStatus>("/sync/status");
      setSync(next);
      if (next.angiEmail) setAngiEmail(next.angiEmail);
    } catch {
      setSync(null);
    }
  }

  useEffect(() => {
    void loadStatus();
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
      const result = await api<{ message: string; errors?: string[] }>("/sync/angi", { method: "POST" });
      setMessage(result.message);
      await loadStatus();
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Angi sync failed — check the cookie or import CSV.");
      await loadStatus();
    }
  }

  async function connectAngi(generateWebhook = false) {
    setError(null);
    const payload: Record<string, unknown> = { pollNow: true };
    if (cookie.trim()) payload.sessionCookie = cookie.trim();
    if (angiEmail.trim()) payload.email = angiEmail.trim();
    if (angiPassword.trim()) payload.password = angiPassword.trim();
    if (leadsUrl.trim()) payload.leadsApiUrl = leadsUrl.trim();
    if (generateWebhook) payload.webhookKey = "generate";
    if (!payload.sessionCookie && !payload.email && !payload.leadsApiUrl && !generateWebhook) {
      setError("Paste the office.angi.com Cookie header first (see the steps below).");
      return;
    }
    try {
      const result = await api<{
        message: string;
        webhookKey?: string;
        status: SyncStatus;
        sync?: { message: string; ok: boolean };
      }>("/sync/angi/connect", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSync(result.status);
      if (result.webhookKey) setWebhookShown(result.webhookKey);
      setMessage(result.sync?.message || result.message);
      setCookie("");
      setAngiPassword("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save Angi connection");
    }
  }

  async function disconnectAngi() {
    setError(null);
    try {
      const result = await api<{ message: string; status: SyncStatus }>("/sync/angi/disconnect", { method: "POST" });
      setSync(result.status);
      setWebhookShown(null);
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
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

  const apiBase = getApiBase() || "(this web origin)";
  const attached = Boolean(sync?.hasCookie || sync?.hasEmail || sync?.hasCustomLeadsUrl);

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
        <Text style={styles.section}>Connect Angi Pro</Text>
        <Text style={styles.body}>
          Angi login: <Text style={{ fontWeight: "700" }}>apexdraftingllc@gmail.com</Text>
          {sync?.waitingForPassword
            ? " — password is not in this repo. Add ANGI_PASSWORD in server/.env when you have it (secure env), or paste a session Cookie today to start live sync."
            : attached
              ? " Live sync is on. Both phones get a push when a new Angi lead id appears."
              : " Paste a Cookie from office.angi.com to sync now without waiting on the password."}
        </Text>
        <Text style={styles.muted}>
          {attached ? "Attached" : "Not attached"}
          {sync?.hasCookie ? " · cookie" : ""}
          {sync?.hasEmail ? " · email" : ""}
          {sync?.webhookEnabled ? " · webhook key" : ""}
          {sync?.lastSyncAt ? ` · last ${sync.lastSyncAt}` : ""}
        </Text>
        {sync?.lastError ? <Text style={styles.err}>{sync.lastError}</Text> : null}

        <Text style={styles.howtoTitle}>How Jared attaches the real account</Text>
        <Text style={styles.body}>
          1. On a computer, open Chrome and sign in at office.angi.com (Leads page).{"\n"}
          2. DevTools (F12) → Application → Cookies → office.angi.com, or Network → any request → Request Headers → Cookie.{"\n"}
          3. Copy the entire Cookie header and paste it below. Save & poll.{"\n"}
          4. You should see real homeowners in Unclaimed. Duplicate Angi lead ids are skipped.{"\n"}
          5. If poll returns 0 leads, also copy the Network XHR that lists leads and paste it as Leads API URL.
        </Text>
        {sync?.envLocked.cookie ? (
          <Text style={styles.muted}>Cookie is locked by server/.env (ANGI_SESSION_COOKIE). Change it there.</Text>
        ) : (
          <TextInput
            value={cookie}
            onChangeText={setCookie}
            style={[styles.input, styles.area]}
            multiline
            autoCapitalize="none"
            placeholder="Cookie: paste the full header from office.angi.com"
            placeholderTextColor={colors.muted}
          />
        )}
        <Text style={[styles.section, { marginTop: 14 }]}>Angi email</Text>
        <TextInput
          value={angiEmail}
          onChangeText={setAngiEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          placeholder="apexdraftingllc@gmail.com"
          placeholderTextColor={colors.muted}
          editable={!sync?.envLocked.email}
        />
        <Text style={[styles.section, { marginTop: 10 }]}>Angi password (optional — prefer server/.env)</Text>
        <TextInput
          value={angiPassword}
          onChangeText={setAngiPassword}
          secureTextEntry
          style={styles.input}
          placeholder="Leave blank. Prefer ANGI_PASSWORD in server/.env (never commit it)."
          placeholderTextColor={colors.muted}
        />
        <Text style={[styles.section, { marginTop: 10 }]}>Leads API / XHR URL (optional)</Text>
        <TextInput
          value={leadsUrl}
          onChangeText={setLeadsUrl}
          autoCapitalize="none"
          style={styles.input}
          placeholder="https://office.angi.com/… from DevTools Network"
          placeholderTextColor={colors.muted}
        />
        <View style={styles.row}>
          <Button label="Save & poll Angi" onPress={() => void connectAngi(false)} />
          <Button label="Poll now" tone="ghost" onPress={runAngi} />
        </View>
        <View style={styles.row}>
          <Button label="Generate webhook key" tone="ghost" onPress={() => void connectAngi(true)} />
          <Button label="Disconnect Angi" tone="danger" onPress={disconnectAngi} />
        </View>
        {webhookShown ? (
          <Text style={styles.ok}>
            Webhook key (save this): {webhookShown}{"\n"}
            Angi CRM / Zapier POST {apiBase}
            {sync?.webhookPath || "/api/webhooks/angi"} with header X-API-KEY
          </Text>
        ) : null}
        <Button label="Inject demo lead" tone="warn" onPress={simulate} style={{ marginTop: 10 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Expo Go (iPhone + Samsung)</Text>
        <Text style={styles.body}>
          Project: APEX Drafting (slug apex-drafting). On the computer run the API, set EXPO_PUBLIC_API_URL in mobile/.env to that computer (LAN IP or HTTPS tunnel), then `cd mobile && npm run lan` (same Wi-Fi) or `npm run go` (tunnel).
        </Text>
        <Text style={styles.body}>
          iPhone: App Store → Expo Go. Open Camera, scan the terminal QR, tap Open in Expo Go.
        </Text>
        <Text style={styles.body}>
          Samsung: Play Store → Expo Go → Scan QR code, scan the same QR.
        </Text>
        <Text style={styles.body}>
          Expo Go on Android (SDK 53) cannot register remote push — that API was removed and would crash the app. New leads still land in Unclaimed with an in-app banner. Remote push is for a development or production build.
        </Text>
        <Text style={styles.muted}>This device API: {apiBase || "/"} — phones must not use 127.0.0.1 unless the API runs on that phone.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Import JSON fallback</Text>
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
  howtoTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
  strong: { fontSize: 20, fontWeight: "700", color: colors.navy },
  muted: { color: colors.muted, marginTop: 3, fontSize: 13, lineHeight: 19 },
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
  area: { minHeight: 90, textAlignVertical: "top", fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  row: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
  ok: { color: colors.success, marginTop: 4, marginBottom: 8, lineHeight: 20 },
  err: { color: colors.danger, marginTop: 8, marginBottom: 8, lineHeight: 20 },
  signOut: { marginTop: 8, alignItems: "center", padding: 14 },
  signOutText: { color: colors.danger, fontWeight: "700" },
});
