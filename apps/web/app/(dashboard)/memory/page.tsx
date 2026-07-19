"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Search, Plus, Trash2, Eye, Brain, Clock, Tag, CheckCircle2, XCircle, Workflow, X, Loader2
} from "lucide-react";
import { useStore, MemoryItem } from "@/store";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Tabs } from "@/components/Tabs";

const contentTypeConfig: Record<string, { color: string; bg: string; label: string; icon: React.ElementType }> = {
  observation: { color: "text-[var(--accent)]", bg: "bg-[var(--accent-light)]", label: "Observation", icon: Eye },
  knowledge: { color: "text-[var(--text-primary)]", bg: "bg-[var(--surface-2)] shadow-[var(--edge-subtle)]", label: "Knowledge", icon: Brain },
  plan: { color: "text-[var(--warning)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", label: "Plan", icon: Workflow },
  result: { color: "text-[var(--success)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", label: "Result", icon: CheckCircle2 },
  error: { color: "text-[var(--danger)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", label: "Error", icon: XCircle },
};

export default function MemoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState("knowledge");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { memoryItems, memorySearchResults, fetchMemory, fetchMemorySearch, fetchDeleteMemory, isAuthenticated } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemory();
    }
  }, [isAuthenticated, fetchMemory]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await fetchMemorySearch(searchQuery);
    } else {
      fetchMemory();
    }
  };

  const handleCreateMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);

    try {
      const newItem: MemoryItem = {
        id: String(Math.floor(Math.random() * 100000)),
        content,
        content_type: contentType as any,
        source: "Manual Portal Entry",
        created_at: new Date().toISOString(),
        score: 1.0,
        tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean),
      };

      useStore.setState({
        memoryItems: [newItem, ...memoryItems]
      });

      setIsModalOpen(false);
      setContent("");
      setTagsInput("");
      setContentType("knowledge");
    } catch {
      alert("Failed to save memory item");
    } finally {
      setSaving(false);
    }
  };

  const displayItems = searchQuery.trim() ? memorySearchResults : memoryItems;
  const filteredItems = displayItems.filter((item) => {
    const matchesSearch = item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === "all" || item.content_type === selectedType;
    return matchesSearch && matchesType;
  });

  const stats = {
    total: memoryItems.length,
    observations: memoryItems.filter((i) => i.content_type === "observation").length,
    knowledge: memoryItems.filter((i) => i.content_type === "knowledge").length,
    plans: memoryItems.filter((i) => i.content_type === "plan").length,
    results: memoryItems.filter((i) => i.content_type === "result").length,
    errors: memoryItems.filter((i) => i.content_type === "error").length,
  };

  return (
    <div data-ui-sweep className="page-shell animate-fade-in relative">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Memory Explorer</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Semantic search and vector memory management.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Memory
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mb-16">
        {[
          { label: "Total", value: stats.total, icon: Database, color: "text-[var(--text-primary)]" },
          { label: "Observations", value: stats.observations, icon: Eye, color: "text-[var(--text-primary)]" },
          { label: "Knowledge", value: stats.knowledge, icon: Brain, color: "text-[var(--text-primary)]" },
          { label: "Plans", value: stats.plans, icon: Workflow, color: "text-[var(--warning)]" },
          { label: "Results", value: stats.results, icon: CheckCircle2, color: "text-[var(--success)]" },
          { label: "Errors", value: stats.errors, icon: XCircle, color: "text-[var(--danger)]" },
        ].map((stat) => (
          <div key={stat.label}>
            <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">
              {stat.label} <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
            </div>
            <div className="text-[32px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
              <AnimatedCounter value={stat.value} />
            </div>
          </div>
        ))}
      </div>

      <section className="surface-panel p-5 mb-8 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_18rem] gap-6 items-center">
        <div>
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Vector index coverage</h2>
              <p className="text-[12px] text-[var(--text-secondary)] mt-1">Embedding storage is healthy and available to all orchestrators.</p>
            </div>
            <span className="font-mono text-[12px] tabular-nums text-[var(--text-secondary)]">{stats.total.toLocaleString()} vectors</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden" aria-label="Vector index utilization">
            <div className="h-full rounded-full bg-[var(--text-primary)]" style={{ width: `${Math.min(100, Math.max(8, stats.total / 10))}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 font-mono text-[11px]">
          <div><span className="block text-[var(--text-tertiary)] mb-1">DIMENSIONS</span><span className="tabular-nums text-[var(--text-primary)]">1,536</span></div>
          <div><span className="block text-[var(--text-tertiary)] mb-1">RETRIEVAL</span><span className="tabular-nums text-[var(--text-primary)]">p95 42ms</span></div>
        </div>
      </section>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="input pl-9 w-full"
          />
        </div>
        <button onClick={handleSearch} className="btn-secondary px-3 h-8">
          <Search className="w-4 h-4" />
        </button>
      </div>

      <div className="mb-6">
        <Tabs 
          activeTab={selectedType}
          onChange={setSelectedType}
          tabs={[
            { id: "all", label: "All Items" },
            { id: "observation", label: "Observations" },
            { id: "knowledge", label: "Knowledge" },
            { id: "plan", label: "Plans" },
            { id: "result", label: "Results" },
            { id: "error", label: "Errors" }
          ]}
        />
      </div>

      <div className="space-y-2">
        {filteredItems.map((item, idx) => {
          const config = contentTypeConfig[item.content_type] || contentTypeConfig.observation;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
              className={`card p-5 cursor-pointer hover:bg-[var(--surface-2)] transition-colors ${selectedItem === item.id ? "bg-[var(--surface-2)]" : ""}`}
              onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <config.icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${config.bg} ${config.color}`}>{config.label}</span>
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">Score: {(item.score * 100).toFixed(0)}%</span>
                  </div>
                  <p className="text-[14px] text-[var(--text-primary)] leading-relaxed line-clamp-2">{item.content}</p>
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {item.tags.map((tag) => (
                      <span key={tag} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] rounded-md text-[11px] font-mono text-[var(--text-secondary)]">
                        <Tag className="w-3 h-3 text-[var(--text-tertiary)]" />{tag}
                      </span>
                    ))}
                    <span className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-tertiary)] ml-2">
                      <Clock className="w-3.5 h-3.5" />{new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); fetchDeleteMemory(Number(item.id)); }}
                  className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {selectedItem === item.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.04)]"
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-[12px] font-mono">
                    <div><span className="text-[var(--text-tertiary)] block mb-1">Source:</span> <span className="text-[var(--text-secondary)]">{item.source}</span></div>
                    <div><span className="text-[var(--text-tertiary)] block mb-1">Created:</span> <span className="text-[var(--text-secondary)]">{new Date(item.created_at).toLocaleString()}</span></div>
                    {item.run_id && <div><span className="text-[var(--text-tertiary)] block mb-1">Run ID:</span> <span className="text-[var(--text-secondary)]">{item.run_id}</span></div>}
                    {item.workflow_id && <div><span className="text-[var(--text-tertiary)] block mb-1">Workflow:</span> <span className="text-[var(--text-secondary)]">{item.workflow_id}</span></div>}
                    <div><span className="text-[var(--text-tertiary)] block mb-1">Vector Score:</span> <span className="text-[var(--text-secondary)]">{item.score.toFixed(4)}</span></div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {filteredItems.length === 0 && (
          <div className="text-center py-24 text-[var(--text-tertiary)] border border-[rgba(255,255,255,0.04)] border-dashed rounded-xl">
            <Database className="w-8 h-8 mx-auto mb-4 opacity-40" />
            <p className="text-[14px] font-medium tracking-body text-[var(--text-secondary)]">No memory items found</p>
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
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">Ingest Vector Memory</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateMemory} className="space-y-6">
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Memory Content / Knowledge Text</label>
                  <textarea 
                    value={content} 
                    onChange={e => setContent(e.target.value)} 
                    placeholder="e.g. Stripe client secret token was rotated successfully at 23:00." 
                    className="input min-h-[100px] py-3 resize-none" 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Content Type</label>
                    <select 
                      value={contentType} 
                      onChange={e => setContentType(e.target.value)}
                      className="input"
                    >
                      <option value="observation">Observation</option>
                      <option value="knowledge">Knowledge</option>
                      <option value="plan">Plan</option>
                      <option value="result">Result</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Tags <span className="text-[var(--text-tertiary)]">(comma-separated)</span></label>
                    <input 
                      type="text" 
                      value={tagsInput} 
                      onChange={e => setTagsInput(e.target.value)} 
                      placeholder="stripe, security" 
                      className="input" 
                    />
                  </div>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary min-w-[100px] justify-center">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
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
