"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.98]",
  secondary: "bg-[var(--surface-2)] text-[var(--text-primary)] shadow-[var(--edge-subtle)] hover:bg-[var(--surface-3)] hover:shadow-[var(--edge-default)] active:scale-[0.98]",
  ghost: "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]",
  danger: "bg-[var(--danger)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110 active:scale-[0.98]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[12px] gap-1.5",
  md: "px-3.5 py-2 text-[13px] gap-2",
  lg: "px-5 py-2.5 text-[14px] gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, children, disabled, className = "", ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-[var(--radius-md)] font-medium transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
