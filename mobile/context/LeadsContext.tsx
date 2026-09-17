import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Platform } from "react-native";
import { api, getApiBase } from "@/lib/api";
import { getToken } from "@/lib/storage";
import type { EmailResult, IntakeTemplateId, Lead } from "@/lib/types";
import { useAuth } from "./AuthContext";

type LeadsState = {
  unclaimed: Lead[];
  mine: Lead[];
  archive: Lead[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  banner: string | null;
  clearBanner: () => void;
  refresh: () => Promise<void>;
  claim: (id: string) => Promise<Lead>;
  followUp: (id: string, note?: string) => Promise<Lead>;
  sold: (id: string, note?: string, template?: IntakeTemplateId) => Promise<{ lead: Lead; email?: EmailResult }>;
  lost: (id: string, note?: string) => Promise<Lead>;
  addNote: (id: string, note: string) => Promise<Lead>;
  getLead: (id: string) => Lead | undefined;
  loadLead: (id: string) => Promise<Lead>;
};

const LeadsContext = createContext<LeadsState | null>(null);

export function LeadsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unclaimed, setUnclaimed] = useState<Lead[]>([]);
  const [mine, setMine] = useState<Lead[]>([]);
  const [archive, setArchive] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const revision = useRef(-1);
  const inboxCount = useRef(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      const [inbox, pipeline, done, state] = await Promise.all([
        api<{ leads: Lead[] }>("/leads/unclaimed"),
        api<{ leads: Lead[] }>("/leads/mine"),
        api<{ leads: Lead[] }>("/leads/archive"),
        api<{ revision: number }>("/leads/sync-state"),
      ]);
      setUnclaimed(inbox.leads);
      setMine(pipeline.leads);
      setArchive(done.leads);
      revision.current = state.revision;
      inboxCount.current = inbox.leads.length;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnclaimed([]);
      setMine([]);
      setArchive([]);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const state = await api<{ revision: number; unclaimed: number }>("/leads/sync-state");
        if (cancelled) return;
        if (state.revision !== revision.current) {
          const previousInbox = inboxCount.current;
          await refresh();
          if (state.unclaimed > previousInbox) {
            setBanner("New Angi lead in the unclaimed inbox");
          }
        }
      } catch {
        // keep last good data
      }
    };

    const interval = setInterval(() => void poll(), 2500);
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void poll();
    });

    let source: EventSource | null = null;
    if (Platform.OS === "web" && typeof EventSource !== "undefined") {
      void (async () => {
        const token = await getToken();
        if (!token || cancelled) return;
        source = new EventSource(`${getApiBase()}/api/events?token=${encodeURIComponent(token)}`);
        source.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data) as { type?: string; revision?: number };
            if (payload.type === "lead.created") setBanner("New Angi lead in the unclaimed inbox");
            if (typeof payload.revision === "number" && payload.revision !== revision.current) {
              void refresh();
            }
          } catch {
            // ignore
          }
        };
      })();
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
      source?.close();
    };
  }, [user, refresh]);

  const replaceLead = useCallback((lead: Lead) => {
    const swap = (list: Lead[]) => list.map((item) => (item.id === lead.id ? lead : item)).filter((item) => {
      return true;
    });
    setUnclaimed((list) => (lead.stage === "unclaimed" ? upsert(swap(list), lead) : list.filter((item) => item.id !== lead.id)));
    setMine((list) => (lead.stage === "claimed" && lead.claimedBy === user?.id ? upsert(list.filter((item) => item.id !== lead.id), lead) : list.filter((item) => item.id !== lead.id)));
    setArchive((list) =>
      lead.stage === "sold" || lead.stage === "lost"
        ? upsert(list.filter((item) => item.id !== lead.id), lead)
        : list.filter((item) => item.id !== lead.id)
    );
  }, [user?.id]);

  const claim = useCallback(async (id: string) => {
    const data = await api<{ lead: Lead }>(`/leads/${id}/claim`, { method: "POST" });
    replaceLead(data.lead);
    return data.lead;
  }, [replaceLead]);

  const followUp = useCallback(async (id: string, note?: string) => {
    const data = await api<{ lead: Lead }>(`/leads/${id}/follow-up`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    replaceLead(data.lead);
    return data.lead;
  }, [replaceLead]);

  const sold = useCallback(async (id: string, note?: string, template?: IntakeTemplateId) => {
    const data = await api<{ lead: Lead; email?: EmailResult }>(`/leads/${id}/sold`, {
      method: "POST",
      body: JSON.stringify({ note, template }),
    });
    replaceLead(data.lead);
    return data;
  }, [replaceLead]);

  const lost = useCallback(async (id: string, note?: string) => {
    const data = await api<{ lead: Lead }>(`/leads/${id}/lost`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    replaceLead(data.lead);
    return data.lead;
  }, [replaceLead]);

  const addNote = useCallback(async (id: string, note: string) => {
    const data = await api<{ lead: Lead }>(`/leads/${id}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
    replaceLead(data.lead);
    return data.lead;
  }, [replaceLead]);

  const getLead = useCallback(
    (id: string) => [...unclaimed, ...mine, ...archive].find((lead) => lead.id === id),
    [unclaimed, mine, archive]
  );

  const loadLead = useCallback(async (id: string) => {
    const data = await api<{ lead: Lead }>(`/leads/${id}`);
    replaceLead(data.lead);
    return data.lead;
  }, [replaceLead]);

  const value = useMemo(
    () => ({
      unclaimed,
      mine,
      archive,
      loading,
      refreshing,
      error,
      banner,
      clearBanner: () => setBanner(null),
      refresh,
      claim,
      followUp,
      sold,
      lost,
      addNote,
      getLead,
      loadLead,
    }),
    [unclaimed, mine, archive, loading, refreshing, error, banner, refresh, claim, followUp, sold, lost, addNote, getLead, loadLead]
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

function upsert(list: Lead[], lead: Lead): Lead[] {
  const without = list.filter((item) => item.id !== lead.id);
  return [lead, ...without];
}

export function useLeads(): LeadsState {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error("useLeads must be used within LeadsProvider");
  return ctx;
}
