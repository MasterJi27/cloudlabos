import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { api } from "@/lib/api";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export interface User {
  id: string; email: string; name: string; role: string;
  mfa_enabled?: boolean; email_verified_at?: string;
}

export interface Workspace {
  id: string; name: string; description?: string; role: string; created_at: string;
}

export interface Workflow {
  id: string; name: string; description?: string;
  status: "draft" | "active" | "archived"; version: number;
  steps: number; last_run?: string; success_rate?: number; created_at?: string;
}

export interface Run {
  id: string; workflow_id: string; workflow_name: string;
  status: string; trigger_type: string; progress: number;
  current_step?: string; started_at: string; completed_at?: string;
  duration?: string; steps: RunStep[];
}

export interface RunStep {
  id: string; name: string; agent_type: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  started_at?: string; completed_at?: string; duration?: string;
  risk_score?: number; output?: any; error?: string;
}

export interface Agent {
  id: string; name: string; status: "active" | "busy" | "idle" | "error";
  tasks_total: number; tasks_success: number; tasks_failed: number;
  avg_latency: string; current_task: string; memory_usage: string; uptime: string;
}

export interface Approval {
  id: string; run_id: string; run_name: string; step_name: string;
  action: string; risk_score: number; risk_category: string;
  risk_reasons: string[]; status: "pending" | "approved" | "rejected";
  requested_by: string; requested_at: string; expires_at: string;
}

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
  created_at: string; last_used_at: string | null;
}

export interface Subscription {
  plan: string; status: string;
  current_period_start: string; current_period_end: string;
  cancel_at_period_end: boolean;
}

export interface Plan {
  id: string; name: string; price: number; interval: string;
  features: string[]; limits: Record<string, number>;
}

export interface Webhook {
  id: string; name: string; url: string; events: string[];
  is_active: boolean; created_at: string;
}

export interface WorkspaceMember {
  id: string; name: string; email: string; role: string; joined_at: string;
}

interface AppState {
  user: User | null; token: string | null; isAuthenticated: boolean;
  workspaces: Workspace[]; currentWorkspace: string | null;
  workflows: Workflow[]; selectedWorkflow: string | null;
  runs: Record<string, Run>; activeRuns: Run[]; runHistory: Run[];
  agents: Agent[];
  approvals: Approval[]; pendingApprovals: Approval[];
  memoryItems: MemoryItem[]; memorySearchResults: MemoryItem[];
  notifications: Notification[]; unreadCount: number;
  apiKeys: ApiKey[]; sessions: Array<any>;
  subscription: Subscription | null; plans: Plan[];
  webhooks: Webhook[]; members: WorkspaceMember[];
  sidebarCollapsed: boolean; theme: "dark" | "light";
  _wsConnection: WebSocket | null;
}

interface AppActions {
  login: (user: User, token: string) => void;
  logout: () => void;
  fetchLogin: (email: string, password: string) => Promise<void>;
  fetchRegister: (email: string, password: string, name: string) => Promise<void>;
  fetchMe: () => Promise<void>;

  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (id: string) => void;
  fetchWorkspaces: () => Promise<void>;

  setWorkflows: (workflows: Workflow[]) => void;
  selectWorkflow: (id: string | null) => void;
  fetchWorkflows: () => Promise<void>;
  fetchExecuteWorkflow: (workflowId: string, payload?: Record<string, unknown>) => Promise<string>;

  setRun: (runId: string, data: Partial<Run>) => void;
  addRun: (run: Run) => void;
  updateRunStep: (runId: string, step: RunStep) => void;
  setActiveRuns: (runs: Run[]) => void;
  setRunHistory: (runs: Run[]) => void;
  fetchRuns: (status?: string) => Promise<void>;
  fetchRunSteps: (runId: string) => Promise<RunStep[]>;
  fetchCancelRun: (runId: string) => Promise<void>;

  setAgents: (agents: Agent[]) => void;
  updateAgent: (id: string, data: Partial<Agent>) => void;
  fetchAgents: () => Promise<void>;

  connectRunWebSocket: (runId: string) => void;
  disconnectRunWebSocket: () => void;

