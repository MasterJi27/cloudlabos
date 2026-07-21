"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { useToast } from "@/components/ui/Toast";
import { 
  Webhook, Plus, Trash2, Play, CheckCircle2, 
  XCircle, Clock, Activity, X, Check
} from "lucide-react";

interface WebhookEntry {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastTriggered: string | null;
}

interface DeliveryAttempt {
  id: string;
  webhookName: string;
  eventType: string;
  statusCode: 200 | 500;
  timestamp: string;
  responseTime: number;
}

const ALL_EVENTS = [
  "workflow.completed", 
  "workflow.failed", 
  "approval.required", 
  "agent.error", 
  "run.started", 
  "run.completed"
];

const initialWebhooks: WebhookEntry[] = [
  {
    id: "1",
    name: "Production Alerts",
    url: "https://api.example.com/webhooks/prod-alerts",
    events: ["workflow.failed", "agent.error"],
    active: true,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    name: "Audit Logging",
    url: "https://log-sink.example.com/webhook",
    events: ["workflow.completed", "run.started", "run.completed"],
    active: true,
    lastTriggered: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "3",
    name: "Slack Notifications",
    url: "https://hooks.slack.com/services/T000/B000/XXX",
    events: ["approval.required"],
    active: false,
    lastTriggered: null,
  }
];

const initialDeliveries: DeliveryAttempt[] = [
  { id: "d1", webhookName: "Production Alerts", eventType: "workflow.failed", statusCode: 200, timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), responseTime: 245 },
  { id: "d2", webhookName: "Audit Logging", eventType: "run.started", statusCode: 200, timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), responseTime: 120 },
  { id: "d3", webhookName: "Production Alerts", eventType: "agent.error", statusCode: 500, timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(), responseTime: 850 },
  { id: "d4", webhookName: "Slack Notifications", eventType: "approval.required", statusCode: 200, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), responseTime: 320 },
  { id: "d5", webhookName: "Audit Logging", eventType: "run.completed", statusCode: 200, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25).toISOString(), responseTime: 115 },
];

