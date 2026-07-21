"use client";

import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
}

export function Card({ hover = true, children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-[var(--radius-lg)] transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] ${hover ? "hover:shadow-[var(--elev-2)]" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 border-b border-[rgba(255,255,255,0.06)] ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}
