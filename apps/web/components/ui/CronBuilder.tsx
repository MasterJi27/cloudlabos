"use client";

import { useState, useMemo } from "react";
import { X, Clock, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

type Frequency = "hourly" | "daily" | "weekly" | "monthly" | "custom";

const DAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** Build a 5-field cron expression from the chosen options. */
function buildCron(freq: Frequency, minute: number, hour: number, days: number[], dom: number, custom: string): string {
  switch (freq) {
    case "hourly": return `${minute} * * * *`;
    case "daily": return `${minute} ${hour} * * *`;
    case "weekly": return `${minute} ${hour} * * ${days.length ? [...days].sort().join(",") : "1"}`;
    case "monthly": return `${minute} ${hour} ${dom} * *`;
    case "custom": return custom.trim();
  }
}

function describe(freq: Frequency, minute: number, hour: number, days: number[], dom: number): string {
  const t = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} UTC`;
  switch (freq) {
    case "hourly": return `Every hour at minute ${minute}`;
    case "daily": return `Every day at ${t}`;
    case "weekly": {
      const names = [...days].sort().map((d) => DAYS.find((x) => x.value === d)?.label).filter(Boolean);
      return names.length ? `Every ${names.join(", ")} at ${t}` : "Pick at least one day";
    }
    case "monthly": return `Day ${dom} of each month at ${t}`;
    case "custom": return "Custom cron expression";
  }
}

interface CronBuilderProps {
  onSave: (cron: string) => Promise<void> | void;
  onClose: () => void;
  workflowName?: string;
}

export function CronBuilder({ onSave, onClose, workflowName }: CronBuilderProps) {
  const [freq, setFreq] = useState<Frequency>("daily");
  const [minute, setMinute] = useState(0);
  const [hour, setHour] = useState(9);
  const [days, setDays] = useState<number[]>([1]);
  const [dom, setDom] = useState(1);
  const [custom, setCustom] = useState("0 9 * * 1-5");
  const [saving, setSaving] = useState(false);

  const cron = useMemo(() => buildCron(freq, minute, hour, days, dom, custom), [freq, minute, hour, days, dom, custom]);
  const summary = describe(freq, minute, hour, days, dom);
  const valid = cron.trim().split(/\s+/).length === 5;

  const toggleDay = (d: number) =>
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try { await onSave(cron); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-8 shadow-[var(--elev-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-[20px] font-medium tracking-subheader text-[var(--text-primary)] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[var(--text-secondary)]" /> Schedule
            </h2>
            {workflowName && <p className="text-[13px] text-[var(--text-secondary)] mt-1 truncate">{workflowName}</p>}
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Frequency</label>
            <div className="grid grid-cols-5 gap-2">
              {(["hourly", "daily", "weekly", "monthly", "custom"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFreq(f)}
                  className={`py-2 px-2 text-[12px] font-medium rounded-lg capitalize transition-colors ${
                    freq === f
                      ? "bg-[var(--text-primary)] text-[var(--void)]"
                      : "bg-[var(--surface-1)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {freq === "weekly" && (
            <div>
              <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`w-12 py-2 text-[12px] font-medium rounded-lg transition-colors ${
                      days.includes(d.value)
                        ? "bg-[var(--text-primary)] text-[var(--void)]"
                        : "bg-[var(--surface-1)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {freq === "monthly" && (
            <div>
              <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Day of month</label>
              <input type="number" min={1} max={31} value={dom}
                onChange={(e) => setDom(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                className="input w-28 text-center font-mono" />
            </div>
          )}

          {freq === "custom" ? (
            <div>
              <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">
                Cron expression <span className="text-[var(--text-tertiary)]">(min hour dom month dow)</span>
              </label>
              <input type="text" value={custom} onChange={(e) => setCustom(e.target.value)}
                placeholder="0 9 * * 1-5" className="input font-mono" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {freq !== "hourly" && (
                <div>
                  <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Hour (UTC)</label>
                  <input type="number" min={0} max={23} value={hour}
                    onChange={(e) => setHour(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                    className="input text-center font-mono" />
                </div>
              )}
              <div>
                <label className="block text-[12px] font-medium tracking-body text-[var(--text-secondary)] mb-2">Minute</label>
                <input type="number" min={0} max={59} value={minute}
                  onChange={(e) => setMinute(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                  className="input text-center font-mono" />
              </div>
            </div>
          )}

          <div className="p-4 bg-[var(--surface-1)] rounded-lg shadow-[var(--edge-subtle)]">
            <p className="text-[12px] text-[var(--text-secondary)] mb-1.5">{summary}</p>
            <code className="text-[13px] font-mono text-[var(--text-primary)]">{cron || "—"}</code>
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="button" onClick={handleSave} disabled={!valid || saving} className="btn-primary min-w-[120px] justify-center disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create schedule"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
