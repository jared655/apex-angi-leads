import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States";
import { TitleBlock } from "@/components/Ui";
import { useLeads } from "@/context/LeadsContext";
import { colors } from "@/lib/theme";

export default function ArchiveScreen() {
  const router = useRouter();
  const { archive, loading, refreshing, error, refresh } = useLeads();
  const [filter, setFilter] = useState<"all" | "sold" | "lost">("all");
  const visible = useMemo(
    () => archive.filter((lead) => (filter === "all" ? true : lead.stage === filter)),
    [archive, filter]
  );

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <TitleBlock kicker="Closed jobs" title="Sold / Lost" meta={`${archive.length} total`} />
      <View style={styles.filters}>
        {(["all", "sold", "lost"] as const).map((key) => (
          <Pressable key={key} onPress={() => setFilter(key)} style={[styles.chip, filter === key && styles.chipOn]}>
            <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{key}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <LoadingBlock /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={refresh} /> : null}
      {!loading && !error && visible.length === 0 ? (
        <EmptyState title="Archive is empty" body="Sold and lost jobs from your pipeline land here so the active board stays honest." />
      ) : null}
      {visible.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} extra={lead.claimedByName || undefined} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { textTransform: "capitalize", color: colors.navy, fontWeight: "700", fontSize: 13 },
  chipTextOn: { color: colors.paper },
});
