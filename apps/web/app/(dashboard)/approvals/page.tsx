"use client";

import { useState, useEffect } from "react";
import {
  ShieldAlert, Terminal, Clock, AlertTriangle, Plus, X, Trash2, Check, Ban, Activity, Shield
} from "lucide-react";
import { useStore } from "@/store";
import { Tabs } from "@/components/Tabs";
import { AnimatedCounter } from "@/components/AnimatedCounter";

const riskConfig: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  critical: { color: "var(--danger)", label: "Critical", icon: ShieldAlert },
  high: { color: "var(--danger)", label: "High", icon: ShieldAlert },
  medium: { color: "var(--warning)", label: "Medium", icon: Activity },
  low: { color: "var(--success)", label: "Low", icon: Check },
};

function getRiskCategory(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 0.9) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

interface Rule {
  pattern: string;
  risk: "low" | "medium" | "high" | "critical";
  action: "auto-approve" | "require-approval" | "reject";
}

export default function ApprovalsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  
  const [rules, setRules] = useState<Rule[]>([
    { pattern: "npm install *", risk: "low", action: "auto-approve" },
    { pattern: "git clone *", risk: "low", action: "auto-approve" },
    { pattern: "kubectl get *", risk: "low", action: "auto-approve" },
    { pattern: "SELECT * FROM *", risk: "medium", action: "require-approval" },
    { pattern: "DROP TABLE *", risk: "critical", action: "reject" },
  ]);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [newPattern, setNewPattern] = useState("");
  const [newRisk, setNewRisk] = useState<Rule["risk"]>("low");
  const [newAction, setNewAction] = useState<Rule["action"]>("auto-approve");

  const { approvals, pendingApprovals, fetchApprovals, fetchApproveAction, fetchRejectAction, isAuthenticated } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchApprovals();
    }
  }, [isAuthenticated, fetchApprovals]);

  const handleApprove = async (id: string) => {
    try { await fetchApproveAction(id, reviewNotes[id]); } catch {}
  };

  const handleReject = async (id: string) => {
    try { await fetchRejectAction(id, reviewNotes[id]); } catch {}
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPattern.trim()) return;
    
    const newRule: Rule = { pattern: newPattern.trim(), risk: newRisk, action: newAction };
    setRules([...rules, newRule]);
    setIsRuleModalOpen(false);
    setNewPattern("");
    setNewRisk("low");
    setNewAction("auto-approve");
  };

  const handleDeleteRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
  };

  const historyApprovals = approvals.filter(a => a.status !== "pending");

  return (
    <div className="max-w-6xl mx-auto pb-20 px-6 pt-12 animate-fade-in">
      
      {/* OS-Level Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="text-[32px] tracking-header-lg font-medium text-[var(--text-primary)] mb-2">Gateways</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage execution policies and human-in-the-loop approvals.</p>
        </div>
      </header>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">
            Pending <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
          </div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={pendingApprovals.length} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Approved</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={approvals.filter((a) => a.status === "approved").length} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Rejected</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={approvals.filter((a) => a.status === "rejected").length} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Security Score</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--success)] font-mono">
            99.4%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-16">
        
        {/* Main Area */}
        <div className="lg:col-span-2">
          
          <div className="mb-6">
            <Tabs 
              activeTab={activeTab}
              onChange={setActiveTab}
              tabs={[
                { id: "pending", label: "Pending Reviews" },
                { id: "history", label: "Audit Log" }
              ]}
            />
          </div>

          <div className="space-y-1">
            {activeTab === "pending" ? (
              pendingApprovals.length === 0 ? (
                <div className="py-20 text-center text-[var(--text-tertiary)] flex flex-col items-center">
                  <Shield className="w-8 h-8 mb-3 opacity-40" />
                  <p className="text-[15px] font-medium text-[var(--text-secondary)] tracking-body">No pending requests</p>
                  <p className="text-[13px] mt-1">All agent executions are operating within safe parameters.</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => {
                  const config = riskConfig[getRiskCategory(approval.risk_score)];
                  return (
                    <div key={approval.id} className="group flex flex-col sm:flex-row gap-6 py-6 px-4 -mx-4 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                      <div className="flex-1 min-w-0 space-y-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-[15px] font-medium text-[var(--text-primary)] tracking-body">{approval.run_name}</h3>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full shadow-[var(--edge-subtle)] bg-[var(--surface-1)]">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.color }} />
                            <span className="text-[11px] font-medium text-[var(--text-secondary)] tracking-micro">{config.label} Risk</span>
                          </div>
                        </div>
                        
                        <div className="bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-lg p-4 overflow-x-auto">
                          <code className="text-[13px] font-mono text-[var(--text-primary)]">{approval.action}</code>
                        </div>
                        
                        <div className="flex items-center gap-4 text-[12px] font-mono text-[var(--text-tertiary)]">
                          <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> {approval.requested_by}</span>
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {new Date(approval.requested_at).toLocaleString()}</span>
                        </div>
                        
                        {approval.risk_reasons && approval.risk_reasons.length > 0 && (
                          <div className="pt-2">
                            <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-2 tracking-micro">Risk Factors</p>
                            <ul className="space-y-1.5">
                              {approval.risk_reasons.map((reason, i) => (
                                <li key={i} className="text-[13px] text-[var(--text-secondary)] flex items-start gap-2 tracking-body">
                                  <span className="text-[var(--warning)] mt-0.5">•</span>
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        <div className="pt-2">
                          <input
                            type="text"
                            placeholder="Add audit note..."
                            value={reviewNotes[approval.id] || ""}
                            onChange={(e) => setReviewNotes({ ...reviewNotes, [approval.id]: e.target.value })}
                            className="input w-full sm:w-2/3 bg-transparent shadow-none border-b border-[rgba(255,255,255,0.1)] rounded-none px-0 focus:shadow-none focus:border-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                      
                      <div className="flex sm:flex-col justify-end items-center sm:items-end gap-3 shrink-0">
                        <button
                          onClick={() => handleApprove(approval.id)}
                          className="btn-primary w-full sm:w-auto"
                        >
                          <Check className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleReject(approval.id)}
                          className="btn-ghost w-full sm:w-auto hover:text-[var(--danger)]"
                        >
                          <Ban className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  );
                })
              )
            ) : (
              historyApprovals.length === 0 ? (
                <div className="py-20 text-center text-[var(--text-tertiary)]">
                  <p className="text-[15px] font-medium text-[var(--text-secondary)] tracking-body">No audit history</p>
                </div>
              ) : (
                historyApprovals.map((approval) => (
                  <div key={approval.id} className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 py-4 border-b border-[rgba(255,255,255,0.06)] last:border-0 hover:bg-[var(--surface-2)] -mx-4 px-4 rounded-lg transition-colors">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-medium text-[14px] text-[var(--text-primary)] tracking-body">{approval.run_name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${approval.status === "approved" ? "bg-[var(--success)]" : "bg-[var(--danger)]"}`} />
                          <span className="text-[12px] text-[var(--text-secondary)] capitalize">{approval.status}</span>
                        </div>
                      </div>
                      <code className="block font-mono text-[13px] text-[var(--text-tertiary)] truncate">
                        {approval.action}
                      </code>
                    </div>
                    <span className="text-[12px] font-mono text-[var(--text-tertiary)] whitespace-nowrap">
                      {new Date(approval.requested_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-8 space-y-6">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-3">
              <h2 className="text-[14px] font-medium text-[var(--text-primary)] tracking-body">Execution Policies</h2>
              <button 
                onClick={() => setIsRuleModalOpen(true)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                title="Add Rule"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-4">
              {rules.map((rule, idx) => (
                <div key={idx} className="group flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <code className="text-[13px] text-[var(--text-primary)] font-mono truncate">{rule.pattern}</code>
                    <button 
                      onClick={() => handleDeleteRule(idx)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-[var(--text-tertiary)] capitalize flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        rule.risk === "low" ? "bg-[var(--success)]" :
                        rule.risk === "medium" ? "bg-[var(--warning)]" :
                        "bg-[var(--danger)]"
                      }`} />
                      {rule.risk}
                    </span>
                    <span className="text-[var(--text-tertiary)]">•</span>
                    <span className="text-[12px] text-[var(--text-tertiary)] capitalize">{rule.action.replace('-', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* OS-Level Modal Overlay (Uses surface-overlay blur for transient only) */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-[var(--elev-3)]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">New Policy</h2>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRule} className="space-y-6">
              <div>
                <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2 tracking-body">Pattern</label>
                <input 
                  type="text" 
                  value={newPattern} 
                  onChange={e => setNewPattern(e.target.value)} 
                  placeholder="e.g. npm install *" 
                  className="input font-mono" 
                  required 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2 tracking-body">Risk</label>
                  <select 
                    value={newRisk} 
                    onChange={e => setNewRisk(e.target.value as any)}
                    className="input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-2 tracking-body">Action</label>
                  <select 
                    value={newAction} 
                    onChange={e => setNewAction(e.target.value as any)}
                    className="input"
                  >
                    <option value="auto-approve">Approve</option>
                    <option value="require-approval">Audit</option>
                    <option value="reject">Block</option>
                  </select>
                </div>
              </div>
              
              <div className="pt-6 flex justify-end">
                <button type="submit" className="btn-primary">
                  Create Policy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
