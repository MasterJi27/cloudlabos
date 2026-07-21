"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

const SHORTCUTS = [
  { keys: "g d", label: "Dashboard", action: "/" },
  { keys: "g a", label: "Agents", action: "/agents" },
  { keys: "g w", label: "Workflows", action: "/workflows" },
  { keys: "g r", label: "Runs", action: "/runs" },
  { keys: "g m", label: "Memory", action: "/memory" },
  { keys: "g p", label: "Approvals", action: "/approvals" },
  { keys: "g s", label: "Settings", action: "/settings" },
  { keys: "g t", label: "Terminal", action: "/terminal" },
  { keys: "g l", label: "Logs", action: "/logs" },
  { keys: "g n", label: "Analytics", action: "/analytics" },
  { keys: "n", label: "Create workflow", action: "/workflows/new" },
  { keys: "p", label: "Provision agent", action: "/agents/provision" },
  { keys: "?", label: "Show shortcuts", action: "cheatsheet" },
  { keys: "⌘K", label: "Command palette", action: "palette" },
];

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
            className="w-full max-w-md bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 shadow-[var(--elev-3)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-medium text-[var(--text-primary)]">Keyboard Shortcuts</h2>
              <button onClick={() => setShowCheatSheet(false)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {SHORTCUTS.map(s => (
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
