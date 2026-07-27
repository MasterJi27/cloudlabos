"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { useAgentsStore, useAuthStore } from "@/lib/store";

const AGENT_TYPES = [
  { value: "general", label: "General Assistant", desc: "Versatile AI for common tasks and questions" },
  { value: "analyst", label: "Data Analyst", desc: "Analyze data, generate charts, run queries" },
  { value: "coding", label: "Code Reviewer", desc: "Review code, find bugs, suggest improvements" },
  { value: "security", label: "Security Monitor", desc: "Monitor logs, detect threats, audit systems" },
  { value: "research", label: "Research Bot", desc: "Research topics, summarize findings" },
  { value: "automation", label: "Automation Agent", desc: "Automate repetitive tasks and workflows" },
];

// Model slugs are routed through OpenRouter, which renames/retires them over
// time — verify at https://openrouter.ai/models before assuming a slug works.
const MODELS = [
  { value: "google/gemma-4-26b-a4b-it:free", label: "Gemma (Free)" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "google/gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite" },
  { value: "google/gemini-3.5-flash", label: "Gemini 3.5 Flash" },
  { value: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
];

export default function ProvisionAgentPage() {
  const router = useRouter();
  const { createAgent } = useAgentsStore();
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [agentType, setAgentType] = useState("general");
  const [model, setModel] = useState("google/gemma-4-26b-a4b-it:free");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !currentWorkspace) return;
    setSaving(true);
    setError("");
    try {
      const created = await createAgent(currentWorkspace, {
        name: name.trim(),
        description: description.trim() || undefined,
        agent_type: agentType,
        model,
        system_prompt: systemPrompt.trim() || undefined,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
      } as any);
      router.push(`/agents/${created.id}`);
    } catch (e: any) {
      setError(e.message || "Failed to create agent");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell animate-fade-in max-w-3xl">
      <button onClick={() => router.back()} className="btn-ghost flex items-center gap-2 text-[13px] mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Agents
      </button>

      <header className="mb-12">
        <h1 className="page-heading text-[var(--text-primary)] mb-2">Provision Agent</h1>
        <p className="text-[14px] text-[var(--text-secondary)]">Configure and deploy a new AI agent.</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-3 bg-[var(--surface-1)] text-[var(--danger)] rounded-lg text-[13px]">{error}</div>
        )}

        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-1">Basic Info</h2>
            <p className="text-[12px] text-[var(--text-secondary)]">Name and describe your agent</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Agent Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Support Bot" className="input" required />
            </div>
            <div>
              <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} className="input">
                {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this agent do?" className="input min-h-[80px] py-3 resize-none" />
          </div>
          <div>
            <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Tags <span className="text-[var(--text-tertiary)]">(comma-separated)</span></label>
            <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. prod, customer-facing" className="input" />
          </div>
        </div>

        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-1">Agent Type</h2>
            <p className="text-[12px] text-[var(--text-secondary)]">Choose the specialization for your agent</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {AGENT_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setAgentType(t.value)}
                className={`text-left p-4 rounded-xl border transition-all ${
                  agentType === t.value
                    ? "border-[var(--text-primary)] bg-[var(--surface-2)]"
                    : "border-[rgba(255,255,255,0.06)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)]"
                }`}
              >
                <p className="text-[13px] font-medium text-[var(--text-primary)]">{t.label}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-6 space-y-6">
          <div>
            <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-1">System Prompt</h2>
            <p className="text-[12px] text-[var(--text-secondary)]">Instructions that define the agent's behavior</p>
          </div>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="You are a helpful assistant that..."
            className="input min-h-[120px] py-3 resize-none font-mono text-[13px]"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary min-w-[140px] justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Provisioning..." : "Deploy Agent"}
          </button>
        </div>
      </form>
    </div>
  );
}