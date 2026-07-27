"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const SHORTCUTS = [
  { keys: "g d", label: "Dashboard", action: "/", group: "Navigation" },
  { keys: "g a", label: "Agents", action: "/agents", group: "Navigation" },
  { keys: "g w", label: "Workflows", action: "/workflows", group: "Navigation" },
  { keys: "g r", label: "Runs", action: "/runs", group: "Navigation" },
  { keys: "g m", label: "Memory", action: "/memory", group: "Navigation" },
  { keys: "g p", label: "Approvals", action: "/approvals", group: "Navigation" },
  { keys: "g s", label: "Settings", action: "/settings", group: "Navigation" },
  { keys: "g t", label: "Terminal", action: "/terminal", group: "Navigation" },
  { keys: "g l", label: "Logs & Audit", action: "/logs", group: "Navigation" },
  { keys: "g n", label: "Analytics", action: "/analytics", group: "Navigation" },
  { keys: "g b", label: "Billing", action: "/billing", group: "Navigation" },
  { keys: "g i", label: "Team members", action: "/invitations", group: "Navigation" },
  { keys: "g h", label: "Webhooks", action: "/webhooks", group: "Navigation" },
  { keys: "n", label: "Create workflow", action: "/workflows/new", group: "Actions" },
  { keys: "p", label: "Provision agent", action: "/agents/provision", group: "Actions" },
  { keys: "⌘K", label: "Command palette (search everything)", action: "palette", group: "Actions" },
  { keys: "?", label: "Show this help", action: "cheatsheet", group: "Actions" },
];

const GROUPS = ["Navigation", "Actions"] as const;

export function KeyboardShortcuts() {
  const router = useRouter();
  const { toast } = useToast();
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const bufferRef = useRef<string[]>([]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      const key = e.key.toLowerCase();

      if (key === "?") {
        e.preventDefault();
        setShowCheatSheet(prev => !prev);
        return;
      }

      const next = [...bufferRef.current, key];

      const match = SHORTCUTS.find(s => s.keys === next.join(" "));
      if (match) {
        e.preventDefault();
        bufferRef.current = [];
        if (match.action === "cheatsheet") {
          setShowCheatSheet(true);
        } else if (match.action === "palette") {
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
        } else {
          toast("info", `Navigating to ${match.label}`);
          router.push(match.action);
        }
        return;
      }

      const partial = SHORTCUTS.some(s => s.keys.startsWith(next.join(" ")));
      if (partial && next.length < 3) {
        bufferRef.current = next;
        clearTimeout(timeout);
        timeout = setTimeout(() => { bufferRef.current = []; }, 1500);
      } else {
        bufferRef.current = [];
      }
    };

    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      clearTimeout(timeout);
    };
  }, [router, toast]);

  return (
    <AnimatePresence>
      {showCheatSheet && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowCheatSheet(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-lg bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 shadow-[var(--elev-3)] max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[16px] font-medium text-[var(--text-primary)]">Keyboard Shortcuts</h2>
                <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">Press <kbd className="font-mono">?</kbd> anytime to reopen this.</p>
              </div>
              <button onClick={() => setShowCheatSheet(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-6">
              {GROUPS.map(group => (
                <div key={group}>
                  <h3 className="text-[11px] font-medium tracking-micro uppercase text-[var(--text-tertiary)] mb-2">{group}</h3>
                  <div className="space-y-1">
                    {SHORTCUTS.filter(s => s.group === group).map(s => (
                      <div key={s.keys} className="flex items-center justify-between py-1.5">
                        <span className="text-[13px] text-[var(--text-secondary)]">{s.label}</span>
                        <kbd className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--surface-1)] border border-[rgba(255,255,255,0.06)] rounded-md text-[11px] font-mono text-[var(--text-primary)]">
                          {s.keys.split(" ").map((k, i) => (
                            <span key={i} className="flex items-center gap-1">
                              {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-[var(--text-tertiary)]" />}
                              <span>{k === "⌘K" ? "⌘K" : k.toUpperCase()}</span>
                            </span>
                          ))}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
