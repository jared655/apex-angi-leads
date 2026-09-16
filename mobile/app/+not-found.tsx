import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/lib/theme";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>That sheet isn’t in this set.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to unclaimed leads</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: colors.paper },
  title: { fontSize: 20, fontWeight: "700", color: colors.navy, textAlign: "center" },
  link: { marginTop: 16, paddingVertical: 12 },
  linkText: { fontSize: 15, color: colors.brassDark, fontWeight: "700" },
});
