"use client";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "default";
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = "Delete", variant = "danger" }: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="w-full max-w-sm bg-[var(--void)] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 shadow-[var(--elev-3)]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                variant === "danger" ? "bg-[var(--danger)]/10 text-[var(--danger)]" :
                variant === "warning" ? "bg-[var(--warning)]/10 text-[var(--warning)]" :
                "bg-[var(--surface-2)] text-[var(--text-primary)]"
              }`}>
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-medium text-[var(--text-primary)]">{title}</h3>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1 leading-relaxed">{message}</p>
              </div>
              <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[rgba(255,255,255,0.06)]">
              <button onClick={onClose} className="btn-secondary h-8 text-[12px] px-4">Cancel</button>
              <button onClick={() => { onConfirm(); onClose(); }} className={`h-8 text-[12px] px-4 rounded-lg font-medium transition-colors ${
                variant === "danger" ? "bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90" :
                variant === "warning" ? "bg-[var(--warning)] text-black hover:bg-[var(--warning)]/90" :
                "btn-primary"
              }`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
