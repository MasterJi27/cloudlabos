"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Zap, Trophy, LayoutDashboard } from "lucide-react";
import { 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend 
} from "recharts";
import { Tabs } from "@/components/Tabs";

const workflowExecutions = [
  { name: "Mon", count: 120 },
  { name: "Tue", count: 150 },
  { name: "Wed", count: 180 },
  { name: "Thu", count: 140 },
  { name: "Fri", count: 200 },
  { name: "Sat", count: 80 },
  { name: "Sun", count: 60 },
];

const agentDistribution = [
  { name: "Orchestrator", value: 400 },
  { name: "Execution", value: 300 },
  { name: "Security", value: 150 },
  { name: "Vision", value: 200 },
  { name: "Planner", value: 278 },
  { name: "Validation", value: 189 },
];

const successRateTrend = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  rate: 85 + Math.random() * 15,
}));

const systemHealth = [
  { name: "System Health", score: 92, fill: "var(--text-primary)" }
];

const topWorkflows = [
  { id: 1, name: "Data Ingestion Pipeline", runs: 1245, avgDuration: "45s", successRate: 99.2 },
  { id: 2, name: "Weekly Report Generation", runs: 856, avgDuration: "2m 10s", successRate: 95.8 },
  { id: 3, name: "Security Audit Scan", runs: 642, avgDuration: "5m 30s", successRate: 92.4 },
  { id: 4, name: "Model Training Prep", runs: 430, avgDuration: "1m 15s", successRate: 98.1 },
  { id: 5, name: "User Cleanup Job", runs: 312, avgDuration: "12s", successRate: 100 },
];

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

export default function AnalyticsPage() {
  const [isClient, setIsClient] = useState(false);
  const [timeRange, setTimeRange] = useState("7d");

  useEffect(() => setIsClient(true), []);

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
          { label: "Total Executions", value: "14,235", icon: Activity },
          { label: "Avg Duration", value: "1m 12s", icon: Clock },
          { label: "Peak Hour", value: "14:00 UTC", icon: Zap },
          { label: "Most Used Workflow", value: "Data Ingestion", icon: Trophy },
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
                <Pie data={agentDistribution} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value" stroke="var(--void)" strokeWidth={2}>
                  {agentDistribution.map((entry, index) => (
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
              {topWorkflows.map((wf) => (
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
