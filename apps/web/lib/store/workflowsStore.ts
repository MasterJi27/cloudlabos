import { create } from "zustand";
import { api } from "@/lib/api";

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "draft";
  version?: string;
  steps: number;
  last_run?: string;
  created_at: string;
  workspace_id: string;
}

interface WorkflowsState {
  workflows: Workflow[];
  loading: boolean;
  fetchWorkflows: (workspaceId: string) => Promise<void>;
  createWorkflow: (workspaceId: string, data: Partial<Workflow>) => Promise<void>;
  updateWorkflow: (workflowId: string, data: Partial<Workflow>) => Promise<void>;
  deleteWorkflow: (workflowId: string) => Promise<void>;
  executeWorkflow: (workflowId: string) => Promise<string>;
}

export const useWorkflowsStore = create<WorkflowsState>((set) => ({
  workflows: [],
  loading: false,

  fetchWorkflows: async (workspaceId) => {
    set({ loading: true });
    try {
      const data = await api.listWorkflows(workspaceId);
      set({ workflows: Array.isArray(data) ? (data as unknown as Workflow[]) : [] });
    } catch (e) {
      console.error("fetchWorkflows", e);
    } finally {
      set({ loading: false });
    }
  },

  createWorkflow: async (workspaceId, data) => {
    try {
      await api.createWorkflow(workspaceId, data as Record<string, unknown>);
    } catch (e) {
      console.error("createWorkflow", e);
      throw e;
    }
  },

  updateWorkflow: async (workflowId, data) => {
    try {
      await api.updateWorkflow(workflowId, data as Record<string, unknown>);
    } catch (e) {
      console.error("updateWorkflow", e);
      throw e;
    }
  },

  deleteWorkflow: async (workflowId) => {
    try {
      await api.deleteWorkflow(workflowId);
      set((state) => ({ workflows: state.workflows.filter((w) => w.id !== workflowId) }));
    } catch (e) {
      console.error("deleteWorkflow", e);
      throw e;
    }
  },

  executeWorkflow: async (workflowId) => {
    try {
      const result = await api.executeWorkflow(workflowId);
      return result.id;
    } catch (e) {
      console.error("executeWorkflow", e);
      throw e;
    }
  },
}));
