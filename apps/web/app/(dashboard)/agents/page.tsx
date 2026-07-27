"use client";

import { useState, useEffect } from "react";
import {
  Brain, Cpu, CheckCircle2, XCircle, Pause, GitBranch, Terminal, Database,
  Plus, X, Loader2, Trash2, Search, Filter, Play, Copy, Download, Upload, Star
} from "lucide-react";
import { useStore, Agent } from "@/store";
import { useAgentsStore } from "@/lib/store";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { Pagination } from "@/components/ui/Pagination";
import { SkeletonList } from "@/components/ui/Skeleton";
import { SortHeader, useSort } from "@/components/ui/SortHeader";

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
  const { toast } = useToast();
  const { agents, fetchAgents, currentWorkspace } = useStore();
  const { deleteAgent } = useAgentsStore();
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [bulkWorking, setBulkWorking] = useState(false);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [loading, setLoading] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    if (currentWorkspace) {
      setLoading(true);
      Promise.resolve(fetchAgents()).finally(() => setLoading(false));
    }
  }, [currentWorkspace, fetchAgents]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAgents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAgents.map(a => a.id)));
    }
  };

  useEffect(() => { setPage(1); }, [searchQuery]);

  const handleClone = async (id: string) => {
    try {
      await api.cloneAgent(id);
      if (currentWorkspace) await fetchAgents();
      toast("success", "Agent duplicated");
    } catch (e: any) { toast("error", e.message || "Failed to duplicate"); }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const data = await api.exportAgent(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `agent-${name.replace(/\s+/g, "-").toLowerCase()}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch (e: any) { toast("error", e.message || "Failed to export"); }
  };

  const handleStar = async (id: string, current: boolean) => {
    try {
      await api.updateAgent(id, { is_starred: !current });
      if (currentWorkspace) await fetchAgents();
    } catch (e: any) { toast("error", e.message || "Failed to update"); }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;
    try {
      const data = JSON.parse(await file.text());
      await api.importAgent(currentWorkspace, data);
      await fetchAgents();
      toast("success", "Agent imported");
    } catch (err: any) {
      toast("error", err.message?.includes("JSON") ? "Invalid agent file" : (err.message || "Import failed"));
    } finally {
      e.target.value = "";
    }
  };

  const runBulkAction = async (action: "pause" | "restart" | "delete") => {
    const ids = Array.from(selectedIds);
    setBulkWorking(true);
    setSelectedIds(new Set());
    try {
      if (action === "delete") {
        await Promise.all(ids.map((id) => deleteAgent(id)));
        toast("success", `${ids.length} agent(s) deleted`);
      } else {
        const status = action === "pause" ? "idle" : "active";
        await Promise.all(ids.map((id) => api.updateAgent(id, { status })));
        toast("success", `${ids.length} agent(s) ${action === "pause" ? "paused" : "restarted"}`);
        if (currentWorkspace) await fetchAgents();
      }
    } catch (e: any) {
      toast("error", e.message || `Failed to ${action} agents`);
    } finally {
      setBulkWorking(false);
    }
  };

  const activeCount = agents.filter(a => a.status === 'active' || a.status === 'busy').length;

  // Every distinct tag across the fleet, for the tag filter dropdown.
  const allTags = Array.from(new Set(agents.flatMap((a: any) => a.tags || []))).sort() as string[];

  const searchedAgents = agents.filter((a: any) =>
    (a.name.toLowerCase().includes(searchQuery.toLowerCase()) || a.id.includes(searchQuery)) &&
    (!starredOnly || a.is_starred) &&
    (!tagFilter || (a.tags || []).includes(tagFilter))
  );

  const { sort, toggle: toggleSort, sorted: filteredAgents } = useSort<any, "name" | "status" | "agent_type" | "tasks_total">(
    searchedAgents,
    (a, key) => (key === "tasks_total" ? a.tasks_total ?? 0 : a[key]),
  );

  const selectedCount = selectedIds.size;
  const totalPages = Math.ceil(filteredAgents.length / PAGE_SIZE);
  const paginatedAgents = filteredAgents.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto pb-24 px-6 md:px-12 pt-12 animate-fade-in">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="text-[32px] tracking-header-lg font-medium text-[var(--text-primary)] mb-2">Agent Fleet</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage your autonomous worker nodes and specialized AI agents.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="btn-secondary cursor-pointer">
            <Upload className="w-4 h-4 text-[var(--text-tertiary)]" />
            Import
            <input type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          </label>
          <button className="btn-secondary" onClick={() => router.push('/agents/provision')}>
            <GitBranch className="w-4 h-4 text-[var(--text-tertiary)]" />
            Provision Node
          </button>
          <button className="btn-primary" onClick={() => router.push('/agents/provision')}>
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
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setStarredOnly((s) => !s)}
            className={`btn-secondary h-9 px-3 text-[12px] ${starredOnly ? "text-[var(--warning)]" : ""}`}
            title="Show starred only"
          >
            <Star className="w-3.5 h-3.5 mr-1.5" fill={starredOnly ? "currentColor" : "none"} /> Starred
          </button>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            aria-label="Filter by tag"
            className="input h-9 w-40 text-[12px]"
          >
            <option value="">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg animate-fade-in">
          <span className="text-[13px] text-[var(--text-primary)] font-medium">{selectedCount} selected</span>
          <div className="w-px h-4 bg-[rgba(255,255,255,0.06)]" />
          <button disabled={bulkWorking} onClick={() => runBulkAction("pause")} className="btn-ghost text-[12px] h-7 px-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <GitBranch className="w-3.5 h-3.5 mr-1" /> Pause
          </button>
          <button disabled={bulkWorking} onClick={() => runBulkAction("restart")} className="btn-ghost text-[12px] h-7 px-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
            <Play className="w-3.5 h-3.5 mr-1" /> Restart
          </button>
          <button disabled={bulkWorking} onClick={() => runBulkAction("delete")} className="btn-ghost text-[12px] h-7 px-2 text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50">
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </button>
        </div>
      )}

      {/* Agents List (Borderless Table style) */}
      <div className="w-full">
        <div className="flex border-b border-[rgba(255,255,255,0.08)] text-[12px] font-medium text-[var(--text-tertiary)] tracking-micro pb-3 px-4">
          <div className="w-8 flex items-center">
            <input type="checkbox" checked={selectedIds.size === filteredAgents.length && filteredAgents.length > 0} onChange={toggleSelectAll} className="accent-[var(--text-primary)]" />
          </div>
          <div className="w-1/3">
            <SortHeader label="Agent / Model" sortKey="name" sort={sort} onToggle={toggleSort} />
          </div>
          <div className="w-1/4">
            <SortHeader label="Type" sortKey="agent_type" sort={sort} onToggle={toggleSort} />
          </div>
          <div className="w-1/6">
            <SortHeader label="Tasks" sortKey="tasks_total" sort={sort} onToggle={toggleSort} />
          </div>
          <div className="w-1/4 text-right flex justify-end">
            <SortHeader label="Status" sortKey="status" sort={sort} onToggle={toggleSort} />
          </div>
        </div>

        {loading && agents.length === 0 ? (
          <SkeletonList rows={5} columns={4} />
        ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {paginatedAgents.map((agent) => (
            <div key={agent.id} className="flex items-center py-5 px-4 -mx-4 rounded-lg hover:bg-[var(--surface-2)] transition-colors group">
              
              {/* Checkbox */}
              <div className="w-8 flex items-center">
                <input type="checkbox" checked={selectedIds.has(agent.id)} onChange={() => toggleSelect(agent.id)} className="accent-[var(--text-primary)]" />
              </div>
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
                    <h3 className="text-[15px] font-medium text-[var(--text-primary)] truncate tracking-body flex items-center gap-2">
                      {agent.name}
                      {(agent as any).is_starred && <Star className="w-3 h-3 text-[var(--warning)] shrink-0" fill="currentColor" />}
                    </h3>
                    <div className="text-[12px] text-[var(--text-tertiary)] flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono">{agent.id.slice(0, 8)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5"><Brain className="w-3 h-3" /> {(agent as any).model || "—"}</span>
                      {((agent as any).tags || []).map((t: string) => (
                        <button
                          key={t}
                          onClick={(e) => { e.stopPropagation(); setTagFilter(t); }}
                          title={`Filter by ${t}`}
                          className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          {t}
                        </button>
                      ))}
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
              <div className="w-1/4 flex justify-end items-center gap-1.5">
                <button
                  onClick={() => handleStar(agent.id, (agent as any).is_starred)}
                  title={(agent as any).is_starred ? "Unstar" : "Star"}
                  className={`btn-ghost px-2 transition-opacity ${(agent as any).is_starred ? "text-[var(--warning)] opacity-100" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100"}`}
                >
                  <Star className="w-4 h-4" fill={(agent as any).is_starred ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={() => handleClone(agent.id)}
                  title="Duplicate agent"
                  className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleExport(agent.id, agent.name)}
                  title="Export agent"
                  className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  className="btn-secondary ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}

          {agents.length === 0 ? (
            <EmptyState
              icon={<Brain className="w-7 h-7" />}
              title="No agents deployed"
              description="Provision your first AI agent to automate tasks and run workflows."
              action={<button onClick={() => router.push('/agents/provision')} className="btn-primary"><Plus className="w-4 h-4" /> Deploy Agent</button>}
            />
          ) : filteredAgents.length === 0 && (
            <EmptyState
              icon={<Search className="w-7 h-7" />}
              title="No results"
              description="No agents match your search query. Try different keywords."
            />
          )}
        </div>
        )}
        <Pagination page={page} totalPages={totalPages} totalItems={filteredAgents.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </div>

    </div>
  );
}