  setApprovals: (approvals: Approval[]) => void;
  addApproval: (approval: Approval) => void;
  updateApproval: (id: string, status: "approved" | "rejected") => void;
  fetchApprovals: () => Promise<void>;
  fetchApproveAction: (approvalId: string, notes?: string) => Promise<void>;
  fetchRejectAction: (approvalId: string, notes?: string) => Promise<void>;

  setMemoryItems: (items: MemoryItem[]) => void;
  setMemorySearchResults: (items: MemoryItem[]) => void;
  fetchMemory: (contentType?: string) => Promise<void>;
  fetchMemorySearch: (query: string) => Promise<void>;
  fetchDeleteMemory: (memoryId: number) => Promise<void>;

  // New actions
  fetchApiKeys: () => Promise<void>;
  fetchCreateApiKey: (name: string) => Promise<string>;
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

  toggleSidebar: () => void;
  setTheme: (theme: "dark" | "light") => void;
  addNotification: (notification: Omit<Notification, "id" | "created_at">) => void;
  removeNotification: (id: string) => void;
}

export const useStore = create<AppState & AppActions>()(
  immer((set) => ({
    user: null, token: null, isAuthenticated: false,
    workspaces: [], currentWorkspace: null,
    workflows: [], selectedWorkflow: null,
    runs: {}, activeRuns: [], runHistory: [],
    agents: [],
    approvals: [], pendingApprovals: [],
    memoryItems: [], memorySearchResults: [],
    notifications: [], unreadCount: 0,
    apiKeys: [], sessions: [],
    subscription: null, plans: [],
    webhooks: [], members: [],
    sidebarCollapsed: false, theme: "dark",
    _wsConnection: null,

    login: (user, token) => set((state) => { state.user = user; state.token = token; state.isAuthenticated = true; }),
    logout: () => set((state) => { state.user = null; state.token = null; state.isAuthenticated = false; localStorage.removeItem("token"); }),

    setWorkspaces: (workspaces) => set((state) => { state.workspaces = workspaces; }),
    setCurrentWorkspace: (id) => set((state) => { state.currentWorkspace = id; }),
    setWorkflows: (workflows) => set((state) => { state.workflows = workflows; }),
    selectWorkflow: (id) => set((state) => { state.selectedWorkflow = id; }),

    setRun: (runId, data) => set((state) => { const existing = state.runs[runId]; state.runs[runId] = { ...existing, ...data } as Run; }),
    addRun: (run) => set((state) => { state.runs[run.id] = run; if (run.status === "running") state.activeRuns = [...state.activeRuns.filter(r => r.id !== run.id), run]; }),
    updateRunStep: (runId, step) => set((state) => { const run = state.runs[runId]; if (run) { const idx = run.steps.findIndex(s => s.id === step.id); if (idx >= 0) run.steps[idx] = step; else run.steps.push(step); } }),
    setActiveRuns: (runs) => set((state) => { state.activeRuns = runs; }),
    setRunHistory: (runs) => set((state) => { state.runHistory = runs; }),
    setAgents: (agents) => set((state) => { state.agents = agents; }),
    updateAgent: (id, data) => set((state) => { const idx = state.agents.findIndex(a => a.id === id); if (idx >= 0) state.agents[idx] = { ...state.agents[idx], ...data }; }),
    setApprovals: (approvals) => set((state) => { state.approvals = approvals; state.pendingApprovals = approvals.filter(a => a.status === "pending"); }),
    addApproval: (approval) => set((state) => { state.approvals.push(approval); if (approval.status === "pending") state.pendingApprovals.push(approval); }),
    updateApproval: (id, status) => set((state) => { const idx = state.approvals.findIndex(a => a.id === id); if (idx >= 0) state.approvals[idx].status = status; state.pendingApprovals = state.approvals.filter(a => a.status === "pending"); }),
    setMemoryItems: (items) => set((state) => { state.memoryItems = items; }),
    setMemorySearchResults: (items) => set((state) => { state.memorySearchResults = items; }),
    toggleSidebar: () => set((state) => { state.sidebarCollapsed = !state.sidebarCollapsed; }),
    setTheme: (theme) => set((state) => { state.theme = theme; }),
    addNotification: (notification) => set((state) => { state.notifications.push({ ...notification, id: Math.random().toString(36).substr(2, 9), is_read: false, created_at: new Date().toISOString() }); }),
    removeNotification: (id) => set((state) => { state.notifications = state.notifications.filter(n => n.id !== id); }),

    // Async actions
    fetchLogin: async (email, password) => {
      try {
        const { access_token } = await api.login(email, password);
        api.setToken(access_token);
        localStorage.setItem("token", access_token);
        const user = await api.getMe();
        set((state) => { state.user = user as User; state.token = access_token; state.isAuthenticated = true; });
      } catch (e: any) {
        if (isDemoMode && (e.message?.includes("fetch") || e.message?.includes("Failed to fetch"))) {
          console.warn("Backend offline, falling back to Demo Mode");
          const dummyUser = { id: "1", email, name: "Demo User", role: "admin" };
          api.setToken("demo_token");
          localStorage.setItem("token", "demo_token");
          set((state) => { 
            state.user = dummyUser as User; 
            state.token = "demo_token"; 
            state.isAuthenticated = true; 
            state.workspaces = [{ id: "1", name: "Demo Workspace", role: "admin", created_at: new Date().toISOString() }];
            state.currentWorkspace = "1";
          });
          return;
        }
        throw e;
      }
    },

    fetchRegister: async (email, password, name) => {
      try {
        const { access_token } = await api.register(email, password, name);
        api.setToken(access_token);
        localStorage.setItem("token", access_token);
        const user = await api.getMe();
        set((state) => { state.user = user as User; state.token = access_token; state.isAuthenticated = true; });
      } catch (e: any) {
        if (isDemoMode && (e.message?.includes("fetch") || e.message?.includes("Failed to fetch"))) {
          console.warn("Backend offline, falling back to Demo Mode");
          const dummyUser = { id: "1", email, name: name || "Demo User", role: "admin" };
          api.setToken("demo_token");
          localStorage.setItem("token", "demo_token");
          set((state) => { 
            state.user = dummyUser as User; 
            state.token = "demo_token"; 
            state.isAuthenticated = true; 
            state.workspaces = [{ id: "1", name: "Demo Workspace", role: "admin", created_at: new Date().toISOString() }];
            state.currentWorkspace = "1";
          });
          return;
        }
        throw e;
      }
    },

    fetchMe: async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      api.setToken(token);
      try {
        const user = await api.getMe();
        set((state) => { state.user = user as User; state.token = token; state.isAuthenticated = true; });
      } catch (e: any) {
        if (isDemoMode && (token === "demo_token" || e.message?.includes("fetch") || e.message?.includes("Failed to fetch"))) {
          const dummyUser = { id: "1", email: "admin@cloudlabos.ai", name: "Admin User", role: "admin" };
          set((state) => { 
            state.user = dummyUser as User; 
            state.token = "demo_token"; 
            state.isAuthenticated = true; 
            state.workspaces = [{ id: "1", name: "Demo Workspace", role: "admin", created_at: new Date().toISOString() }];
            state.currentWorkspace = "1";
          });
        } else {
          localStorage.removeItem("token");
        }
      }
    },

    fetchWorkspaces: async () => {
      try {
        const workspaces = await api.listWorkspaces();
        set((state) => { state.workspaces = workspaces; if (workspaces.length > 0 && !state.currentWorkspace) state.currentWorkspace = workspaces[0].id; });
      } catch (e) { console.error(e); }
    },

    fetchWorkflows: async () => {
      const ws = useStore.getState().currentWorkspace;
      if (!ws) return;
      try {
        const workflows = await api.listWorkflows(ws);
        set((state) => { state.workflows = workflows.map(w => ({ ...w, steps: 0, success_rate: undefined })) as Workflow[]; });
      } catch (e) { console.error(e); }
    },

    fetchExecuteWorkflow: async (workflowId, payload) => {
      const result = await api.executeWorkflow(workflowId, { input_payload: payload || {}, trigger_type: "manual" });
      return result.run_id;
    },

    fetchRuns: async (status) => {
      const ws = useStore.getState().currentWorkspace;
      if (!ws) return;
      try {
        const runs = await api.listRuns(ws, status);
        const runsRecord: Record<string, Run> = {}; const active: Run[] = []; const history: Run[] = [];
        for (const r of runs) {
          let progress = 0;
          if (r.status === "success") progress = 100;
          else if (r.status === "failed" || r.status === "cancelled") progress = 100;
          else if (r.status === "running") { try { const steps = await api.getRunSteps(r.id); progress = steps.length > 0 ? Math.round((steps.filter(s => s.status === "success" || s.status === "failed" || s.status === "skipped").length / steps.length) * 100) : 10; } catch { progress = 10; } }
          const run: Run = { ...r, progress, steps: [] };
          runsRecord[r.id] = run;
          if (r.status === "running") active.push(run); else history.push(run);
        }
        set((state) => { state.runs = runsRecord; state.activeRuns = active; state.runHistory = history; });
      } catch (e) { console.error(e); }
    },

    fetchRunSteps: async (runId) => {
      try { const steps = await api.getRunSteps(runId); return steps.map(s => ({ id: s.id, name: s.step_name, agent_type: s.agent_type, status: s.status as RunStep["status"], started_at: s.started_at || undefined, completed_at: s.completed_at || undefined, risk_score: s.risk_score || undefined, output: s.output_payload, error: s.error_message || undefined })); }
      catch (e) { console.error(e); return []; }
    },

    fetchCancelRun: async (runId) => {
      await api.cancelRun(runId);
      set((state) => {
        const run = state.runs[runId];
        if (run) run.status = "cancelled";
        state.activeRuns = state.activeRuns.filter((item) => item.id !== runId);
        if (run) state.runHistory = [run, ...state.runHistory.filter((item) => item.id !== runId)];
      });
    },

    fetchApprovals: async () => {
      const ws = useStore.getState().currentWorkspace;
      if (!ws) return;
      try {
        const approvals = await api.listApprovals(ws);
        set((state) => { state.approvals = approvals.map(a => ({ ...a, run_name: "", step_name: "", action: JSON.stringify(a.action_preview), risk_category: a.risk_score >= 0.7 ? "high" : a.risk_score >= 0.4 ? "medium" : "low", risk_reasons: [], requested_by: "system", requested_at: a.created_at, expires_at: "" })) as Approval[]; state.pendingApprovals = state.approvals.filter(a => a.status === "pending"); });
      } catch (e) { console.error(e); }
    },

    fetchApproveAction: async (approvalId, notes) => { await api.approveAction(approvalId, notes); set((state) => { const idx = state.approvals.findIndex(a => a.id === approvalId); if (idx >= 0) state.approvals[idx].status = "approved"; state.pendingApprovals = state.approvals.filter(a => a.status === "pending"); }); },
    fetchRejectAction: async (approvalId, notes) => { await api.rejectAction(approvalId, notes); set((state) => { const idx = state.approvals.findIndex(a => a.id === approvalId); if (idx >= 0) state.approvals[idx].status = "rejected"; state.pendingApprovals = state.approvals.filter(a => a.status === "pending"); }); },

    fetchMemory: async (contentType) => {
      const ws = useStore.getState().currentWorkspace;
      if (!ws) return;
      try {
        const items = await api.listMemory(ws, contentType);
        set((state) => { state.memoryItems = items.map(m => ({ id: String(m.id), content: m.content, content_type: m.content_type as MemoryItem["content_type"], source: "memory", run_id: m.run_id || undefined, created_at: m.created_at, score: 1.0, tags: m.tags || [] })); });
      } catch (e) { console.error(e); }
    },

    fetchMemorySearch: async (query) => {
      const ws = useStore.getState().currentWorkspace;
      if (!ws) return;
      try {
        const result = await api.searchMemory(query, ws);
        set((state) => { state.memorySearchResults = result.items.map(m => ({ id: String(m.id), content: m.content, content_type: m.content_type as MemoryItem["content_type"], source: "search", created_at: m.created_at || new Date().toISOString(), score: m.score, tags: m.tags || [] })); });
      } catch (e) { console.error(e); }
    },

    fetchDeleteMemory: async (memoryId) => { await api.deleteMemory(memoryId); set((state) => { state.memoryItems = state.memoryItems.filter(m => m.id !== String(memoryId)); }); },

    fetchAgents: async () => {
      try { const agents = await api.listAgents(); set((state) => { state.agents = agents as Agent[]; }); }
      catch {
        set((state) => { state.agents = [
          { id: "orchestrator", name: "Orchestrator", status: "active", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
          { id: "execution", name: "Execution", status: "idle", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
          { id: "security", name: "Security", status: "active", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
          { id: "vision", name: "Vision", status: "active", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
          { id: "planner", name: "Planner", status: "idle", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
          { id: "validation", name: "Validation", status: "active", tasks_total: 0, tasks_success: 0, tasks_failed: 0, avg_latency: "0s", current_task: "Idle", memory_usage: "0MB", uptime: "0m" },
        ]; });
      }
    },

    connectRunWebSocket: (runId) => {
      const state = useStore.getState();
      if (state._wsConnection) state._wsConnection.close();
      const ws = api.connectRunWebSocket(runId, (data) => {
        try {
          const event = JSON.parse(data);
          const currentState = useStore.getState();
          const run = currentState.runs[runId];
          if (run) {
            const updatedRun = { ...run, ...event } as Run;
            if (event.status === "success" || event.status === "failed" || event.status === "completed_with_errors") {
              updatedRun.progress = 100; updatedRun.completed_at = new Date().toISOString();
              set((state) => { state.runs[runId] = updatedRun; state.activeRuns = state.activeRuns.filter(r => r.id !== runId); state.runHistory = [updatedRun, ...state.runHistory.filter(r => r.id !== runId)]; });
            } else { updatedRun.progress = event.progress || run.progress; set((state) => { state.runs[runId] = updatedRun; }); }
          }
        } catch {}
      });
      set((state) => { state._wsConnection = ws; });
    },

    disconnectRunWebSocket: () => { const state = useStore.getState(); if (state._wsConnection) { state._wsConnection.close(); set((s) => { s._wsConnection = null; }); } },

    // New async actions
    fetchApiKeys: async () => { try { const keys = await api.listApiKeys(); set((state) => { state.apiKeys = keys; }); } catch (e) { console.error(e); } },
    fetchCreateApiKey: async (name) => { const result = await api.createApiKey(name); await useStore.getState().fetchApiKeys(); return result.raw_key; },
    fetchRevokeApiKey: async (id) => { await api.revokeApiKey(id); set((state) => { state.apiKeys = state.apiKeys.filter(k => k.id !== id); }); },
    fetchSessions: async () => { try { const sessions = await api.listSessions(); set((state) => { state.sessions = sessions; }); } catch (e) { console.error(e); } },
    fetchRevokeSession: async (id) => { await api.revokeSession(id); set((state) => { state.sessions = state.sessions.filter(s => s.id !== id); }); },
    fetchSubscription: async () => { try { const sub = await api.getSubscription(); set((state) => { state.subscription = sub; }); } catch { /* not subscribed */ } },
    fetchPlans: async () => { try { const plans = await api.getPlans(); set((state) => { state.plans = plans; }); } catch { set((state) => { state.plans = []; }); } },
    fetchUpdateSubscription: async (planId) => { await api.updateSubscription(planId); await useStore.getState().fetchSubscription(); },
    fetchNotifications: async () => { try { const result = await api.listNotifications(); set((state) => { state.notifications = result.notifications as Notification[]; state.unreadCount = result.notifications.filter(n => !n.is_read).length; }); } catch (e) { console.error(e); } },
    fetchMarkNotificationRead: async (id) => { await api.markNotificationRead(id); set((state) => { const n = state.notifications.find(n => n.id === id); if (n) n.is_read = true; state.unreadCount = state.notifications.filter(n => !n.is_read).length; }); },
    fetchMarkAllRead: async () => { await api.markAllNotificationsRead(); set((state) => { state.notifications.forEach(n => n.is_read = true); state.unreadCount = 0; }); },
    fetchWebhooks: async () => { const ws = useStore.getState().currentWorkspace; if (!ws) return; try { const webhooks = await api.listWebhooks(ws); set((state) => { state.webhooks = webhooks; }); } catch (e) { console.error(e); } },
    fetchMembers: async () => { const ws = useStore.getState().currentWorkspace; if (!ws) return; try { const members = await api.listMembers(ws); set((state) => { state.members = members; }); } catch (e) { console.error(e); } },
    fetchInviteMember: async (email, role) => { const ws = useStore.getState().currentWorkspace; if (!ws) return; await api.inviteMember(ws, email, role); await useStore.getState().fetchMembers(); },
    fetchRemoveMember: async (userId) => { const ws = useStore.getState().currentWorkspace; if (!ws) return; await api.removeMember(ws, userId); set((state) => { state.members = state.members.filter(m => m.id !== userId); }); },
  }))
);
