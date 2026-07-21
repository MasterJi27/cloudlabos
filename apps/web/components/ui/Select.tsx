"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, className = "", ...props }, ref) => (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[11px] uppercase tracking-wide font-medium text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={`w-full px-3 py-2.5 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] border-none rounded-[var(--radius-md)] text-[13px] text-[var(--text-primary)] focus:outline-none focus:shadow-[var(--edge-default),0_0_0_2px_var(--focus-ring)] transition-shadow duration-[var(--duration-fast)] appearance-none cursor-pointer ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-[var(--surface-1)]">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
);
Select.displayName = "Select";
