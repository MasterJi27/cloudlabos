"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { 
  Terminal, Activity, Shield, Cpu, Play, Workflow, Settings, 
  Search, BookOpen, GitBranch
} from "lucide-react";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={() => setOpen(false)}
      />
      <Command 
        className="relative z-50 w-full max-w-[640px] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.1)] bg-[var(--void)] shadow-2xl animate-fade-in mx-4"
        shouldFilter={true}
        loop
      >
        <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] px-4">
          <Search className="mr-3 h-5 w-5 text-[var(--text-tertiary)] shrink-0" />
          <Command.Input 
            autoFocus 
            placeholder="Search agents, workflows, or commands..." 
            className="flex h-14 w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)]"
          />
          <div className="flex shrink-0 items-center gap-1">
            <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-[rgba(255,255,255,0.1)] bg-[var(--surface-1)] px-1.5 font-mono text-[10px] font-medium text-[var(--text-secondary)]">
              ESC
            </kbd>
          </div>
        </div>
        <Command.List className="max-h-[360px] overflow-y-auto p-2 scroll-smooth">
          <Command.Empty className="py-6 text-center text-sm text-[var(--text-secondary)]">
            No results found.
          </Command.Empty>
          
          <Command.Group heading="Navigation" className="px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            <Command.Item onSelect={() => runCommand(() => router.push('/'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 text-[var(--text-secondary)] group transition-colors">
              <Activity className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Dashboard Overview
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => router.push('/agents'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Cpu className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Agent Fleet Registry
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => router.push('/approvals'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Shield className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Approval Queue
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => router.push('/runs'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Play className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Execution History
            </Command.Item>
          </Command.Group>

          <Command.Separator className="my-1 h-px bg-[rgba(255,255,255,0.06)] mx-2" />

          <Command.Group heading="Quick Actions" className="px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            <Command.Item onSelect={() => runCommand(() => router.push('/workflows/new'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Workflow className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--accent)]" />
              Create new workflow...
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => router.push('/agents/provision'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <GitBranch className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--accent)]" />
              Provision new agent node
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => router.push('/terminal'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Terminal className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Open Global Terminal
            </Command.Item>
          </Command.Group>

          <Command.Separator className="my-1 h-px bg-[rgba(255,255,255,0.06)] mx-2" />

          <Command.Group heading="Settings & Docs" className="px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            <Command.Item onSelect={() => runCommand(() => router.push('/settings'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <Settings className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Workspace Settings
            </Command.Item>
            <Command.Item onSelect={() => runCommand(() => window.open('https://docs.cloudlabos.dev', '_blank'))} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
              <BookOpen className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)]" />
              Documentation
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
