"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2 flex-shrink-0 ${checked ? "bg-[var(--accent)]" : "bg-[var(--surface-3)]"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-transform duration-200 shadow-sm ${checked ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
    </button>
  );
}
