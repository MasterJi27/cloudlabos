"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, ChevronRight, Clock, CheckCircle2, XCircle, Brain, Workflow, Timer, X, Loader2,
} from "lucide-react";
import { useStore } from "@/store";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Tabs } from "@/components/Tabs";

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  running: { color: "text-[var(--text-primary)]", bg: "bg-[var(--surface-2)] shadow-[var(--edge-subtle)]", icon: Play, label: "Running" },
  success: { color: "text-[var(--success)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", icon: CheckCircle2, label: "Success" },
  failed: { color: "text-[var(--danger)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", icon: XCircle, label: "Failed" },
  paused: { color: "text-[var(--warning)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", icon: Pause, label: "Paused" },
  pending: { color: "text-[var(--text-tertiary)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", icon: Clock, label: "Pending" },
  cancelled: { color: "text-[var(--text-tertiary)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", icon: Clock, label: "Cancelled" },
};

const stepDot: Record<string, string> = {
  success: "bg-[var(--success)]",
  failed: "bg-[var(--danger)]",
  running: "bg-[var(--text-primary)] animate-pulse",
  pending: "bg-[var(--surface-3)]",
  skipped: "bg-[var(--surface-3)]",
};

export default function RunsPage() {
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [runSteps, setRunSteps] = useState<Record<string, Array<{ name: string; status: string; duration: string }>>>({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWfId, setSelectedWfId] = useState("");
  const [executing, setExecuting] = useState(false);
  const [cancellingRun, setCancellingRun] = useState<string | null>(null);

  const { 
    activeRuns, runHistory, fetchRuns, fetchRunSteps, 
    workflows, fetchWorkflows, fetchExecuteWorkflow, fetchCancelRun, isAuthenticated 
  } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchRuns();
      fetchWorkflows();
    }
  }, [isAuthenticated, fetchRuns, fetchWorkflows]);

  const allRuns = [...activeRuns, ...runHistory];
  const filteredRuns = filter === "all" ? allRuns : allRuns.filter((r) => r.status === filter);

  const handleSelectRun = async (runId: string) => {
    if (selectedRun === runId) { setSelectedRun(null); return; }
    setSelectedRun(runId);
    if (!runSteps[runId]) {
      const steps = await fetchRunSteps(runId);
      setRunSteps((prev) => ({
        ...prev,
        [runId]: steps.map((s) => ({
          name: s.name,
          status: s.status,
          duration: s.completed_at && s.started_at
            ? `${Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 1000)}s`
            : "-",
        })),
      }));
    }
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWfId) return;
    setExecuting(true);
    try {
      await fetchExecuteWorkflow(selectedWfId);
      await fetchRuns();
      setIsModalOpen(false);
      setSelectedWfId("");
    } catch {
      alert("Failed to execute workflow");
    } finally {
      setExecuting(false);
    }
  };

  const handleCancelRun = async (runId: string) => {
    setCancellingRun(runId);
    try {
      await fetchCancelRun(runId);
    } catch {
      alert("Unable to cancel this run. Refresh and try again.");
    } finally {
      setCancellingRun(null);
    }
  };

  const totalRuns = allRuns.length;
  const successRuns = allRuns.filter((r) => r.status === "success").length;
  const successRate = totalRuns > 0 ? ((successRuns / totalRuns) * 100).toFixed(1) : "0.0";

  return (
    <div data-ui-sweep className="page-shell animate-fade-in relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Workflow Runs</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Monitor and manage workflow executions.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Play className="w-4 h-4" /> New Run
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Total Runs</div>
          <div className="metric-value text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={totalRuns} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">Success Rate <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /></div>
          <div className="metric-value text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            {successRate}%
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Avg Duration</div>
          <div className="metric-value text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            14s
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">Active Now <Play className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /></div>
          <div className="metric-value text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={activeRuns.length} />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <Tabs 
          activeTab={filter}
          onChange={setFilter}
          tabs={[
            { id: "all", label: "All Runs" },
            { id: "running", label: "Running" },
            { id: "success", label: "Success" },
            { id: "failed", label: "Failed" },
            { id: "paused", label: "Paused" }
          ]}
        />
      </div>

      <div className="space-y-3">
        {filteredRuns.map((run, idx) => {
          const config = statusConfig[run.status] || statusConfig.pending;
          return (
            <motion.div
              key={run.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="card p-5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
              onClick={() => handleSelectRun(run.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                    <config.icon className={`w-4 h-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] truncate">{run.workflow_name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${config.bg} ${config.color}`}>{config.label}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-[12px] font-mono text-[var(--text-tertiary)]">
                      <span className="flex items-center gap-1.5"><Workflow className="w-3.5 h-3.5" />{run.workflow_id}</span>
                      <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" />{run.trigger_type}</span>
                      {run.started_at && (
                        <span className="flex items-center gap-1.5"><Timer className="w-3.5 h-3.5" />{new Date(run.started_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {run.status === "running" && (
                    <div className="w-32 hidden sm:block">
                      <div className="flex justify-between text-[11px] font-mono text-[var(--text-tertiary)] mb-1.5">
                        <span>Progress</span><span>{run.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
                        <div className="h-full bg-[var(--text-primary)] rounded-full transition-all" style={{ width: `${run.progress}%` }} />
                      </div>
                    </div>
                  )}
                  {(run.status === "running" || run.status === "pending") && (
                    <button
                      type="button"
                      onClick={(event) => { event.stopPropagation(); handleCancelRun(run.id); }}
                      disabled={cancellingRun === run.id}
                      className="btn-ghost h-8 px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] disabled:opacity-50"
                      aria-label={`Cancel ${run.workflow_name}`}
                      title="Cancel run"
                    >
                      {cancellingRun === run.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <ChevronRight className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform ${selectedRun === run.id ? "rotate-90" : ""}`} />
                </div>
              </div>

              {selectedRun === run.id && runSteps[run.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Brain className="w-4 h-4 text-[var(--text-secondary)]" />
                    <span className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Execution Timeline</span>
                  </div>
                  <div className="flex items-center gap-3 overflow-x-auto pb-2">
                    {runSteps[run.id].map((step, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-3 h-3 rounded-full shadow-[var(--edge-subtle)] ${stepDot[step.status] || "bg-[var(--surface-3)]"}`} />
                          <span className="text-[11px] font-medium tracking-body text-[var(--text-secondary)] mt-2 whitespace-nowrap">{step.name}</span>
                          <span className="text-[10px] font-mono tabular-nums text-[var(--text-tertiary)] mt-0.5">{step.duration}</span>
                        </div>
                        {i < runSteps[run.id].length - 1 && (
                          <div className={`w-8 h-[1px] mb-6 ${step.status === "success" ? "bg-[var(--success)]" : "bg-[rgba(255,255,255,0.1)]"}`} />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {filteredRuns.length === 0 && (
          <div className="text-center py-24 text-[var(--text-tertiary)] border border-[rgba(255,255,255,0.04)] border-dashed rounded-xl">
            <Play className="w-8 h-8 mx-auto mb-4 opacity-40" />
            <p className="text-[14px] font-medium tracking-body text-[var(--text-secondary)]">No runs found</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-[var(--elev-3)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">Execute Workflow</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleExecute} className="space-y-6">
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Select Workflow</label>
                  <select 
                    value={selectedWfId} 
                    onChange={e => setSelectedWfId(e.target.value)} 
                    className="input font-mono" 
                    required
                  >
                    <option value="">-- Choose a workflow --</option>
                    {workflows.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name} (v{wf.version})</option>
                    ))}
                  </select>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={executing || !selectedWfId} className="btn-primary min-w-[100px] justify-center">
                    {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Run"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
