import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { LeadCard } from "@/components/LeadCard";
import { EmptyState, ErrorBlock, LoadingBlock } from "@/components/States";
import { TitleBlock } from "@/components/Ui";
import { useLeads } from "@/context/LeadsContext";
import { colors } from "@/lib/theme";

export default function PipelineScreen() {
  const router = useRouter();
  const { mine, loading, refreshing, error, refresh } = useLeads();
  const follow = mine.filter((lead) => lead.needsFollowUp);
  const active = mine.filter((lead) => !lead.needsFollowUp);

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <TitleBlock kicker="Personal board" title="My pipeline" meta={`${mine.length} active`} />
      {loading ? <LoadingBlock /> : null}
      {!loading && error ? <ErrorBlock message={error} onRetry={refresh} /> : null}
      {!loading && !error && mine.length === 0 ? (
        <EmptyState
          title="Nothing claimed yet"
          body="Claim a lead from Unclaimed and it moves here — only you see the client details in this pipeline. Follow up, mark sold, or mark lost from the lead sheet."
        />
      ) : null}
      {follow.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} extra="Needs follow-up" />
      ))}
      {active.map((lead) => (
        <LeadCard key={lead.id} lead={lead} onPress={() => router.push(`/lead/${lead.id}`)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 16, paddingBottom: 40 },
});