export default function WebhooksPage() {
  const { toast } = useToast();
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newActive, setNewActive] = useState(true);

  const [testingId, setTestingId] = useState<string | null>(null);
  const [testFeedback, setTestFeedback] = useState<Record<string, 'success' | 'error'>>({});

  useEffect(() => {
    if (!currentWorkspace) return;
    const load = async () => {
      try {
        const data = await api.listWebhooks(currentWorkspace) as any[];
        setWebhooks(data.map((d: any) => ({
          id: d.id,
          name: d.name,
          url: d.url,
          events: d.events,
          active: d.active,
          lastTriggered: d.created_at || null,
        })));
        setDeliveries(initialDeliveries);
      } catch (e) {
        setWebhooks(initialWebhooks);
        setDeliveries(initialDeliveries);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentWorkspace]);

  const handleRegister = async () => {
    if (!newName || !newUrl || newEvents.length === 0 || !currentWorkspace) return;
    try {
      const created = await api.createWebhook(currentWorkspace, { name: newName, url: newUrl, events: newEvents }) as any;
      if (!newActive) {
        await api.updateWebhook(created.id, { active: false });
        created.active = false;
      }
      setWebhooks([{ id: created.id, name: created.name, url: created.url, events: created.events, active: created.active, lastTriggered: null }, ...webhooks]);
      closeModal();
    } catch (e: any) {
      toast("error", e.message || "Failed to register webhook");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewName("");
    setNewUrl("");
    setNewEvents([]);
    setNewActive(true);
  };

  const toggleWebhook = async (id: string) => {
    const target = webhooks.find(w => w.id === id);
    if (!target) return;
    const nextActive = !target.active;
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: nextActive } : w));
    try {
      await api.updateWebhook(id, { active: nextActive });
    } catch (e: any) {
      setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !nextActive } : w));
      toast("error", e.message || "Failed to update webhook");
    }
  };

  const deleteWebhook = async (id: string) => {
    const prev = webhooks;
    setWebhooks(prev.filter(w => w.id !== id));
    try {
      await api.deleteWebhook(id);
    } catch (e: any) {
      setWebhooks(prev);
      toast("error", e.message || "Failed to delete webhook");
    }
  };

  const testWebhook = async (id: string) => {
    setTestingId(id);
    try {
      const result = await api.testWebhook(id);
      const isSuccess = result.status === "success";
      setTestFeedback(prev => ({ ...prev, [id]: isSuccess ? 'success' : 'error' }));

      const wh = webhooks.find(w => w.id === id);
      if (wh) {
        const newDelivery: DeliveryAttempt = {
          id: Date.now().toString(),
          webhookName: wh.name,
          eventType: "test.event",
          statusCode: isSuccess ? 200 : 500,
          timestamp: new Date().toISOString(),
          responseTime: parseInt(result.duration, 10) || 0,
        };
        setDeliveries(prev => [newDelivery, ...prev].slice(0, 5));
        setWebhooks(prev => prev.map(w => w.id === id ? { ...w, lastTriggered: new Date().toISOString() } : w));
      }
    } catch (e: any) {
      toast("error", e.message || "Failed to test webhook");
    } finally {
      setTimeout(() => {
        setTestFeedback(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setTestingId(null);
      }, 3000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-24 px-6 pt-12 animate-fade-in">
      
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <h1 className="text-[32px] tracking-header-lg font-medium text-[var(--text-primary)] mb-2">Webhooks</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage outgoing webhooks for system events and notifications.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Register Webhook
        </button>
      </header>

      {/* Webhooks List */}
      <div className="mb-20">
        <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6">Registered Webhooks</h2>
        
        {webhooks.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-[var(--text-tertiary)] border border-[rgba(255,255,255,0.04)] border-dashed rounded-xl">
            <Webhook className="w-8 h-8 mb-4 opacity-40" />
            <p className="text-[14px] font-medium text-[var(--text-secondary)]">No webhooks configured</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {webhooks.map((wh, idx) => (
              <motion.div
                key={wh.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group flex flex-col sm:flex-row gap-6 p-6 -mx-6 rounded-xl hover:bg-[var(--surface-1)] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] truncate">{wh.name}</h3>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full shadow-[var(--edge-subtle)] bg-[var(--surface-1)]">
                      <span className={`w-1.5 h-1.5 rounded-full ${wh.active ? "bg-[var(--success)]" : "bg-[var(--text-tertiary)]"}`} />
                      <span className="text-[11px] font-medium tracking-micro text-[var(--text-secondary)]">
                        {wh.active ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-[13px] text-[var(--text-secondary)] font-mono truncate mb-4">{wh.url}</p>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {wh.events.map(event => (
                      <span key={event} className="px-2 py-1 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] rounded-md text-[12px] font-mono tracking-tight">
                        {event}
                      </span>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 text-[12px] font-mono text-[var(--text-tertiary)]">
                    <Clock className="w-3.5 h-3.5" />
                    Last triggered: {wh.lastTriggered ? new Date(wh.lastTriggered).toLocaleString() : "Never"}
                  </div>
                </div>

                <div className="flex sm:flex-col justify-end items-center sm:items-end gap-3 shrink-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[12px] font-medium tracking-body text-[var(--text-secondary)]">Status</span>
                    <button
                      onClick={() => toggleWebhook(wh.id)}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${wh.active ? 'bg-[var(--text-primary)]' : 'bg-[var(--surface-3)]'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-[var(--void)] rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${wh.active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-2 relative">
                    <button 
                      onClick={() => testWebhook(wh.id)}
                      disabled={testingId === wh.id || !wh.active}
                      className="btn-secondary text-[12px] h-8 px-3"
                    >
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Test
                    </button>
                    
                    <button 
                      onClick={() => deleteWebhook(wh.id)}
                      className="btn-ghost px-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] h-8"
                      title="Delete webhook"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <AnimatePresence>
                      {testFeedback[wh.id] && (
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={`absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap z-10 flex items-center gap-1.5 shadow-[var(--edge-subtle)] ${
                            testFeedback[wh.id] === 'success' ? 'bg-[var(--surface-1)] text-[var(--success)]' : 'bg-[var(--surface-1)] text-[var(--danger)]'
                          }`}
                        >
                          {testFeedback[wh.id] === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {testFeedback[wh.id] === 'success' ? 'Delivery Success' : 'Delivery Failed'}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Deliveries */}
      <div className="pt-12 border-t border-[rgba(255,255,255,0.06)]">
        <h2 className="text-[15px] font-medium tracking-body text-[var(--text-primary)] mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--text-secondary)]" />
          Recent Deliveries
        </h2>
        
        <div className="w-full">
          <div className="flex border-b border-[rgba(255,255,255,0.06)] text-[11px] font-medium text-[var(--text-tertiary)] tracking-micro pb-3 px-4">
            <div className="w-1/4">Webhook</div>
            <div className="w-1/4">Event</div>
            <div className="w-1/6">Status</div>
            <div className="w-1/5">Time</div>
            <div className="w-1/6 text-right">Response Time</div>
          </div>

          <div className="divide-y divide-[rgba(255,255,255,0.04)]">
            {deliveries.map((delivery) => (
              <div key={delivery.id} className="flex items-center py-4 px-4 -mx-4 rounded-lg hover:bg-[var(--surface-1)] transition-colors">
                <div className="w-1/4 pr-4">
                  <span className="text-[13px] font-medium tracking-body text-[var(--text-primary)] truncate block">{delivery.webhookName}</span>
                </div>
                <div className="w-1/4 pr-4">
                  <span className="text-[12px] font-mono text-[var(--text-secondary)] truncate block">{delivery.eventType}</span>
                </div>
                <div className="w-1/6 pr-4">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium shadow-[var(--edge-subtle)] bg-[var(--surface-2)] ${
                    delivery.statusCode === 200 ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}>
                    {delivery.statusCode === 200 ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {delivery.statusCode}
                  </span>
                </div>
                <div className="w-1/5 pr-4">
                  <span className="text-[12px] font-mono text-[var(--text-tertiary)] block">{new Date(delivery.timestamp).toLocaleString()}</span>
                </div>
                <div className="w-1/6 text-right">
                  <span className="text-[12px] font-mono text-[var(--text-secondary)]">{delivery.responseTime}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registration Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={closeModal}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--void)] shadow-[var(--elev-3)] rounded-2xl overflow-hidden border border-[rgba(255,255,255,0.1)]"
            >
              <div className="flex items-center justify-between p-6 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)]">Register Webhook</h2>
                <button 
                  onClick={closeModal}
                  className="p-1.5 rounded-md hover:bg-[var(--surface-1)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium tracking-body text-[var(--text-secondary)]">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g., Slack Notifications"
                    className="input"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[13px] font-medium tracking-body text-[var(--text-secondary)]">Endpoint URL</label>
                  <input
                    type="url"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder="https://your-domain.com/webhook"
                    className="input font-mono"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[13px] font-medium tracking-body text-[var(--text-secondary)] flex items-center justify-between">
                    Event Types
                    <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                      {newEvents.length} selected
                    </span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ALL_EVENTS.map(event => {
                      const isSelected = newEvents.includes(event);
                      return (
                        <label 
                          key={event} 
                          className={`flex items-center gap-3 p-3 rounded-lg shadow-[var(--edge-subtle)] cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-[var(--surface-2)] text-[var(--text-primary)]' 
                              : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-[var(--text-primary)] border-[var(--text-primary)]' : 'border-[rgba(255,255,255,0.2)] bg-transparent'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-[var(--void)]" />}
                          </div>
                          <span className="text-[12px] font-mono">
                            {event}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Active on Creation</span>
                    <button
                      onClick={() => setNewActive(!newActive)}
                      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${newActive ? 'bg-[var(--text-primary)]' : 'bg-[var(--surface-3)]'}`}
                    >
                      <div className={`w-3.5 h-3.5 bg-[var(--void)] rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${newActive ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6 shadow-[0_-1px_0_0_rgba(255,255,255,0.06)] bg-[var(--surface-1)] flex justify-end gap-3">
                <button onClick={closeModal} className="btn-secondary">
                  Cancel
                </button>
                <button 
                  onClick={handleRegister} 
                  disabled={!newName || !newUrl || newEvents.length === 0}
                  className="btn-primary"
                >
                  Register Webhook
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
