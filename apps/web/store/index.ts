// Compatibility layer — will be removed once all pages are migrated.
// New code should import from @/lib/store directly.

import { create } from "zustand";
import type { User, Workspace, Agent, Workflow, Run } from "@/lib/store";
import { useAuthStore, useAgentsStore, useWorkflowsStore, useRunsStore } from "@/lib/store";
import { api } from "@/lib/api";

export type { User, Workspace, Agent, Workflow, Run };

export interface MemoryItem {
  id: string; content: string;
  content_type: "observation" | "knowledge" | "plan" | "result" | "error";
  source: string; run_id?: string; workflow_id?: string;
  created_at: string; score: number; tags: string[];
}

export interface Notification {
  id: string; type: "info" | "success" | "warning" | "error";
  title: string; message: string; data?: Record<string, unknown>;
  is_read: boolean; created_at: string;
}

export interface ApiKey {
  id: string; name: string; key_prefix: string;
  created_at: string; last_used_at?: string;
}

interface StoreState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  workspaces: Workspace[];
  currentWorkspace: string | null;
  agents: Agent[];
  workflows: Workflow[];
  runs: Record<string, Run>;
  activeRuns: Run[];
  runHistory: Run[];
  pendingApprovals: any[];
  approvals: any[];
  memoryItems: any[];
  memorySearchResults: any[];
  apiKeys: any[];
  sessions: any[];
  notifications: any[];
  webhooks: any[];
  unreadCount: number;
  plans: any[];
  subscription: any;
  members: any[];

  fetchMe: () => Promise<void>;
  fetchLogin: (email: string, password: string) => Promise<void>;
  fetchRegister: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  fetchWorkspaces: () => Promise<void>;
  setCurrentWorkspace: (id: string) => void;
  fetchAgents: () => Promise<void>;
  fetchWorkflows: () => Promise<void>;
  fetchExecuteWorkflow: (id: string) => Promise<string>;
  fetchRuns: () => Promise<void>;
  fetchRunSteps: (id: string) => Promise<unknown[]>;
  fetchCancelRun: (id: string) => Promise<void>;
  fetchApprovals: () => Promise<void>;
  fetchApproveAction: (id: string, notes?: string) => Promise<void>;
  fetchRejectAction: (id: string, notes?: string) => Promise<void>;
  fetchMemory: () => Promise<void>;
  fetchMemorySearch: (query: string) => Promise<void>;
  fetchDeleteMemory: (id: string) => Promise<void>;
  fetchApiKeys: () => Promise<void>;
  fetchCreateApiKey: (name: string) => Promise<string | undefined>;
  fetchRevokeApiKey: (id: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
  fetchRevokeSession: (id: string) => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchUpdateSubscription: (planId: string) => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchMarkNotificationRead: (id: string) => Promise<void>;
  fetchMarkAllRead: () => Promise<void>;
  fetchWebhooks: () => Promise<void>;
  fetchMembers: () => Promise<void>;
  fetchInviteMember: (email: string, role: string) => Promise<void>;
  fetchRemoveMember: (userId: string) => Promise<void>;
}

// Sync helper: updates compatibility store whenever domain stores change
function syncFromDomainStores() {
  const auth = useAuthStore.getState();
  const agents = useAgentsStore.getState();
  const workflows = useWorkflowsStore.getState();
  const runs = useRunsStore.getState();
  useLegacyStore.setState({
    user: auth.user,
    token: auth.token,
    isAuthenticated: auth.isAuthenticated,
    workspaces: auth.workspaces,
    currentWorkspace: auth.currentWorkspace,
    agents: agents.agents,
    workflows: workflows.workflows,
    runs: runs.runs,
    activeRuns: runs.activeRuns,
    runHistory: runs.runHistory,
  });
}

// Subscribe to domain store changes
useAuthStore.subscribe(syncFromDomainStores);
useAgentsStore.subscribe(syncFromDomainStores);
useWorkflowsStore.subscribe(syncFromDomainStores);
useRunsStore.subscribe(syncFromDomainStores);

