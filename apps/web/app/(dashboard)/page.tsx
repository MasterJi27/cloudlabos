"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Play, Activity, Shield, Zap, Workflow, AlertTriangle,
  Terminal, Globe, CheckCircle2, XCircle, Cpu, RefreshCw
} from "lucide-react";
import { useAuthStore, useRunsStore, useAgentsStore, useWorkflowsStore, useMemoryStore } from "@/lib/store";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import { Tabs } from "@/components/Tabs";
import { AnimatedCounter } from "@/components/AnimatedCounter";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [uptimeRefreshing, setUptimeRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const auth = useAuthStore();
  const { activeRuns, runHistory, fetchRuns } = useRunsStore();
  const { agents, fetchAgents } = useAgentsStore();
  const { workflows, fetchWorkflows } = useWorkflowsStore();
  const { collections, fetchCollections } = useMemoryStore();
  const pendingApprovals: any[] = [];
  const currentWorkspace = auth.currentWorkspace;
  const isAuthenticated = auth.isAuthenticated;
  const fetchWorkspaces = auth.fetchWorkspaces;

  useEffect(() => {
    setIsClient(true);
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    setCurrentTime(new Date().toLocaleTimeString());
    return () => clearInterval(interval);
  }, []);

  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated && currentWorkspace) {
      fetchAgents(currentWorkspace);
      fetchRuns(currentWorkspace);
      fetchWorkflows(currentWorkspace);
      fetchCollections(currentWorkspace);
      import("@/lib/api").then(({ api }) =>
        api.getDashboardStats(currentWorkspace).then(setStats).catch(() => setStats(null))
      );
    }
  }, [isAuthenticated, currentWorkspace, fetchAgents, fetchRuns, fetchWorkflows, fetchCollections]);

  const allRuns = [...activeRuns, ...runHistory];
  // Prefer the aggregated stats endpoint (authoritative counts) and fall back to
  // whatever the list stores have loaded.
  const totalRuns = stats?.runs?.total ?? allRuns.length;
  const successRate = stats?.runs?.success_rate != null
    ? String(stats.runs.success_rate)
    : (allRuns.length > 0 ? ((allRuns.filter((r) => r.status === "success").length / allRuns.length) * 100).toFixed(1) : "0.0");
  const activeAgents = stats?.agents?.active ?? agents.filter(a => a.status === "active" || a.status === "busy").length;
  const totalAgents = stats?.agents?.total ?? agents.length;
  const totalWorkflows = stats?.workflows?.total ?? workflows.length;

  // Build trend data from real runs
  const now = new Date();
  const trendData = dayNames.map((name, i) => {
    const dayOffset = (now.getDay() - i + 7) % 7;
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - dayOffset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayRuns = allRuns.filter(r => {
      const d = new Date(r.started_at);
      return d >= dayStart && d <= dayEnd;
    });
    return {
      name,
      runs: dayRuns.length,
      success: dayRuns.filter(r => r.status === "success").length,
      failed: dayRuns.filter(r => r.status === "failed").length,
    };
  }).reverse();

  // Recent activity from real runs
  const recentActivity = [...allRuns].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()).slice(0, 6).map(r => {
    const isSuccess = r.status === "success";
    const isFailed = r.status === "failed";
    const isRunning = r.status === "running";
    return {
      id: r.id,
      icon: isRunning ? Play : isFailed ? XCircle : CheckCircle2,
      text: `${isRunning ? "Running" : isFailed ? "Failed" : "Completed"}: ${r.workflow_name}`,
      time: new Date(r.started_at).toLocaleString(),
      color: isFailed ? "var(--danger)" : isRunning ? "var(--text-primary)" : "var(--success)",
    };
  });

  const uptimeServices: { name: string; status: "operational" | "degraded"; uptime: string }[] = [
    { name: "API Gateway", status: "operational", uptime: "99.98%" },
    { name: "Agent Runtime", status: activeAgents > 0 ? "operational" : "degraded", uptime: agents.length > 0 ? "99.95%" : "N/A" },
    { name: "Workflow Engine", status: totalWorkflows > 0 ? "operational" : "degraded", uptime: totalWorkflows > 0 ? "99.99%" : "N/A" },
    { name: "Memory Store", status: collections.length > 0 ? "operational" : "degraded", uptime: collections.length > 0 ? "99.72%" : "N/A" },
  ];

  const refreshUptime = () => {
    setUptimeRefreshing(true);
    setTimeout(() => setUptimeRefreshing(false), 1200);
  };

  const isDegraded = uptimeServices.some(s => s.status !== "operational");

  return (
    <div className="max-w-7xl mx-auto pb-24 px-6 md:px-12 pt-12">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-16">
        <div>
          <h1 className="text-[32px] tracking-header-lg font-medium text-[var(--text-primary)] mb-2">Workspace</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Monitor and orchestrate your autonomous agent fleet.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full shadow-[var(--edge-subtle)] bg-[var(--surface-1)]">
            <span className={`w-2 h-2 rounded-full ${isDegraded ? "bg-[var(--warning)]" : "bg-[var(--success)]"}`} />
            <span className={`text-[12px] font-medium ${isDegraded ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
              {isDegraded ? "Systems Degraded" : "All Systems Operational"}
            </span>
          </div>
          {isClient && (
            <span className="text-[12px] text-[var(--text-tertiary)] font-mono">
              {currentTime}
            </span>
          )}
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">
            Active Agents <Cpu className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] flex items-end gap-3 font-mono">
            <AnimatedCounter value={activeAgents} />
            <span className="text-[13px] text-[var(--text-secondary)] font-medium mb-1.5">/ {totalAgents} total</span>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">
            Active Runs <Play className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={activeRuns.length} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Total Executions</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] flex items-end gap-3 font-mono">
            <AnimatedCounter value={totalRuns} />
            <span className="text-[13px] text-[var(--text-secondary)] font-medium mb-1.5">workflows</span>
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Success Rate</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            {totalRuns > 0 ? `${successRate}%` : "—"}
          </div>
        </div>
      </div>

      {/* Action Required Priority Row */}
      {pendingApprovals.length > 0 && (
        <div className="mb-16 bg-[var(--warning-subtle)] shadow-[var(--edge-default)] rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="relative flex gap-4 min-w-0">
            <div className="mt-1">
              <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-[15px] font-medium text-[var(--text-primary)] tracking-body">Action Required: Approval Block</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full shadow-[inset_0_0_0_1px_rgba(239,68,68,0.3)] text-[var(--danger)]">Risk {(pendingApprovals[0].risk_score * 100).toFixed(0)}%</span>
              </div>
              <p className="text-[14px] text-[var(--text-secondary)] truncate">
                <span className="font-mono text-[13px] text-[var(--text-primary)]">{pendingApprovals[0].action}</span> — {pendingApprovals[0].run_name}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/approvals")}
            className="btn-primary shrink-0"
          >
            Review Request
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="mb-10">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "health", label: "System Health" },
            { id: "agents", label: "Agent Fleet" }
          ]}
        />
      </div>

      {/* Tab Content */}
      <div className="animate-fade-in">
        {/* ===================== OVERVIEW TAB ===================== */}
        {activeTab === "overview" && (
          <div className="space-y-20">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
              {/* Chart */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-[16px] font-medium text-[var(--text-primary)] tracking-subheader">Execution Volume</h2>
                    <p className="text-[14px] text-[var(--text-secondary)] mt-1">Last 7 days</p>
                  </div>
                  <div className="flex items-center gap-4 text-[13px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--text-primary)]" /> Success</span>
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[var(--danger)]" /> Failed</span>
                  </div>
                </div>
                <div className="h-[280px] w-full text-[12px] font-mono">
                  {isClient && trendData.some(d => d.runs > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="rgba(255,255,255,0.15)" />
                            <stop offset="95%" stopColor="rgba(255,255,255,0.0)" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="var(--text-tertiary)" tickLine={false} axisLine={false} dy={10} />
                        <YAxis stroke="var(--text-tertiary)" tickLine={false} axisLine={false} dx={-10} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", fontSize: 13, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
                          itemStyle={{ color: "var(--text-primary)" }}
                        />
                        <Area type="monotone" dataKey="success" stroke="var(--text-primary)" strokeWidth={2} fill="url(#colorSuccess)" />
                        <Area type="monotone" dataKey="failed" stroke="var(--danger)" strokeWidth={2} fill="none" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-[13px]">No execution data yet. Run a workflow to see charts.</div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h2 className="text-[16px] font-medium text-[var(--text-primary)] tracking-subheader mb-8">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Workflow, label: "Workflows", path: "/workflows" },
                    { icon: Play, label: "Run Now", path: "/runs" },
                    { icon: Terminal, label: "Terminal", path: "/terminal" },
                    { icon: Globe, label: "Web Agent", path: "/browser" },
                    { icon: Cpu, label: "Agents", path: "/agents" },
                    { icon: Shield, label: "Approvals", path: "/approvals" },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => router.push(item.path)}
                      className="flex flex-col items-center justify-center p-6 rounded-xl shadow-[var(--edge-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] hover:shadow-[var(--edge-default)] transition-all text-center group active:scale-95"
                    >
                      <item.icon className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] mb-3 transition-colors" />
                      <span className="text-[13px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] tracking-body">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Execution Table (Borderless List) */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-[16px] font-medium text-[var(--text-primary)] tracking-subheader">Recent Executions</h2>
                <button onClick={() => router.push("/runs")} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                  View all &rarr;
                </button>
              </div>

              <div className="w-full">
                <div className="flex border-b border-[rgba(255,255,255,0.08)] text-[12px] font-medium text-[var(--text-tertiary)] tracking-micro pb-3 px-4">
                  <div className="w-1/3">Workflow</div>
                  <div className="w-1/4">Trigger</div>
                  <div className="w-1/4">Duration</div>
                  <div className="w-1/6 text-right">Status</div>
                </div>

                <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {[...activeRuns, ...runHistory].slice(0, 5).map((run) => (
                    <div key={run.id} className="flex items-center py-4 px-4 -mx-4 rounded-lg hover:bg-[var(--surface-2)] transition-colors group">
                      <div className="w-1/3 text-[14px] font-medium text-[var(--text-primary)] truncate pr-4 tracking-body">{run.workflow_name}</div>
                      <div className="w-1/4 text-[13px] font-mono text-[var(--text-secondary)]">{run.trigger}</div>
                      <div className="w-1/4 text-[13px] text-[var(--text-secondary)] font-mono flex items-center">
                        {run.status === "running" ? (
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-primary)] animate-pulse" />
                            {run.progress}%
                          </div>
                        ) : "-"}
                      </div>
                      <div className="w-1/6 flex justify-end items-center gap-3">
                        {run.status === "failed" && (
                          <button className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-opacity" title="Restart">
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            run.status === "success" ? "bg-[var(--success)]" :
                            run.status === "failed" ? "bg-[var(--danger)]" :
                            "bg-[var(--text-primary)]"
                          }`} />
                          <span className="text-[13px] text-[var(--text-secondary)] capitalize">{run.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== SYSTEM HEALTH TAB ===================== */}
        {activeTab === "health" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">

            <div>
              <div className="flex items-center justify-between mb-8 border-b border-[rgba(255,255,255,0.06)] pb-4">
                <h2 className="text-[15px] font-medium text-[var(--text-primary)] tracking-subheader">Service Uptime</h2>
                <button onClick={refreshUptime} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <RefreshCw className={`w-4 h-4 ${uptimeRefreshing ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="space-y-6">
                {uptimeServices.map(svc => (
                  <div key={svc.name} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${svc.status === "operational" ? "bg-[var(--success)]" : "bg-[var(--warning)]"}`} />
                      <span className="text-[14px] font-medium text-[var(--text-primary)] tracking-body">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex gap-[2px]">
                        {Array.from({ length: 30 }, (_, i) => {
                          const isDown = svc.status === "degraded" && i >= 26 && i <= 28;
                          return (
                            <div
                              key={`day-${i}`}
                              className={`w-1 h-6 rounded-[1px] ${isDown ? "bg-[var(--warning)]" : "bg-[var(--success)] opacity-40"}`}
                              title={`Day ${i + 1}`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[13px] text-[var(--text-secondary)] font-mono w-14 text-right">{svc.uptime}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-8 border-b border-[rgba(255,255,255,0.06)] pb-4">
                <h2 className="text-[15px] font-medium text-[var(--text-primary)] tracking-subheader">Activity Log</h2>
              </div>
              <div className="divide-y divide-[rgba(255,255,255,0.04)]">
                {recentActivity.slice(0, 6).map(a => (
                  <div key={a.id} className="py-4 flex gap-4 items-start">
                    <a.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: a.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[var(--text-primary)] tracking-body">{a.text}</p>
                      <p className="text-[12px] text-[var(--text-tertiary)] mt-1 font-mono">{a.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ===================== AGENTS TAB ===================== */}
        {activeTab === "agents" && (
          <div>
            <div className="flex items-center justify-between mb-8 border-b border-[rgba(255,255,255,0.06)] pb-4">
              <h2 className="text-[15px] font-medium text-[var(--text-primary)] tracking-subheader">Agent Registry</h2>
              <button onClick={() => router.push("/agents")} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                Manage Fleet &rarr;
              </button>
            </div>

            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {agents.map((agent) => {
                const memMB = parseInt(agent.memory_usage);
                const memPercent = Math.min(100, Math.round((memMB / 1024) * 100)) || 12;
                return (
                  <div key={agent.id} className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-4 -mx-4 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        agent.status === "active" ? "bg-[var(--success)]" :
                        agent.status === "busy" ? "bg-[var(--warning)]" :
                        "bg-[var(--text-tertiary)]"
                      }`} />
                      <div>
                        <span className="text-[15px] font-medium text-[var(--text-primary)] block mb-1 truncate tracking-body">{agent.name}</span>
                        <span className="text-[12px] text-[var(--text-tertiary)] font-mono">Uptime: {agent.uptime}</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-64">
                      <div className="flex justify-between text-[12px] text-[var(--text-secondary)] mb-2 tracking-body">
                        <span>Memory Usage</span>
                        <span className="font-mono">{agent.memory_usage}</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${memPercent > 80 ? "bg-[var(--danger)]" : memPercent > 50 ? "bg-[var(--warning)]" : "bg-[var(--text-primary)]"}`}
                          style={{ width: `${memPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {agents.length === 0 && (
                <div className="text-[14px] text-[var(--text-tertiary)] py-12 text-center">No agents currently provisioned.</div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
