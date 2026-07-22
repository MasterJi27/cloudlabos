"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Brain, Cpu, Clock, Send, Trash2, MessageSquare, Wrench, Loader2, Database, Activity, Plus, Copy, Download, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { useAgentsStore } from "@/lib/store";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [invoking, setInvoking] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [tools, setTools] = useState<any[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { deleteAgent } = useAgentsStore();

  useEffect(() => {
    const load = async () => {
      try {
        const [agentData, sessionsData] = await Promise.all([
          api.getAgent(agentId),
          api.listAgentSessions(agentId),
        ]);
        setAgent(agentData);
        setTools((agentData as any).tools || []);
        setSessions(Array.isArray(sessionsData) ? (sessionsData as any[]) : []);
      } catch (e) {
        console.error("load agent", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [agentId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleInvoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || invoking) return;

    const userMessage = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInvoking(true);

    try {
      const res = await api.invokeAgent(agentId, userMessage, currentSessionId || undefined);
      setMessages((prev) => [...prev, { role: "assistant", content: res.output }]);
      if (res.session_id && !currentSessionId) {
        setCurrentSessionId(res.session_id);
      }
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error invoking agent. Please try again." }]);
    } finally {
      setInvoking(false);
    }
  };

  const handleNewChat = async () => {
    if (currentSessionId) {
      try { await api.clearAgentSession(agentId, currentSessionId); } catch {}
    }
    setMessages([]);
    setCurrentSessionId(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  const handleExportTranscript = () => {
    const transcript = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    const blob = new Blob([transcript], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `chat-${(agent?.name || "agent").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAgent(agentId);
      router.push("/agents");
    } catch (e) {
      console.error("deleteAgent", e);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell animate-fade-in flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="page-shell animate-fade-in">
        <button onClick={() => router.back()} className="btn-ghost flex items-center gap-2 text-[13px] mb-8"><ArrowLeft className="w-4 h-4" /> Back</button>
        <h1 className="page-heading mb-4">Agent Not Found</h1>
        <p className="text-[14px] text-[var(--text-secondary)]">This agent does not exist or has been deleted.</p>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    active: "bg-[var(--success)]",
    busy: "bg-[var(--warning)]",
    idle: "bg-[var(--text-tertiary)]",
    error: "bg-[var(--danger)]",
  };

  return (
    <div className="page-shell animate-fade-in max-w-6xl">
      <button onClick={() => router.back()} className="btn-ghost flex items-center gap-2 text-[13px] mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Agents
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Agent Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-3 h-3 rounded-full ${statusColor[agent.status] || "bg-[var(--text-tertiary)]"}`} />
              <div>
                <h1 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">{agent.name}</h1>
                <span className="text-[12px] text-[var(--text-tertiary)] font-mono">{agent.id?.slice(0, 8)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 text-[13px]">
                <Brain className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Type:</span>
                <span className="text-[var(--text-primary)] font-medium capitalize">{agent.agent_type}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <Cpu className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Model:</span>
                <span className="text-[var(--text-primary)] font-medium">{agent.model}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <Activity className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Status:</span>
                <span className="text-[var(--text-primary)] font-medium capitalize">{agent.status}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Uptime:</span>
                <span className="text-[var(--text-primary)] font-medium">{agent.uptime || "0m"}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <Database className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Memory:</span>
                <span className="text-[var(--text-primary)] font-medium">{agent.memory_usage || "0 MB"}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <MessageSquare className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Tasks:</span>
                <span className="text-[var(--text-primary)] font-medium">{agent.tasks_total || 0}</span>
              </div>
              <div className="flex items-center gap-3 text-[13px]">
                <Zap className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-[var(--text-secondary)]">Tokens used:</span>
                <span className="text-[var(--text-primary)] font-medium">{(agent.tokens_used || 0).toLocaleString()}</span>
              </div>
            </div>

            {agent.description && (
              <p className="mt-6 text-[13px] text-[var(--text-secondary)] leading-relaxed border-t border-[rgba(255,255,255,0.06)] pt-4">{agent.description}</p>
            )}

            <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="btn-ghost mt-6 w-full justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10 text-[12px] disabled:opacity-50">
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? "Deleting..." : "Delete Agent"}
            </button>
            <ConfirmDialog
              open={showDeleteConfirm}
              onClose={() => setShowDeleteConfirm(false)}
              onConfirm={handleDelete}
              title="Delete Agent"
              message={`Are you sure you want to delete "${agent?.name}"? This action cannot be undone.`}
              confirmLabel="Delete Agent"
              variant="danger"
            />
          </div>

          {/* Tools */}
          <div className="card p-6">
            <h2 className="text-[14px] font-medium tracking-body text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-[var(--text-tertiary)]" /> Tools ({tools.length})
            </h2>
            {tools.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] text-center py-4">No tools configured</p>
            ) : (
              <div className="space-y-2">
                {tools.map((tool: any) => (
                  <div key={tool.id} className="flex items-center gap-3 p-3 bg-[var(--surface-1)] rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{tool.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] truncate">{tool.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions */}
          <div className="card p-6">
            <h2 className="text-[14px] font-medium tracking-body text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[var(--text-tertiary)]" /> Sessions ({sessions.length})
            </h2>
            {sessions.length === 0 ? (
              <p className="text-[13px] text-[var(--text-tertiary)] text-center py-4">No sessions yet. Start a conversation.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sessions.map((s: any) => (
                  <div key={s.id} className="text-[12px] font-mono text-[var(--text-secondary)] p-2 bg-[var(--surface-1)] rounded-lg truncate">
                    {s.id.slice(0, 8)}... — {s.status} — {new Date(s.created_at).toLocaleDateString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Chat Interface */}
        <div className="lg:col-span-2">
          <div className="card flex flex-col h-[70vh]">
            <div className="p-4 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[14px] font-medium tracking-body text-[var(--text-primary)] truncate">Chat with {agent.name}</h2>
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">Send a message to invoke this agent</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {messages.length > 0 && (
                  <button onClick={handleExportTranscript} title="Export transcript" className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                    <Download className="w-4 h-4" />
                  </button>
                )}
                <button onClick={handleNewChat} title="New conversation" className="btn-ghost px-2 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <Plus className="w-4 h-4 mr-1" /> New
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Brain className="w-12 h-12 text-[var(--text-tertiary)] opacity-30 mb-4" />
                  <p className="text-[14px] text-[var(--text-secondary)]">Send a message to start a conversation</p>
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1">Agent will respond via {agent.model}</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex group ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`relative max-w-[80%] p-3 rounded-xl text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--surface-2)] text-[var(--text-primary)]"
                      : "bg-[var(--surface-1)] text-[var(--text-secondary)]"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <button
                      onClick={() => handleCopy(msg.content)}
                      title="Copy message"
                      className="absolute -top-2 -right-2 p-1 rounded-md bg-[var(--surface-3)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {invoking && (
                <div className="flex justify-start">
                  <div className="bg-[var(--surface-1)] p-3 rounded-xl">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-tertiary)]" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleInvoke} className="p-4 border-t border-[rgba(255,255,255,0.06)] flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="input flex-1"
                disabled={invoking}
              />
              <button type="submit" disabled={invoking || !input.trim()} className="btn-primary">
                {invoking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}