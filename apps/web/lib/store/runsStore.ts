import { create } from "zustand";
import { api } from "@/lib/api";

export interface Run {
  id: string;
  workflow_id: string;
  workflow_name: string;
  status: "running" | "success" | "failed" | "cancelled" | "pending";
  trigger: string;
  progress: number;
  started_at?: string;
  completed_at?: string;
  workspace_id: string;
}

interface RunsState {
  runs: Record<string, Run>;
  activeRuns: Run[];
  runHistory: Run[];
  loading: boolean;
  fetchRuns: (workspaceId: string, status?: string) => Promise<void>;
  fetchRunSteps: (runId: string) => Promise<unknown[]>;
  cancelRun: (runId: string) => Promise<void>;
}

export const useRunsStore = create<RunsState>((set) => ({
  runs: {},
  activeRuns: [],
  runHistory: [],
  loading: false,

  fetchRuns: async (workspaceId, status) => {
    set({ loading: true });
    try {
      const runsData = await api.listRuns(workspaceId, status);
      const runsList = Array.isArray(runsData) ? runsData : [];
      const runsRecord: Record<string, Run> = {};
      const active: Run[] = [];
      const history: Run[] = [];
      for (const r of runsList as unknown as Run[]) {
        let progress = 0;
        if (r.status === "success") progress = 100;
        else if (r.status === "failed" || r.status === "cancelled") progress = 100;
        else if (r.status === "running") progress = 50;
        const run: Run = { ...r, progress };
        runsRecord[r.id] = run;
        if (r.status === "running") active.push(run);
        else history.push(run);
      }
      set({ runs: runsRecord, activeRuns: active, runHistory: history });
    } catch (e) {
      console.error("fetchRuns", e);
    } finally {
      set({ loading: false });
    }
  },

  fetchRunSteps: async (runId) => {
    try {
      return await api.getRunSteps(runId);
    } catch (e) {
      console.error("fetchRunSteps", e);
      return [];
    }
  },

  cancelRun: async (runId) => {
    try {
      await api.cancelRun(runId);
      set((state) => {
        const run = state.runs[runId];
        if (run) run.status = "cancelled";
        return {
          activeRuns: state.activeRuns.filter((r) => r.id !== runId),
          runHistory: run ? [run, ...state.runHistory.filter((r) => r.id !== runId)] : state.runHistory,
        };
      });
    } catch (e) {
      console.error("cancelRun", e);
      throw e;
    }
  },
}));
