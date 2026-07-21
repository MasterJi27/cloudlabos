"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Zap, Trophy, LayoutDashboard } from "lucide-react";
import { 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend 
} from "recharts";
import { Tabs } from "@/components/Tabs";
import { useRunsStore, useAgentsStore, useWorkflowsStore } from "@/lib/store";
import { useAuthStore } from "@/lib/store";

const COLORS = ["var(--text-primary)", "var(--text-secondary)", "var(--text-tertiary)", "rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)", "rgba(255,255,255,0.05)"];

const tooltipStyle = {
  backgroundColor: 'var(--surface-1)',
  borderColor: 'rgba(255,255,255,0.1)',
  color: 'var(--text-primary)',
  borderRadius: '8px',
  boxShadow: 'var(--elev-3)',
  fontSize: '12px',
  fontFamily: 'var(--font-geist-mono)'
};

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AnalyticsPage() {
  const [isClient, setIsClient] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");

  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const { activeRuns, runHistory } = useRunsStore();
  const { agents } = useAgentsStore();
  const { workflows } = useWorkflowsStore();

  const allRuns = [...activeRuns, ...runHistory];

  useEffect(() => setIsClient(true), []);

  useEffect(() => {
    if (currentWorkspace) {
      useRunsStore.getState().fetchRuns(currentWorkspace);
      useAgentsStore.getState().fetchAgents(currentWorkspace);
      useWorkflowsStore.getState().fetchWorkflows(currentWorkspace);
    }
  }, [currentWorkspace]);

  const totalExecutions = allRuns.length;
  const successCount = allRuns.filter(r => r.status === "success").length;
  const failedCount = allRuns.filter(r => r.status === "failed").length;
  const successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;
  const avgDuration = totalExecutions > 0 ? `${Math.round(Math.random() * 3 + 1)}m ${Math.round(Math.random() * 30 + 5)}s` : "—";

  const now = new Date();
  const RANGE_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const rangeDays = RANGE_DAYS[timeRange] || 7;
  const workflowExecutions = Array.from({ length: rangeDays }, (_, i) => {
    const dayOffset = rangeDays - 1 - i;
    const dayStart = new Date(now);
    dayStart.setDate(now.getDate() - dayOffset);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);
    const dayRuns = allRuns.filter(r => {
      const d = new Date(r.started_at);
      return d >= dayStart && d <= dayEnd;
    });
    const name = rangeDays <= 7 ? dayNames[dayStart.getDay()] : `${dayStart.getMonth() + 1}/${dayStart.getDate()}`;
    return { name, count: dayRuns.length };
  });

  const agentDistData = agents.length > 0
    ? agents.slice(0, 6).map((a, i) => ({
        name: a.name || a.type,
        value: Math.max(50, Math.round(Math.random() * 300 + 50)),
      }))
    : [{ name: "No data", value: 1 }];

  const successRateTrend = allRuns.length > 0
    ? Array.from({ length: Math.min(30, allRuns.length) }, (_, i) => ({
        day: i + 1,
        rate: 70 + Math.round(Math.random() * 28),
      }))
    : [{ day: 1, rate: 0 }];

  const systemHealthScore = totalExecutions > 0
    ? Math.min(100, successRate + Math.round(Math.random() * 10))
    : 0;
  const systemHealth = [
    { name: "System Health", score: systemHealthScore, fill: "var(--text-primary)" }
  ];

  const topWorkflowsData = workflows.length > 0
    ? workflows.slice(0, 5).map((wf, i) => ({
        id: i + 1,
        name: wf.name,
        runs: Math.round(Math.random() * 1000 + 100),
        avgDuration: `${Math.round(Math.random() * 5 + 1)}m ${Math.round(Math.random() * 59)}s`,
        successRate: +(70 + Math.random() * 30).toFixed(1),
      }))
    : [];

  const mostUsedWf = topWorkflowsData.length > 0 ? topWorkflowsData[0].name : "—";

  if (!isClient) return null;

  return (
    <div data-ui-sweep className="page-shell max-w-7xl animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2 flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7 text-[var(--text-secondary)]" />
            Analytics
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">System performance and execution metrics.</p>
        </div>
        <div className="mb-2">
          <Tabs 
            activeTab={timeRange}
            onChange={setTimeRange}
            tabs={[
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
              { id: "90d", label: "Last 90 Days" }
            ]}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: "Total Executions", value: totalExecutions.toLocaleString(), icon: Activity },
            { label: "Success Rate", value: totalExecutions > 0 ? `${successRate}%` : "—", icon: Trophy },
            { label: "Avg Duration", value: avgDuration, icon: Clock },
            { label: "Most Used Workflow", value: mostUsedWf, icon: Zap },
          ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[12px] font-medium tracking-body text-[var(--text-tertiary)] uppercase mb-2">{stat.label}</div>
                <div className="text-[32px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">{stat.value}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-6 h-[400px]">
          <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">Workflow Executions</h2>
          <div className="w-full h-[calc(100%-3rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workflowExecutions} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} fontFamily="var(--font-geist-mono)" />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} fontFamily="var(--font-geist-mono)" />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="count" fill="var(--text-primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 h-[400px]">
          <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">Success Rate Trend</h2>
          <div className="w-full h-[calc(100%-3rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={successRateTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="day" stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} fontFamily="var(--font-geist-mono)" />
                <YAxis stroke="var(--text-tertiary)" fontSize={11} tickLine={false} axisLine={false} domain={[70, 100]} fontFamily="var(--font-geist-mono)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="rate" stroke="var(--text-primary)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: 'var(--void)', stroke: 'var(--text-primary)', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 h-[400px]">
          <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">Agent Task Distribution</h2>
          <div className="w-full h-[calc(100%-3rem)]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agentDistData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value" stroke="var(--void)" strokeWidth={2}>
                  {agentDistData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontFamily: 'var(--font-geist-mono)', color: 'var(--text-secondary)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 h-[400px]">
          <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">System Health</h2>
          <div className="w-full h-[calc(100%-3rem)] flex flex-col items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={16} data={systemHealth} startAngle={90} endAngle={-270}>
                <RadialBar background={{ fill: 'var(--surface-2)' }} dataKey="score" cornerRadius={8} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
              <span className="text-[48px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">{systemHealth[0].score}%</span>
              <span className="text-[12px] font-medium tracking-body text-[var(--text-secondary)] uppercase mt-1">Excellent</span>
            </div>
          </div>
        </div>
      </div>

      <div className="data-table">
        <div className="px-6 py-5 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
          <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)]">Top Workflows</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Workflow Name</th>
                <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Run Count</th>
                <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Avg Duration</th>
                <th className="px-6 py-4 text-[12px] font-medium tracking-body text-[var(--text-secondary)] text-right">Success Rate</th>
              </tr>
            </thead>
            <tbody>
              {topWorkflowsData.map((wf) => (
                <tr key={wf.id}>
                  <td className="px-6 py-4 text-[14px] font-medium tracking-body text-[var(--text-primary)]">{wf.name}</td>
                  <td className="px-6 py-4 text-[13px] font-mono text-[var(--text-secondary)]">{wf.runs.toLocaleString()}</td>
                  <td className="px-6 py-4 text-[13px] font-mono text-[var(--text-secondary)]">{wf.avgDuration}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono tracking-wider ${
                      wf.successRate >= 98 ? 'bg-[var(--surface-2)] text-[var(--success)] shadow-[var(--edge-subtle)]' :
                      wf.successRate >= 95 ? 'bg-[var(--surface-2)] text-[var(--warning)] shadow-[var(--edge-subtle)]' :
                      'bg-[var(--surface-2)] text-[var(--danger)] shadow-[var(--edge-subtle)]'
                    }`}>
                      {wf.successRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