export const useLegacyStore = create<StoreState>()((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  workspaces: [],
  currentWorkspace: null,
  agents: [],
  workflows: [],
  runs: {},
  activeRuns: [],
  runHistory: [],
  pendingApprovals: [],
  approvals: [],
  memoryItems: [],
  memorySearchResults: [],
  apiKeys: [],
  sessions: [],
  notifications: [],
  webhooks: [],
  unreadCount: 0,
  plans: [],
  subscription: null,
  members: [],

  fetchMe: useAuthStore.getState().fetchMe,
  fetchLogin: useAuthStore.getState().login,
  fetchRegister: useAuthStore.getState().register,
  logout: useAuthStore.getState().logout,
  fetchWorkspaces: useAuthStore.getState().fetchWorkspaces,
  setCurrentWorkspace: useAuthStore.getState().setCurrentWorkspace,
  fetchAgents: () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (ws) return useAgentsStore.getState().fetchAgents(ws);
    return Promise.resolve();
  },
  fetchWorkflows: () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (ws) return useWorkflowsStore.getState().fetchWorkflows(ws);
    return Promise.resolve();
  },
  fetchExecuteWorkflow: (id) => useWorkflowsStore.getState().executeWorkflow(id),
  fetchRuns: () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (ws) return useRunsStore.getState().fetchRuns(ws);
    return Promise.resolve();
  },
  fetchRunSteps: (id) => useRunsStore.getState().fetchRunSteps(id),
  fetchCancelRun: (id) => useRunsStore.getState().cancelRun(id),
  fetchApprovals: async () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (!ws) return;
    try {
      const data = await api.listApprovals(ws);
      const items = data as any[];
      useLegacyStore.setState({
        approvals: items,
        pendingApprovals: items.filter((a: any) => a.status === "pending"),
      });
    } catch (e) { console.error("fetchApprovals", e); }
  },
  fetchApproveAction: async (id, notes) => {
    try {
      await api.approveAction(id, notes);
      useLegacyStore.getState().fetchApprovals();
    } catch (e) { console.error("fetchApproveAction", e); }
  },
  fetchRejectAction: async (id, notes) => {
    try {
      await api.rejectAction(id, notes);
      useLegacyStore.getState().fetchApprovals();
    } catch (e) { console.error("fetchRejectAction", e); }
  },
  fetchMemory: async () => {},
  fetchMemorySearch: async () => {},
  fetchDeleteMemory: async () => {},
  fetchApiKeys: async () => {},
  fetchCreateApiKey: async (name) => {
    const res = await api.createApiKey(name);
    return res.raw_key;
  },
  fetchRevokeApiKey: async () => {},
  fetchSessions: async () => {},
  fetchRevokeSession: async () => {},
  fetchSubscription: async () => {
    try {
      const data = await api.getSubscription();
      useLegacyStore.setState({ subscription: data as any });
    } catch (e) { console.error("fetchSubscription", e); }
  },
  fetchPlans: async () => {
    try {
      const data = await api.getPlans();
      useLegacyStore.setState({ plans: data as any[] });
    } catch (e) { console.error("fetchPlans", e); }
  },
  fetchUpdateSubscription: async (planId) => {
    try {
      const data = await api.updateSubscription(planId);
      useLegacyStore.setState({ subscription: data as any });
    } catch (e) { console.error("fetchUpdateSubscription", e); }
  },
  fetchNotifications: async () => {},
  fetchMarkNotificationRead: async () => {},
  fetchMarkAllRead: async () => {},
  fetchWebhooks: async () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (!ws) return;
    try {
      const data = await api.listWebhooks(ws);
      useLegacyStore.setState({ webhooks: data as any[] });
    } catch (e) { console.error("fetchWebhooks", e); }
  },
  fetchMembers: async () => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (!ws) return;
    try {
      const data = await api.listMembers(ws);
      useLegacyStore.setState({ members: data as any[] });
    } catch (e) { console.error("fetchMembers", e); }
  },
  fetchInviteMember: async (email, role) => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (!ws) return;
    try {
      await api.inviteMember(ws, email, role);
      useLegacyStore.getState().fetchMembers();
    } catch (e) { console.error("fetchInviteMember", e); }
  },
  fetchRemoveMember: async (userId) => {
    const ws = useAuthStore.getState().currentWorkspace;
    if (!ws) return;
    try {
      const members = useLegacyStore.getState().members;
      const member = members.find((m: any) => m.user_id === userId);
      if (member) {
        await api.removeMember(ws, member.id);
        useLegacyStore.getState().fetchMembers();
      }
    } catch (e) { console.error("fetchRemoveMember", e); }
  },
}));

// Alias for backward compatibility
export const useStore = useLegacyStore;

// Initial sync
syncFromDomainStores();
