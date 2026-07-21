import { create } from "zustand";
import { api } from "@/lib/api";

export interface Agent {
  id: string;
  name: string;
  status: "active" | "busy" | "idle" | "error";
  type: string;
  model: string;
  memory_usage: string;
  uptime: string;
  tasks_total?: number;
  tools: string[];
  workspace_id: string;
}

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  fetchAgents: (workspaceId: string) => Promise<void>;
  createAgent: (workspaceId: string, data: Partial<Agent>) => Promise<Record<string, unknown>>;
  deleteAgent: (agentId: string) => Promise<void>;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async (workspaceId) => {
    set({ loading: true });
    try {
      const data = await api.listAgents(workspaceId);
      set({ agents: Array.isArray(data) ? (data as unknown as Agent[]) : [] });
    } catch (e) {
      console.error("fetchAgents", e);
    } finally {
      set({ loading: false });
    }
  },

  createAgent: async (workspaceId, data) => {
    try {
      const created = await api.createAgent(workspaceId, data as Record<string, unknown>);
      return created;
    } catch (e) {
      console.error("createAgent", e);
      throw e;
    }
  },

  deleteAgent: async (agentId) => {
    try {
      await api.deleteAgent(agentId);
      set((state) => ({ agents: state.agents.filter((a) => a.id !== agentId) }));
    } catch (e) {
      console.error("deleteAgent", e);
      throw e;
    }
  },
}));
