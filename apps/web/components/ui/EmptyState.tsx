"use client";
import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-24 px-6"
    >
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-1)] shadow-[var(--edge-subtle)] flex items-center justify-center mb-6 text-[var(--text-tertiary)]">
        {icon}
      </div>
      <h3 className="text-[16px] font-medium text-[var(--text-primary)] tracking-subheader mb-1">{title}</h3>
      <p className="text-[14px] text-[var(--text-secondary)] max-w-md mb-6">{description}</p>
      {action}
    </motion.div>
  );
}
