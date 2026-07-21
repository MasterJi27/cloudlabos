"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = "", ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] uppercase tracking-wide font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2.5 px-3 bg-[var(--surface-1)] rounded-[var(--radius-md)] shadow-[var(--edge-subtle)] focus-within:shadow-[var(--edge-default),0_0_0_2px_var(--focus-ring)] transition-shadow duration-[var(--duration-fast)]">
        {icon && (
          <span className="flex-shrink-0 text-[var(--text-tertiary)]">{icon}</span>
        )}
        <input
          ref={ref}
          className={`flex-1 bg-transparent outline-none py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] text-[var(--danger)]">{error}</p>
      )}
    </div>
  ),
);
Input.displayName = "Input";
