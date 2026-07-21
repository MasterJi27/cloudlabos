"use client";

import { Cpu } from "lucide-react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };

export function Spinner({ size = "md", label }: SpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Cpu className={`${sizes[size]} text-[var(--accent)] animate-pulse`} />
      <div className={`${sizes[size]} border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin`} />
      {label && <p className="text-[12px] text-[var(--text-secondary)]">{label}</p>}
    </div>
  );
}
