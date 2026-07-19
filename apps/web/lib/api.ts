const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    if (DEMO_MODE && this.token === "demo_token") {
      const method = options.method || "GET";
      
      // Parse body if present
      let bodyData: any = {};
      try {
        if (options.body) bodyData = JSON.parse(options.body as string);
      } catch {}

      if (path.includes("/auth/me")) return { id: "1", email: "admin@cloudlabos.ai", name: "Admin User", role: "admin" } as any;
      
      if (path.startsWith("/api/v1/workspaces")) {
        if (method === "POST") {
          return { id: "ws_" + Math.random().toString(36).substr(2, 9), name: bodyData.name || "New Workspace" } as any;
        }
        return [
          { id: "ws_prod", name: "Production Cluster", role: "admin", created_at: "2026-05-12T12:00:00Z", description: "Main cluster hosting production workflows." },
          { id: "ws_staging", name: "Staging Area", role: "admin", created_at: "2026-06-01T15:30:00Z", description: "Pre-production testing workspace." }
        ] as any;
      }
      
      if (path.includes("/agents")) return [
        { id: "orch_1", name: "Workflow Orchestrator", status: "active", tasks_total: 14205, tasks_success: 14190, tasks_failed: 15, avg_latency: "0.2s", current_task: "Polling active queues", memory_usage: "180MB", uptime: "15d" },
        { id: "sec_auditor", name: "Security Auditor", status: "active", tasks_total: 824, tasks_success: 824, tasks_failed: 0, avg_latency: "1.5s", current_task: "Auditing dependency trees", memory_usage: "210MB", uptime: "5d" },
        { id: "code_executor", name: "Python Sandbox Sandboxer", status: "idle", tasks_total: 9423, tasks_success: 9152, tasks_failed: 271, avg_latency: "2.4s", current_task: "Idle", memory_usage: "310MB", uptime: "12d" },
        { id: "web_agent", name: "Playwright Web Agent", status: "busy", tasks_total: 219, tasks_success: 198, tasks_failed: 21, avg_latency: "5.8s", current_task: "Retrieving YouTube description markup", memory_usage: "512MB", uptime: "1d" },
        { id: "mem_indexer", name: "Vector Indexer", status: "active", tasks_total: 51208, tasks_success: 51208, tasks_failed: 0, avg_latency: "0.08s", current_task: "Indexing semantic logs", memory_usage: "1024MB", uptime: "22d" }
      ] as any;
      
      if (path.includes("/runs")) {
        if (path.includes("/steps")) {
          // Returning steps for AI Summary Generator or fallback
          return [
            { id: "step_1", step_name: "Query Production Database", agent_type: "code_executor", status: "success", input_payload: { query: "SELECT * FROM sales" }, output_payload: { count: 12480, sum_total: 489320 }, error_message: null, risk_score: 0.1, started_at: "2026-07-18T11:50:00Z", completed_at: "2026-07-18T11:50:04Z" },
            { id: "step_2", step_name: "Fetch Active User Metrics", agent_type: "code_executor", status: "success", input_payload: { active_window: "24h" }, output_payload: { dau: 14820, mau: 254890 }, error_message: null, risk_score: 0.05, started_at: "2026-07-18T11:50:04Z", completed_at: "2026-07-18T11:50:06Z" },
            { id: "step_3", step_name: "Analyze CPU & Memory Logs", agent_type: "mem_indexer", status: "success", input_payload: {}, output_payload: { cpu_avg: "34%", mem_avg: "62%", healthy: true }, error_message: null, risk_score: 0.2, started_at: "2026-07-18T11:50:06Z", completed_at: "2026-07-18T11:50:12Z" },
            { id: "step_4", step_name: "Draft Summary Email", agent_type: "orch_1", status: "success", input_payload: {}, output_payload: { body: "CloudLabOS Status: Active user count has grown to 14,820 today (up 4.2%). Production database queries are stable. System resources are normal." }, error_message: null, risk_score: 0.15, started_at: "2026-07-18T11:50:12Z", completed_at: "2026-07-18T11:50:24Z" },
            { id: "step_5", step_name: "Send Summary Email (Sign-off)", agent_type: "orch_1", status: "pending", input_payload: { to: "exec-team@cloudlabos.ai" }, output_payload: null, error_message: null, risk_score: 0.45, started_at: "2026-07-18T11:50:24Z", completed_at: null }
          ] as any;
        }
        return [
          { id: "run_summary", workflow_id: "wf_summary", workflow_name: "AI Daily Executive Summary Generator", status: "running", trigger_type: "manual", started_at: "2026-07-18T11:50:00Z", completed_at: null, progress: 80 },
          { id: "run_leads", workflow_id: "wf_leads", workflow_name: "Sync Leads: Stripe to HubSpot CRM", status: "success", trigger_type: "event", started_at: "2026-07-18T09:12:00Z", completed_at: "2026-07-18T09:12:45Z", progress: 100 },
          { id: "run_scan", workflow_id: "wf_scan", workflow_name: "Auto-Scan Infrastructure Vulnerabilities", status: "success", trigger_type: "schedule", started_at: "2026-07-18T05:00:00Z", completed_at: "2026-07-18T05:08:12Z", progress: 100 },
          { id: "run_scan_fail", workflow_id: "wf_scan", workflow_name: "Auto-Scan Infrastructure Vulnerabilities", status: "failed", trigger_type: "manual", started_at: "2026-07-17T22:15:00Z", completed_at: "2026-07-17T22:16:30Z", progress: 100 }
        ] as any;
      }
      
      if (path.includes("/approvals")) return [
        { id: "app_summary", run_id: "run_summary", step_id: "step_5", status: "pending", risk_score: 0.45, risk_summary: "Manual approval needed to dispatch final summary report email to 12 executive addresses.", action_preview: { to: "exec-team@cloudlabos.ai", subject: "CloudLabOS Daily Summary Report - 2026-07-18", model_tokens_used: 14205 }, created_at: "2026-07-18T11:50:24Z" }
      ] as any;
      
      if (path.includes("/workflows")) {
        if (path.endsWith("/execute")) {
          return { run_id: "run_" + Math.random().toString(36).substr(2, 9), status: "running" } as any;
        }
        if (method === "POST") {
          return { id: "wf_" + Math.random().toString(36).substr(2, 9), name: bodyData.name || "New Workflow", description: bodyData.description, status: "draft", version: 1, created_at: new Date().toISOString() } as any;
        }
        return [
          { id: "wf_scan", name: "Auto-Scan Infrastructure Vulnerabilities", description: "Scans Kubernetes clusters, audits Docker container packages, and formats system vulnerabilities in a Slack digest report.", status: "active", version: 3, created_at: "2026-07-10T12:00:00Z", updated_at: "2026-07-15T08:30:00Z" },
          { id: "wf_leads", name: "Sync Leads: Stripe to HubSpot CRM", description: "Monitors Stripe payment checkout webhooks, checks if contacts exist in HubSpot CRM, updates pipelines and notifies Sales.", status: "active", version: 1, created_at: "2026-07-12T14:20:00Z", updated_at: "2026-07-12T14:20:00Z" },
          { id: "wf_summary", name: "AI Daily Executive Summary Generator", description: "Performs hourly checkins, queries system KPIs, feeds metrics to OpenRouter Gemini, and drafts executive emails.", status: "active", version: 2, created_at: "2026-07-08T09:00:00Z", updated_at: "2026-07-14T11:15:00Z" },
          { id: "wf_backup", name: "PostgreSQL Database Auto-Backup", description: "Performs pg_dump at midnight daily, encrypts the file stream, and transfers archiving dumps to Google Cloud Storage buckets.", status: "draft", version: 1, created_at: "2026-07-17T16:45:00Z", updated_at: "2026-07-17T16:45:00Z" }
        ] as any;
      }
      
      if (path.includes("/notifications")) return { notifications: [], total: 0, page: 1, limit: 20 } as any;
      if (path.includes("/memory/search")) return { items: [], query: "", count: 0 } as any;
      if (path.includes("/billing/plans")) return [] as any;
      if (path.includes("/billing/subscription")) return { plan: "pro", status: "active" } as any;
      
      if (path.includes("/api-keys")) {
        if (method === "POST") {
          return { id: "key_" + Math.random().toString(36).substr(2, 9), name: bodyData.name || "New API Key", raw_key: "clk_" + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() } as any;
        }
        return [] as any;
      }
      
      if (path.includes("/sessions")) return [] as any;
      
      if (path.includes("/webhooks")) {
        if (method === "POST") {
          return { id: "wh_" + Math.random().toString(36).substr(2, 9), name: bodyData.name || "New Webhook", url: bodyData.url } as any;
        }
        return [] as any;
      }
      
      if (path.includes("/members")) return [] as any;
      if (path.includes("/plugins")) return [] as any;
      if (path.includes("/logs")) return { logs: [], total: 0 } as any;
      
      if (path.includes("/settings")) return { theme: "dark", language: "en", notifications_enabled: true, auto_approve_low_risk: false, session_timeout_minutes: 60, max_concurrent_workflows: 10 } as any;
      if (path.includes("/mfa/setup")) return { secret: "JBSWY3DPEHPK3PXP", qr_uri: "otpauth://totp/CloudLabOS:admin@cloudlabos.ai?secret=JBSWY3DPEHPK3PXP&issuer=CloudLabOS" } as any;
      if (path.includes("/mfa/verify")) return { verified: true } as any;
      if (path.includes("/mfa/disable")) return { disabled: true } as any;
      if (path.includes("/status")) return { gateway: { status: "online", latency_ms: 5 } } as any;
      
      return {} as any;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || `API error: ${res.status}`);
    }

    return res.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ access_token: string; token_type: string }>(
      `/api/v1/auth/login`,
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
  }

  async register(email: string, password: string, name: string) {
    return this.request<{ access_token: string; token_type: string }>(
      `/api/v1/auth/register`,
      { method: "POST", body: JSON.stringify({ email, password, name }) }
    );
  }

  async getMe() {
    return this.request<{
      id: string;
      email: string;
      name: string;
      role: string;
    }>("/api/v1/auth/me");
  }

  async sendVerificationEmail() {
    return this.request<{ sent: boolean; message: string }>(
      "/api/v1/auth/verify-email/send", { method: "POST" }
    );
  }

  async confirmEmail(code: string) {
    return this.request<{ verified: boolean }>(
      "/api/v1/auth/verify-email/confirm",
      { method: "POST", body: JSON.stringify({ code }) }
    );
  }

  async requestPasswordReset(email: string) {
    return this.request<{ sent: boolean }>(
      "/api/v1/auth/password-reset/request",
      { method: "POST", body: JSON.stringify({ email }) }
    );
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    return this.request<{ reset: boolean }>(
      "/api/v1/auth/password-reset/confirm",
      { method: "POST", body: JSON.stringify({ token, new_password: newPassword }) }
    );
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ updated: boolean }>(
      "/api/v1/auth/change-password",
      { method: "POST", body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) }
    );
  }

  async setupMfa() {
    return this.request<{ secret: string; qr_code: string }>(
      "/api/v1/auth/mfa/setup", { method: "POST" }
    );
  }

  async verifyMfa(code: string) {
    return this.request<{ verified: boolean }>(
      "/api/v1/auth/mfa/verify",
      { method: "POST", body: JSON.stringify({ code }) }
    );
  }

  async disableMfa() {
    return this.request<{ disabled: boolean }>(
      "/api/v1/auth/mfa/disable", { method: "POST" }
    );
  }

  async listApiKeys() {
    return this.request<Array<{ id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null }>>(
      "/api/v1/auth/api-keys"
    );
  }

  async createApiKey(name: string) {
    return this.request<{ id: string; name: string; raw_key: string; created_at: string }>(
      "/api/v1/auth/api-keys",
      { method: "POST", body: JSON.stringify({ name }) }
    );
  }

  async revokeApiKey(id: string) {
    return this.request<{ revoked: boolean }>(
      `/api/v1/auth/api-keys/${id}`, { method: "DELETE" }
    );
  }

  async listSessions() {
    return this.request<Array<{ id: string; created_at: string; last_used_at: string | null; ip_address: string; user_agent: string }>>(
      "/api/v1/auth/sessions"
    );
  }

  async revokeSession(id: string) {
    return this.request<{ revoked: boolean }>(
      `/api/v1/auth/sessions/${id}`, { method: "DELETE" }
    );
  }

  // Workspaces
  async listWorkspaces() {
    return this.request<Array<{ id: string; name: string; role: string; created_at: string; description?: string }>>(
      "/api/v1/workspaces"
    );
  }

  async createWorkspace(name: string) {
    return this.request<{ id: string; name: string }>(
      "/api/v1/workspaces",
      { method: "POST", body: JSON.stringify({ name }) }
    );
  }

  async inviteMember(workspaceId: string, email: string, role: string) {
    return this.request<{ invitation_id: string; message: string }>(
      `/api/v1/workspaces/${workspaceId}/invite`,
      { method: "POST", body: JSON.stringify({ email, role }) }
    );
  }

  async acceptInvitation(token: string) {
    return this.request<{ workspace_id: string; role: string }>(
      `/api/v1/workspaces/invitations/${token}/accept`,
      { method: "POST" }
    );
  }

  async listMembers(workspaceId: string) {
    return this.request<Array<{ id: string; name: string; email: string; role: string; joined_at: string }>>(
      `/api/v1/workspaces/${workspaceId}/members`
    );
  }

  async removeMember(workspaceId: string, userId: string) {
    return this.request<{ removed: boolean }>(
      `/api/v1/workspaces/${workspaceId}/members/${userId}`,
      { method: "DELETE" }
    );
  }

  // Workflows
  async listWorkflows(workspaceId: string) {
    return this.request<Array<{
      id: string; name: string; description: string; status: string;
      version: number; created_at: string; updated_at: string;
    }>>(`/api/v1/workflows?workspace_id=${workspaceId}`);
  }

  async getWorkflow(id: string) {
    return this.request<{
      id: string; name: string; description: string;
      definition: Record<string, unknown>; status: string; version: number;
    }>(`/api/v1/workflows/${id}`);
  }

  async createWorkflow(workspaceId: string, data: { name: string; description?: string; definition: Record<string, unknown> }) {
    return this.request<{ id: string; name: string }>(
      `/api/v1/workflows?workspace_id=${workspaceId}`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async publishWorkflow(id: string) {
    return this.request<{ id: string; status: string; version: number }>(`/api/v1/workflows/${id}/publish`, { method: "POST" });
  }

  async createWorkflowSchedule(id: string, cron_expression: string, timezone: string = "UTC") {
    return this.request<{ id: string; workflow_id: string; enabled: boolean }>(
      `/api/v1/workflows/${id}/schedules`, { method: "POST", body: JSON.stringify({ cron_expression, timezone }) }
    );
  }

  async executeWorkflow(workflowId: string, data: { input_payload?: Record<string, unknown>; trigger_type?: string; approval_mode?: string }) {
    return this.request<{ run_id: string; status: string }>(
      `/api/v1/workflows/${workflowId}/execute`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  // Runs
  async listRuns(workspaceId: string, status?: string) {
    const params = new URLSearchParams({ workspace_id: workspaceId });
    if (status) params.set("status", status);
    return this.request<Array<{
      id: string; workflow_id: string; workflow_name: string;
      status: string; trigger_type: string;
      started_at: string | null; completed_at: string | null;
    }>>(`/api/v1/runs?${params}`);
  }

  async getRun(runId: string) {
    return this.request<{
      id: string; workflow_id: string; workflow_name: string;
      status: string; trigger_type: string;
      input_payload: Record<string, unknown>;
      output_payload: Record<string, unknown> | null;
      started_at: string | null; completed_at: string | null;
    }>(`/api/v1/runs/${runId}`);
  }

  async getRunSteps(runId: string) {
    return this.request<Array<{
      id: string; step_name: string; agent_type: string; status: string;
      input_payload: Record<string, unknown>;
      output_payload: Record<string, unknown> | null;
      error_message: string | null; risk_score: number | null;
      started_at: string | null; completed_at: string | null;
    }>>(`/api/v1/runs/${runId}/steps`);
  }

  async cancelRun(runId: string) {
    return this.request<{ id: string; status: string }>(
      `/api/v1/runs/${runId}/cancel`, { method: "POST" }
    );
  }

  // Approvals
  async listApprovals(workspaceId: string) {
    return this.request<Array<{
      id: string; run_id: string; step_id: string; status: string;
      risk_score: number; risk_summary: string;
      action_preview: Record<string, unknown>; created_at: string;
    }>>(`/api/v1/approvals?workspace_id=${workspaceId}`);
  }

  async approveAction(approvalId: string, notes?: string) {
    return this.request<{ status: string; workflow_resumed: boolean }>(
      `/api/v1/approvals/${approvalId}/approve`,
      { method: "POST", body: JSON.stringify({ reviewer_notes: notes || null }) }
    );
  }

  async rejectAction(approvalId: string, notes?: string) {
    return this.request<{ status: string; rollback_triggered: boolean }>(
      `/api/v1/approvals/${approvalId}/reject`,
      { method: "POST", body: JSON.stringify({ reviewer_notes: notes || null }) }
    );
  }

  // Memory
  async listMemory(workspaceId: string, contentType?: string) {
    const params = new URLSearchParams();
    if (contentType) params.set("content_type", contentType);
    return this.request<Array<{
      id: number; content: string; content_type: string;
      metadata: Record<string, unknown>; tags: string[];
      run_id: string | null; created_at: string;
    }>>(`/api/v1/memory/${workspaceId}?${params}`);
  }

  async searchMemory(query: string, workspaceId: string, k: number = 5) {
    return this.request<{
      items: Array<{
        id: number; score: number; content: string; content_type: string;
        metadata: Record<string, unknown>; tags: string[]; created_at: string | null;
      }>; query: string; count: number;
    }>(`/api/v1/memory/search?q=${encodeURIComponent(query)}&workspace_id=${workspaceId}&k=${k}`);
  }

  async deleteMemory(memoryId: number) {
    return this.request<{ deleted: boolean }>(
      `/api/v1/memory/${memoryId}`, { method: "DELETE" }
    );
  }

  // WebSocket
  connectRunWebSocket(runId: string, onMessage: (data: string) => void) {
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000").replace("http", "ws");
    const ws = new WebSocket(`${wsUrl}/ws/runs/${runId}?token=${this.token}`);
    ws.onmessage = (event) => onMessage(event.data);
    ws.onerror = (error) => console.error("WebSocket error:", error);
    return ws;
  }

  // Agents
  async listAgents() {
    return this.request<Array<{
      id: string; name: string; status: string; tasks_total: number;
      tasks_success: number; tasks_failed: number; avg_latency: string;
      current_task: string; memory_usage: string; uptime: string;
    }>>("/api/v1/agents");
  }

  async getAgentEvents(agentId: string, limit: number = 20) {
    return this.request<Array<{ id: string; data: Record<string, string> }>>(
      `/api/v1/agents/${agentId}/events?limit=${limit}`
    );
  }

  // Logs
  async listLogs(options: { service?: string; level?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    if (options.service) params.set("service", options.service);
    if (options.level) params.set("level", options.level);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    return this.request<{
      logs: Array<{
        id: string; action: string; resource_type: string;
        resource_id: string; payload: Record<string, unknown>; created_at: string;
      }>; total: number; limit: number; offset: number;
    }>(`/api/v1/logs?${params}`);
  }

  // Plugins
  async listPlugins(workspaceId?: string) {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspace_id", workspaceId);
    return this.request<Array<{
      id: string; name: string; version: string; status: string; installed_at: string;
    }>>(`/api/v1/plugins?${params}`);
  }

  async installPlugin(pluginId: string) {
    return this.request<{ installed: boolean }>(
      `/api/v1/plugins/${pluginId}/install`, { method: "POST" }
    );
  }

  async uninstallPlugin(pluginId: string) {
    return this.request<{ uninstalled: boolean }>(
      `/api/v1/plugins/${pluginId}/uninstall`, { method: "POST" }
    );
  }

  // Settings
  async getSettings() {
    return this.request<Record<string, unknown>>("/api/v1/settings");
  }

  async updateSettings(settings: Record<string, unknown>) {
    return this.request<{ updated: boolean }>(
      "/api/v1/settings",
      { method: "PUT", body: JSON.stringify(settings) }
    );
  }

  // Browser
  async listBrowserSessions() {
    try {
      const browserUrl = process.env.NEXT_PUBLIC_BROWSER_URL || "http://localhost:8004";
      const res = await fetch(`${browserUrl}/health`);
      return res.json();
    } catch {
      return { sessions: 0 };
    }
  }

  // Billing
  async getPlans() {
    return this.request<Array<{
      id: string; name: string; price: number; interval: string;
      features: string[]; limits: Record<string, number>;
    }>>("/api/v1/billing/plans");
  }

  async getSubscription() {
    return this.request<{
      plan: string; status: string; current_period_start: string;
      current_period_end: string; cancel_at_period_end: boolean;
    }>("/api/v1/billing/subscription");
  }

  async updateSubscription(planId: string) {
    return this.request<{ subscription_id: string; status: string }>(
      "/api/v1/billing/subscription",
      { method: "POST", body: JSON.stringify({ plan_id: planId }) }
    );
  }

  async createCheckoutSession(planId: string) {
    return this.request<{ url: string; session_id: string }>(
      "/api/v1/billing/checkout",
      { method: "POST", body: JSON.stringify({ plan_id: planId }) }
    );
  }

  async listInvoices() {
    return this.request<Array<{
      id: string; amount: number; currency: string; status: string;
      paid_at: string | null; invoice_pdf: string | null;
    }>>("/api/v1/billing/invoices");
  }

  // Webhooks
  async listWebhooks(workspaceId: string) {
    return this.request<Array<{
      id: string; name: string; url: string; events: string[];
      is_active: boolean; created_at: string;
    }>>(`/api/v1/webhooks?workspace_id=${workspaceId}`);
  }

  async createWebhook(workspaceId: string, data: { name: string; url: string; events: string[]; secret?: string }) {
    return this.request<{ id: string; name: string; url: string }>(
      `/api/v1/webhooks?workspace_id=${workspaceId}`,
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async deleteWebhook(id: string) {
    return this.request<{ deleted: boolean }>(
      `/api/v1/webhooks/${id}`, { method: "DELETE" }
    );
  }

  async getWebhookLogs(id: string) {
    return this.request<Array<{
      id: string; event: string; response_status: number;
      delivered_at: string;
    }>>(`/api/v1/webhooks/${id}/logs`);
  }

  // Notifications
  async listNotifications(page: number = 1, limit: number = 20) {
    return this.request<{
      notifications: Array<{
        id: string; type: string; title: string; message: string;
        data: Record<string, unknown>; is_read: boolean; created_at: string;
      }>; total: number; page: number; limit: number;
    }>(`/api/v1/notifications?page=${page}&limit=${limit}`);
  }

  async markNotificationRead(id: string) {
    return this.request<{ updated: boolean }>(
      `/api/v1/notifications/${id}/read`, { method: "PUT" }
    );
  }

  async markAllNotificationsRead() {
    return this.request<{ updated: boolean }>(
      "/api/v1/notifications/read-all", { method: "PUT" }
    );
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>("/api/v1/notifications/unread-count");
  }

  // Usage
  async getUsage(workspaceId: string) {
    return this.request<{
      runs_count: number; storage_mb: number; api_calls: number;
      period_start: string; period_end: string;
    }>(`/api/v1/usage?workspace_id=${workspaceId}`);
  }

  // Status
  async getSystemStatus() {
    return this.request<Record<string, { status: string; latency_ms: number }>>(
      "/api/v1/status"
    );
  }

  // GDPR
  async exportUserData() {
    return this.request<Record<string, unknown>>("/api/v1/gdpr/data-export");
  }

  async deleteUserData() {
    return this.request<{ deleted: boolean; message: string }>(
      "/api/v1/gdpr/data-deletion", { method: "DELETE" }
    );
  }

  // Export
  async exportWorkflows() {
    return this.request<Array<Record<string, unknown>>>("/api/v1/export/workflows");
  }

  async exportRuns() {
    return this.request<Array<Record<string, unknown>>>("/api/v1/export/runs");
  }
}

export const api = new ApiClient();
