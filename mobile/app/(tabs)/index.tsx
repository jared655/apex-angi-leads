import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States";
import { TitleBlock } from "@/components/Ui";
import { useLeads } from "@/context/LeadsContext";
import { colors } from "@/lib/theme";

export default function InboxScreen() {
  const router = useRouter();
  const { unclaimed, loading, refreshing, error, refresh, banner, clearBanner } = useLeads();

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <TitleBlock kicker="Inbox" title="Unclaimed leads" meta={`${unclaimed.length} open`} />
      {banner ? (
        <Pressable onPress={clearBanner} style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
          <Text style={styles.bannerDismiss}>Dismiss</Text>
        </Pressable>
      ) : null}
      {loading ? <LoadingBlock /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={refresh} /> : null}
      {!loading && !error && unclaimed.length === 0 ? (
        <EmptyState
          title="Board is clear"
          body="When a new Angi lead syncs — or you inject a demo lead in Settings — it shows up here for both Jared and Reuben until someone claims it."
        />
      ) : null}
      {unclaimed.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} extra="Tap to review & claim" />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
  banner: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerText: { color: colors.paper, flex: 1, fontWeight: "600" },
  bannerDismiss: { color: colors.brass, fontWeight: "700" },
});
