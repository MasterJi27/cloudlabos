"use client";

import { useState, useEffect } from "react";
import {
  Brain, Cpu, Activity, CheckCircle2, XCircle, Pause, Eye, Shield, GitBranch, Terminal, Database,
  Plus, X, Loader2, Play, Power, Trash2, Search, Filter
} from "lucide-react";
import { useStore, Agent } from "@/store";
import { useRouter } from "next/navigation";
import { AnimatedCounter } from "@/components/AnimatedCounter";

const MetricCard = ({ label, value, trend, trendUp }: { label: string, value: string | number, trend: string, trendUp?: boolean }) => (
  <div>
    <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">{label}</div>
    <div className="flex items-end gap-3">
      <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
        {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
      </div>
      {trend && (
        <span className={`text-[13px] font-medium mb-1.5 flex items-center tracking-normal font-sans ${trendUp ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>
          {trend}
        </span>
      )}
    </div>
  </div>
);

export default function AgentsGrid() {
  const router = useRouter();
  const { agents, fetchAgents, currentWorkspace } = useStore();
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsClient(true);
    fetchAgents();
  }, [fetchAgents]);

  const activeCount = agents.filter(a => a.status === 'active' || a.status === 'busy').length;
  const filteredAgents = agents.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.id.includes(searchQuery));

  return (
    <div className="max-w-7xl mx-auto pb-24 px-6 md:px-12 pt-12 animate-fade-in">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="text-[32px] tracking-header-lg font-medium text-[var(--text-primary)] mb-2">Agent Fleet</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage your autonomous worker nodes and specialized AI agents.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary" onClick={() => router.push('/agents/provision')}>
            <GitBranch className="w-4 h-4 text-[var(--text-tertiary)]" />
            Provision Node
          </button>
          <button className="btn-primary" onClick={() => router.push('/workflows/new')}>
            <Plus className="w-4 h-4" />
            New Agent
          </button>
        </div>
      </header>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
        <MetricCard label="Active Nodes" value={activeCount || 0} trend="All healthy" trendUp={true} />
        <MetricCard label="Compute Load" value={isClient ? 42 : 0} trend="Avg CPU" />
        <MetricCard label="Memory Utilized" value={isClient ? "24" : "0"} trend="GB total" />
        <MetricCard label="Tasks Completed" value={142} trend="This week" />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input 
            type="text" 
            placeholder="Search agents by name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
        <button className="btn-ghost px-2">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </button>
      </div>

      {/* Agents List (Borderless Table style) */}
      <div className="w-full">
        <div className="flex border-b border-[rgba(255,255,255,0.08)] text-[12px] font-medium text-[var(--text-tertiary)] tracking-micro pb-3 px-4">
          <div className="w-1/3">Agent / Model</div>
          <div className="w-1/4">Current Task</div>
          <div className="w-1/6">Metrics</div>
          <div className="w-1/4 text-right">Actions</div>
        </div>

        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="flex items-center py-5 px-4 -mx-4 rounded-lg hover:bg-[var(--surface-2)] transition-colors group">
              
              {/* Identity */}
              <div className="w-1/3 pr-4">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    agent.status === "active" ? "bg-[var(--success)]" :
                    agent.status === "busy" ? "bg-[var(--warning)]" :
                    agent.status === "error" ? "bg-[var(--danger)]" :
                    "bg-[var(--text-tertiary)]"
                  }`} />
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-medium text-[var(--text-primary)] truncate tracking-body">
                      {agent.name}
                    </h3>
                    <div className="text-[12px] text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{agent.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5"><Brain className="w-3 h-3" /> GPT-4o</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task */}
              <div className="w-1/4 pr-4">
                {agent.status === 'busy' ? (
                  <div>
                    <div className="text-[13px] text-[var(--text-primary)] tracking-body truncate">Processing workflow data</div>
                    <div className="text-[12px] text-[var(--text-tertiary)] font-mono mt-0.5">Elapsed: 1m 24s</div>
                  </div>
                ) : (
                  <div className="text-[13px] text-[var(--text-secondary)] tracking-body">Idle</div>
                )}
              </div>

              {/* Metrics */}
              <div className="w-1/6 pr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  <span className="text-[12px] text-[var(--text-secondary)] font-mono">{Math.floor(Math.random() * 40 + 10)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                  <span className="text-[12px] text-[var(--text-secondary)] font-mono">{agent.memory_usage}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="w-1/4 flex justify-end items-center gap-2">
                <button className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Terminal className="w-4 h-4" />
                </button>
                <button className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Pause className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  className="btn-secondary ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}

          {filteredAgents.length === 0 && (
            <div className="py-16 text-center text-[var(--text-secondary)] text-[14px]">
              No agents found matching your search.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
