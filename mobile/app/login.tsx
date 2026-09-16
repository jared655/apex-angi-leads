import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { colors } from "@/lib/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("jared@apexdrafting.local");
  const [password, setPassword] = useState("ApexJared1!");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Is the API running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <Text style={styles.sheet}>APEX DRAFTING LLC</Text>
        <Text style={styles.wordmark}>Lead desk</Text>
        <Text style={styles.tag}>Two-person Angi inbox. Claim it or it’s still on the board.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          placeholder="you@apexdrafting.local"
          placeholderTextColor={colors.muted}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.muted}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable onPress={onSubmit} disabled={submitting} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaText}>{submitting ? "Signing in…" : "Sign in"}</Text>
        </Pressable>

        <View style={styles.seeds}>
          <Text style={styles.seedTitle}>Seeded crew</Text>
          <Pressable onPress={() => { setEmail("jared@apexdrafting.local"); setPassword("ApexJared1!"); }}>
            <Text style={styles.seed}>Jared — jared@apexdrafting.local / ApexJared1!</Text>
          </Pressable>
          <Pressable onPress={() => { setEmail("reuben@apexdrafting.local"); setPassword("ApexReuben1!"); }}>
            <Text style={styles.seed}>Reuben — reuben@apexdrafting.local / ApexReuben1!</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.navy, justifyContent: "center", padding: 20 },
  hero: { marginBottom: 22, paddingHorizontal: 4 },
  sheet: {
    color: colors.brass,
    letterSpacing: 3,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
  },
  wordmark: { color: colors.paper, fontSize: 36, fontWeight: "700" },
  tag: { color: "#C9D3DC", marginTop: 8, fontSize: 15, lineHeight: 22, maxWidth: 420 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#2A4A63",
  },
  label: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.danger, marginTop: 12, fontSize: 14 },
  cta: {
    marginTop: 18,
    backgroundColor: colors.navy,
    borderRadius: 8,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: colors.paper, fontWeight: "700", fontSize: 16 },
  seeds: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
  seedTitle: { fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: colors.muted, fontWeight: "700", marginBottom: 8 },
  seed: { color: colors.navy, fontSize: 13, marginBottom: 6 },
});
