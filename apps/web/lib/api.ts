const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_MODE = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") !== null
  ? true
  : process.env.NEXT_PUBLIC_DEMO_MODE === "true";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;
    return headers;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open((options.method || "GET").toUpperCase(), `${API_BASE}${path}`, true);
      const headers = { ...this.getHeaders(), ...(options.headers as Record<string, string>) };
      for (const [k, v] of Object.entries(headers)) {
        xhr.setRequestHeader(k, v);
      }
      xhr.onload = () => {
        if (xhr.status === 204) return resolve(undefined as T);
        try {
          const body = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
          reject(new Error(`${body.detail || `HTTP ${xhr.status}`} [${path}]`));
        } catch {
          reject(new Error(`HTTP ${xhr.status} [${path}]`));
        }
      };
      xhr.onerror = () => {
        if (DEMO_MODE) resolve({} as T);
        else reject(new Error("Network error"));
      };
      if (options.body) xhr.send(options.body as string);
      else xhr.send();
    });
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string; user?: any }>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ access_token: string; refresh_token: string; user?: any }>("/api/v1/auth/register", {
      method: "POST", body: JSON.stringify({ email, password, name }),
    });
  }

  async refresh(refreshToken: string) {
    return this.request<{ access_token: string; refresh_token: string }>("/api/v1/auth/refresh", {
      method: "POST", body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async getMe() {
    return this.request<{ id: string; email: string; name: string; role: string; avatar_url?: string | null; mfa_enabled?: boolean }>("/api/v1/auth/me");
  }

  async setupMfa() {
    return this.request<{ secret: string; qr_code: string }>("/api/v1/auth/mfa/setup", { method: "POST" });
  }

  async verifyMfa(code: string) {
    return this.request<{ status: string }>("/api/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code }) });
  }

  async disableMfa() {
    return this.request<{ status: string }>("/api/v1/auth/mfa/disable", { method: "POST" });
  }

  async createApiKey(name: string) {
    return this.request<{ id: string; name: string; raw_key: string; key_prefix: string }>("/api/v1/auth/api-keys", { method: "POST", body: JSON.stringify({ name }) });
  }

  async requestPasswordReset(email: string) {
    return this.request<{ status: string }>("/api/v1/auth/password-reset", { method: "POST", body: JSON.stringify({ email }) });
  }

  // Workspaces
  async listWorkspaces() {
    return this.request<Array<{ id: string; name: string; role: string; description?: string | null; created_at: string }>>("/api/v1/workspaces/");
  }

  async createWorkspace(name: string, description?: string) {
    return this.request<{ id: string; name: string; role: string; created_at: string }>("/api/v1/workspaces/", { method: "POST", body: JSON.stringify({ name, description }) });
  }

  async getWorkspace(id: string) {
    return this.request<{ id: string; name: string; role: string; description?: string | null; created_at: string }>(`/api/v1/workspaces/${id}`);
  }

  async listMembers(workspaceId: string) {
    return this.request<Array<{ id: string; user_id: string; email: string; name: string; role: string; created_at: string }>>(`/api/v1/workspaces/${workspaceId}/members`);
  }

  async inviteMember(workspaceId: string, email: string, role: string) {
    return this.request<{ id: string; user_id: string; email: string; name: string; role: string; created_at: string }>(`/api/v1/workspaces/${workspaceId}/members`, { method: "POST", body: JSON.stringify({ email, role }) });
  }

  async removeMember(workspaceId: string, memberId: string) {
    return this.request<void>(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, { method: "DELETE" });
  }

  // Users
  async updateProfile(data: { name?: string; email?: string; avatar_url?: string | null }) {
    return this.request<{ id: string; email: string; name: string; role: string }>("/api/v1/users/me", { method: "PATCH", body: JSON.stringify(data) });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ status: string }>("/api/v1/users/change-password", { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
  }

  // Agents
  async listAgents(workspaceId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/agents/?workspace_id=${workspaceId}`);
  }

  async createAgent(workspaceId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/agents/?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) });
  }

  async getAgent(agentId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/agents/${agentId}`);
  }

  async updateAgent(agentId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async deleteAgent(agentId: string) {
    return this.request<void>(`/api/v1/agents/${agentId}`, { method: "DELETE" });
  }

  async addAgentTool(agentId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/agents/${agentId}/tools`, { method: "POST", body: JSON.stringify(data) });
  }

  async removeAgentTool(agentId: string, toolId: string) {
    return this.request<void>(`/api/v1/agents/${agentId}/tools/${toolId}`, { method: "DELETE" });
  }

  async invokeAgent(agentId: string, input: string, sessionId?: string) {
    return this.request<{ output: string; session_id: string }>(`/api/v1/agents/${agentId}/invoke`, { method: "POST", body: JSON.stringify({ input, session_id: sessionId }) });
  }

  async listAgentSessions(agentId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/agents/${agentId}/sessions`);
  }

  // Workflows
  async listWorkflows(workspaceId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/workflows/?workspace_id=${workspaceId}`);
  }

  async createWorkflow(workspaceId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/workflows/?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) });
  }

  async getWorkflow(workflowId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/workflows/${workflowId}`);
  }

  async updateWorkflow(workflowId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/workflows/${workflowId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async deleteWorkflow(workflowId: string) {
    return this.request<void>(`/api/v1/workflows/${workflowId}`, { method: "DELETE" });
  }

  async publishWorkflow(workflowId: string) {
    return this.request<{ status: string }>(`/api/v1/workflows/${workflowId}/publish`, { method: "POST" });
  }

  async executeWorkflow(workflowId: string) {
    return this.request<{ id: string; status: string }>(`/api/v1/workflows/${workflowId}/execute`, { method: "POST" });
  }

  async createWorkflowSchedule(workflowId: string, cron: string) {
    return this.request<{ id: string; cron: string; enabled: boolean }>(`/api/v1/workflows/${workflowId}/schedule`, { method: "POST", body: JSON.stringify({ cron }) });
  }

  async listWorkflowSchedules(workflowId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/workflows/${workflowId}/schedules`);
  }

  // Runs
  async listRuns(workspaceId: string, status?: string) {
    const params = status ? `?workspace_id=${workspaceId}&status=${status}` : `?workspace_id=${workspaceId}`;
    return this.request<Array<Record<string, unknown>>>(`/api/v1/workflows/runs/all${params}`);
  }

  async getRun(runId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/workflows/runs/${runId}`);
  }

  async cancelRun(runId: string) {
    return this.request<{ status: string }>(`/api/v1/workflows/runs/${runId}`, { method: "DELETE" });
  }

  async getRunSteps(runId: string) {
    const run = await this.request<{ steps?: Array<Record<string, unknown>> }>(`/api/v1/workflows/runs/${runId}`);
    return Array.isArray(run?.steps) ? run.steps : [];
  }

  // Memory
  async listCollections(workspaceId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/memory/collections?workspace_id=${workspaceId}`);
  }

  async createCollection(workspaceId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/memory/collections?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) });
  }

  async getCollection(collectionId: string) {
    return this.request<Record<string, unknown>>(`/api/v1/memory/collections/${collectionId}`);
  }

  async deleteCollection(collectionId: string) {
    return this.request<void>(`/api/v1/memory/collections/${collectionId}`, { method: "DELETE" });
  }

  async listMemoryItems(collectionId: string, limit = 50, offset = 0) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/memory/collections/${collectionId}/items?limit=${limit}&offset=${offset}`);
  }

  async createMemoryItem(collectionId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/memory/collections/${collectionId}/items`, { method: "POST", body: JSON.stringify(data) });
  }

  async deleteMemoryItem(collectionId: string, itemId: string) {
    return this.request<void>(`/api/v1/memory/collections/${collectionId}/items/${itemId}`, { method: "DELETE" });
  }

  async searchMemory(collectionId: string, query: string, topK = 10) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/memory/collections/${collectionId}/search`, { method: "POST", body: JSON.stringify({ query, top_k: topK }) });
  }

  // Approvals (placeholder endpoints)
  async listApprovals(workspaceId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/approvals/?workspace_id=${workspaceId}`);
  }

  async approveAction(approvalId: string, notes?: string) {
    return this.request<{ status: string }>(`/api/v1/approvals/${approvalId}/approve`, { method: "POST", body: JSON.stringify({ notes: notes || null }) });
  }

  async rejectAction(approvalId: string, notes?: string) {
    return this.request<{ status: string }>(`/api/v1/approvals/${approvalId}/reject`, { method: "POST", body: JSON.stringify({ notes: notes || null }) });
  }

  // Notifications (placeholder endpoints)
  async listNotifications() {
    return this.request<{ notifications: Array<Record<string, unknown>>; unread_count: number }>("/api/v1/notifications/");
  }

  async markNotificationRead(id: string) {
    return this.request<{ status: string }>(`/api/v1/notifications/${id}/read`, { method: "POST" });
  }

  async markAllNotificationsRead() {
    return this.request<{ status: string }>("/api/v1/notifications/read-all", { method: "POST" });
  }

  // Webhooks (placeholder endpoints)
  async listWebhooks(workspaceId: string) {
    return this.request<Array<Record<string, unknown>>>(`/api/v1/webhooks/?workspace_id=${workspaceId}`);
  }

  async createWebhook(workspaceId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/webhooks/?workspace_id=${workspaceId}`, { method: "POST", body: JSON.stringify(data) });
  }

  async updateWebhook(webhookId: string, data: Record<string, unknown>) {
    return this.request<Record<string, unknown>>(`/api/v1/webhooks/${webhookId}`, { method: "PATCH", body: JSON.stringify(data) });
  }

  async testWebhook(webhookId: string) {
    return this.request<{ status: string; duration: string }>(`/api/v1/webhooks/${webhookId}/test`, { method: "POST" });
  }

  async deleteWebhook(webhookId: string) {
    return this.request<void>(`/api/v1/webhooks/${webhookId}`, { method: "DELETE" });
  }

  // Billing (placeholder endpoints)
  async getPlans() {
    return this.request<Array<Record<string, unknown>>>("/api/v1/billing/plans");
  }

  async getSubscription() {
    return this.request<Record<string, unknown>>("/api/v1/billing/subscription");
  }

  async updateSubscription(planId: string) {
    return this.request<Record<string, unknown>>("/api/v1/billing/subscription", { method: "PUT", body: JSON.stringify({ plan_id: planId }) });
  }

  // Browser
  async listBrowserSessions() {
    const browserUrl = process.env.NEXT_PUBLIC_BROWSER_URL || "http://localhost:8004";
    return new Promise<{ sessions: number }>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${browserUrl}/health`, true);
      xhr.timeout = 3000;
      xhr.onload = () => {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve({ sessions: 0 }); }
      };
      xhr.onerror = () => resolve({ sessions: 0 });
      xhr.ontimeout = () => resolve({ sessions: 0 });
      xhr.send();
    });
  }

  // Plugins (placeholder endpoints)
  async listPlugins() {
    return this.request<Array<Record<string, unknown>>>("/api/v1/plugins/");
  }

  // Settings
  async getSettings() {
    return this.request<{ theme: string; language: string }>("/api/v1/settings/");
  }

  async updateSettings(data: Record<string, unknown>) {
    return this.request<{ theme: string; language: string }>("/api/v1/settings/", { method: "PATCH", body: JSON.stringify(data) });
  }

  // Status
  async getStatus() {
    return this.request<{ status: string; version: string }>("/health");
  }
}

export const api = new ApiClient();
