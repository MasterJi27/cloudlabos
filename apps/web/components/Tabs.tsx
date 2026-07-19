"use client";

import { motion } from "framer-motion";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-6 border-b border-[rgba(255,255,255,0.06)] relative">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`pb-3 text-[14px] font-medium transition-colors relative ${
              isActive ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-[var(--text-primary)]"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
