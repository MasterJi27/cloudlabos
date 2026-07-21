"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Search, Play, GitBranch, Clock, CheckCircle2, X, Loader2,
  ArrowLeft, Save, PlusCircle, Trash2, Edit2, AlertCircle
} from "lucide-react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import ReactFlow, {
  Background, Controls, useNodesState, useEdgesState, addEdge, Connection, Edge, Node
} from "reactflow";
import "reactflow/dist/style.css";
import { AnimatedCounter } from "@/components/AnimatedCounter";

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-[var(--success)]", bg: "bg-[var(--surface-2)] shadow-[var(--edge-subtle)]", label: "Active" },
  draft: { color: "text-[var(--warning)]", bg: "bg-[var(--surface-2)] shadow-[var(--edge-subtle)]", label: "Draft" },
  archived: { color: "text-[var(--text-tertiary)]", bg: "bg-[var(--surface-1)] shadow-[var(--edge-subtle)]", label: "Archived" },
};

const defaultWfNodes: Record<string, Node[]> = {
  wf_scan: [
    { id: "1", type: "input", data: { label: "K8s Cluster Scanner" }, position: { x: 150, y: 50 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "2", data: { label: "Docker Package Auditor" }, position: { x: 150, y: 150 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "3", type: "output", data: { label: "Slack Digest Alert dispatcher" }, position: { x: 150, y: 250 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } }
  ],
  wf_leads: [
    { id: "1", type: "input", data: { label: "Stripe Webhook Listener" }, position: { x: 100, y: 150 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "2", data: { label: "Query HubSpot CRM Record" }, position: { x: 340, y: 100 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "3", data: { label: "AI Customer enrichment API" }, position: { x: 340, y: 200 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "4", type: "output", data: { label: "Create / Update HubSpot Deal" }, position: { x: 580, y: 150 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } }
  ],
  wf_summary: [
    { id: "1", type: "input", data: { label: "Query PostgreSQL database" }, position: { x: 80, y: 80 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 185 } },
    { id: "2", type: "input", data: { label: "Aggregate System Health APIs" }, position: { x: 80, y: 200 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 185 } },
    { id: "3", data: { label: "Run OpenRouter Gemini summarizing" }, position: { x: 340, y: 140 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 185 } },
    { id: "4", type: "output", data: { label: "Send email summary draft" }, position: { x: 600, y: 140 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 185 } }
  ],
  wf_backup: [
    { id: "1", type: "input", data: { label: "Midnight backup cron trigger" }, position: { x: 150, y: 40 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "2", data: { label: "Run pg_dump backup script" }, position: { x: 150, y: 130 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "3", data: { label: "AES-256 backup file encryption" }, position: { x: 150, y: 220 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
    { id: "4", type: "output", data: { label: "Push GCS archive bucket" }, position: { x: 150, y: 310 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } }
  ]
};

const defaultWfEdges: Record<string, Edge[]> = {
  wf_scan: [
    { id: "e1-2", source: "1", target: "2", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e2-3", source: "2", target: "3", style: { stroke: "rgba(255,255,255,0.2)" } }
  ],
  wf_leads: [
    { id: "e1-2", source: "1", target: "2", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e1-3", source: "1", target: "3", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e2-4", source: "2", target: "4", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e3-4", source: "3", target: "4", style: { stroke: "rgba(255,255,255,0.2)" } }
  ],
  wf_summary: [
    { id: "e1-3", source: "1", target: "3", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e2-3", source: "2", target: "3", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e3-4", source: "3", target: "4", style: { stroke: "rgba(255,255,255,0.2)" } }
  ],
  wf_backup: [
    { id: "e1-2", source: "1", target: "2", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e2-3", source: "2", target: "3", style: { stroke: "rgba(255,255,255,0.2)" } },
    { id: "e3-4", source: "3", target: "4", style: { stroke: "rgba(255,255,255,0.2)" } }
  ]
};

export default function WorkflowsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newWfName, setNewWfName] = useState("");
  const [newWfDesc, setNewWfDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [editingWorkflow, setEditingWorkflow] = useState<any | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [nodeLabel, setNodeLabel] = useState("");

  const { workflows, fetchWorkflows, fetchExecuteWorkflow, isAuthenticated, currentWorkspace } = useStore();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (currentWorkspace) fetchWorkflows();
  }, [currentWorkspace, fetchWorkflows]);

  useEffect(() => {
    if (searchParams?.get("new") === "1") {
      setIsModalOpen(true);
      router.replace("/workflows");
    }
  }, [searchParams, router]);

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.description && w.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeCount = workflows.filter((w) => w.status === "active").length;
  const draftCount = workflows.filter((w) => w.status === "draft").length;

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWfName) return;
    setCreating(true);
    try {
      await api.createWorkflow(currentWorkspace || "ws_prod", { name: newWfName, description: newWfDesc, definition: {} });
      await fetchWorkflows();
      setIsModalOpen(false);
      setNewWfName("");
      setNewWfDesc("");
    } catch (e) {
      console.error("createWorkflow", e);
      toast("error", "Failed to create workflow");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEditor = (workflow: any) => {
    setEditingWorkflow(workflow);
    const initialNodes = defaultWfNodes[workflow.id] || [
      { id: "1", type: "input", data: { label: "Trigger Node" }, position: { x: 150, y: 50 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } },
      { id: "2", type: "output", data: { label: "Action Node" }, position: { x: 150, y: 200 }, style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 } }
    ];
    const initialEdges = defaultWfEdges[workflow.id] || [
      { id: "e1-2", source: "1", target: "2", style: { stroke: "rgba(255,255,255,0.2)" } }
    ];
    setNodes(initialNodes);
    setEdges(initialEdges);
    setSelectedNode(null);
  };

  const onConnect = (params: Connection) => {
    setEdges((eds) => addEdge({ ...params, style: { stroke: "rgba(255,255,255,0.2)" } }, eds));
  };

  const handleAddNode = () => {
    const newId = String(nodes.length + 1);
    const newNode: Node = {
      id: newId,
      data: { label: `New Node ${newId}` },
      position: { x: 150, y: 150 },
      style: { background: "var(--void)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-primary)", borderRadius: "6px", fontSize: "11px", padding: "8px 12px", width: 180 }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setNodeLabel(node.data.label);
  };

  const handleSaveNodeProperties = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          n.data = { ...n.data, label: nodeLabel };
        }
        return n;
      })
    );
    setSelectedNode(null);
  };

  const handleDeleteNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
  };

  if (editingWorkflow) {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col animate-fade-in relative -m-4 lg:-m-6">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[var(--surface-1)] px-6 py-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setEditingWorkflow(null)}
              className="p-1.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-[15px] font-medium tracking-body flex items-center gap-3">
                {editingWorkflow.name} 
                <span className="text-[10px] px-2 py-0.5 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] font-mono rounded-full">v{editingWorkflow.version}</span>
              </h1>
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">Visual DAG Pipeline Editor // workspace: ws_prod</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleAddNode}
              className="btn-secondary"
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Add Node
            </button>
            <button 
              onClick={async () => { 
                try {
                  const steps = nodes.map(n => ({ id: n.id, label: n.data.label, type: n.id === '1' ? 'input' : n.type === 'output' ? 'output' : 'default' }));
                  await api.updateWorkflow(editingWorkflow.id, { definition: { nodes, edges } } as any);
                  await fetchWorkflows();
                  toast("success", "Workflow saved");
                  setEditingWorkflow(null);
                } catch (e) {
                  toast("error", "Failed to save workflow");
                }
              }}
              className="btn-primary"
            >
              <Save className="w-3.5 h-3.5" /> Save Changes
            </button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0 bg-[var(--void)]">
          <div className="flex-1 relative">
            {isClient ? (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                fitView
              >
                <Background color="rgba(255,255,255,0.1)" gap={16} size={1} />
                <Controls className="!bg-[var(--surface-1)] !border-[rgba(255,255,255,0.1)] !text-[var(--text-primary)] !fill-white !shadow-[var(--edge-subtle)] !rounded-md overflow-hidden" />
              </ReactFlow>
            ) : (
              <div className="h-full flex items-center justify-center text-[var(--text-tertiary)] text-[13px]">Loading nodes...</div>
            )}
            
            <div className="absolute top-4 left-4 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] p-3 rounded-lg pointer-events-none max-w-[220px]">
              <span className="font-medium tracking-body text-[13px] text-[var(--text-primary)] block mb-1">Quick Guide</span>
              <span className="text-[12px] text-[var(--text-secondary)] leading-relaxed">Drag nodes to move. Drag between handles to connect ports. Click a node to inspect and edit details.</span>
            </div>
          </div>

          <div className="w-72 flex-shrink-0 bg-[var(--surface-1)] border-l border-[rgba(255,255,255,0.06)] p-5 flex flex-col justify-between">
            {selectedNode ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-4">
                  <h3 className="text-[11px] font-medium uppercase tracking-micro text-[var(--text-secondary)]">Node Properties</h3>
                  <span className="text-[10px] bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full font-mono">ID: {selectedNode.id}</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Node Name</label>
                    <input 
                      type="text" 
                      value={nodeLabel}
                      onChange={(e) => setNodeLabel(e.target.value)}
                      className="input" 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Execution Mode</label>
                    <select className="input">
                      <option value="auto">Automatic (Orchestrator)</option>
                      <option value="manual">Require Manual Auditing</option>
                      <option value="disabled">Skip Execution</option>
                    </select>
                  </div>
                  
                  <div className="p-3 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] rounded-md space-y-1.5 text-[12px] text-[var(--text-secondary)]">
                    <span className="font-medium tracking-body text-[13px] text-[var(--text-primary)] block">Action Preview</span>
                    <code className="block font-mono text-[11px] text-[var(--text-tertiary)] truncate">cmd: playwright run --step={selectedNode.id}</code>
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button 
                    onClick={handleSaveNodeProperties}
                    className="btn-secondary flex-1 justify-center"
                  >
                    Apply
                  </button>
                  <button 
                    onClick={handleDeleteNode}
                    className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-4">
                <AlertCircle className="w-8 h-8 text-[var(--text-tertiary)] opacity-50" />
                <h4 className="text-[14px] font-medium tracking-body text-[var(--text-primary)]">Inspector Empty</h4>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">Select a workflow node in the canvas view to audit parameters and dependencies.</p>
              </div>
            )}

            <div className="text-[11px] font-mono text-[var(--text-tertiary)] border-t border-[rgba(255,255,255,0.06)] pt-4 mt-auto">
              Pipeline validation: <span className="text-[var(--success)]">Valid</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-ui-sweep className="page-shell animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Workflows</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Create, manage, and execute workflow automations.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">Total <GitBranch className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /></div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={workflows.length} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">Active <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /></div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={activeCount} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5">Draft <Clock className="w-3.5 h-3.5 text-[var(--warning)]" /></div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={draftCount} />
          </div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2">Archived</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">
            <AnimatedCounter value={workflows.length - activeCount - draftCount} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredWorkflows.map((workflow, idx) => {
          const config = statusConfig[workflow.status] || statusConfig.draft;
          return (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`card p-6 cursor-pointer hover:bg-[var(--surface-2)] transition-colors ${selectedWorkflow === workflow.id ? "bg-[var(--surface-2)]" : ""}`}
              onClick={() => setSelectedWorkflow(selectedWorkflow === workflow.id ? null : workflow.id)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center flex-shrink-0">
                    <GitBranch className="w-4 h-4 text-[var(--text-primary)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap mb-1">
                      <h3 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] truncate">{workflow.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-micro ${config.bg} ${config.color}`}>{config.label}</span>
                      <span className="text-[11px] font-mono text-[var(--text-tertiary)]">v{workflow.version}</span>
                    </div>
                    <p className="text-[13px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">{workflow.description}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-5 mt-5 pt-4 border-t border-[rgba(255,255,255,0.04)] text-[12px] font-mono text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1.5"><Play className="w-3.5 h-3.5" /> 0 runs</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> -</span>
                <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {workflow.created_at ? new Date(workflow.created_at).toLocaleDateString() : "-"}</span>
              </div>

              {selectedWorkflow === workflow.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="mt-5 pt-4 border-t border-[rgba(255,255,255,0.04)]"
                >
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await fetchExecuteWorkflow(workflow.id);
                          router.push("/runs");
                        } catch (e) {
                          console.error("fetchExecuteWorkflow", e);
                          toast("error", "Failed to execute workflow");
                        }
                      }}
                      className="btn-primary h-8 text-[12px] px-4"
                    >
                      <Play className="w-3 h-3 mr-1.5" /> Run
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEditor(workflow); }}
                      className="btn-secondary h-8 text-[12px] px-4"
                    >
                      <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Visual Builder
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        setPublishingId(workflow.id);
                        try { await api.publishWorkflow(workflow.id); await fetchWorkflows(); }
                        catch { toast("error", "Unable to publish workflow. Check your workspace role and API connection."); }
                        finally { setPublishingId(null); }
                      }}
                      disabled={publishingId === workflow.id}
                      className="btn-secondary h-8 text-[12px] px-4 disabled:opacity-50"
                    >
                      {publishingId === workflow.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1.5" />}
                      Publish
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const cron = window.prompt("Cron schedule (UTC), e.g. 0 9 * * 1-5");
                        if (!cron) return;
                        try { await api.createWorkflowSchedule(workflow.id, cron); toast("success", "Schedule created."); }
                        catch { toast("error", "Unable to create schedule. Use a valid cron expression."); }
                      }}
                      className="btn-ghost h-8 text-[12px] px-3"
                    >
                      Schedule
                    </button>
                  </div>
                </motion.div>
              )}
            </motion.div>
          );
        })}
        {workflows.length === 0 ? (
          <EmptyState
            icon={<GitBranch className="w-7 h-7" />}
            title="No workflows yet"
            description="Create your first workflow to automate AI agent tasks and chain operations."
            action={<button onClick={() => setIsModalOpen(true)} className="btn-primary"><Plus className="w-4 h-4" /> Create Workflow</button>}
          />
        ) : filteredWorkflows.length === 0 && (
          <EmptyState
            icon={<Search className="w-7 h-7" />}
            title="No matching workflows"
            description="No workflows match your search or filter. Try different keywords."
          />
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
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">New Workflow</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleCreateWorkflow} className="space-y-6">
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Workflow Name</label>
                  <input 
                    type="text" 
                    value={newWfName} 
                    onChange={e => setNewWfName(e.target.value)} 
                    placeholder="e.g. Sync Contacts to HubSpot" 
                    className="input" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Description <span className="text-[var(--text-tertiary)]">(Optional)</span></label>
                  <textarea 
                    value={newWfDesc} 
                    onChange={e => setNewWfDesc(e.target.value)} 
                    placeholder="What does this workflow automate?" 
                    className="input min-h-[100px] py-3 resize-none" 
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={creating} className="btn-primary min-w-[100px] justify-center">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
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
