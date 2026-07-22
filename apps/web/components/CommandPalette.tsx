"use client";

import { useEffect, useState, useRef } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Terminal, Activity, Shield, Cpu, Play, Workflow, Settings,
  Search, BookOpen, GitBranch, Database, Clock, FileText
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";

interface SearchHit { type: string; id: string; title: string; subtitle: string; url: string }

const typeIcon: Record<string, any> = {
  agent: Cpu, workflow: Workflow, run: Play, memory: Database, collection: Database,
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [recent, setRecent] = useState<SearchHit[]>([]);
  const router = useRouter();
  const currentWorkspace = useAuthStore((s) => s.currentWorkspace);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!open) { setQuery(""); setHits([]); return; }
    try {
      const raw = localStorage.getItem("cloudlabos-recent");
      if (raw) setRecent(JSON.parse(raw).slice(0, 5));
    } catch {}
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !currentWorkspace) { setHits([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.search(currentWorkspace, query.trim());
        setHits(res.results || []);
      } catch { setHits([]); }
    }, 200);
  }, [query, currentWorkspace]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const goToHit = (hit: SearchHit) => {
    try {
      const next = [hit, ...recent.filter((r) => r.id !== hit.id)].slice(0, 5);
      localStorage.setItem("cloudlabos-recent", JSON.stringify(next));
    } catch {}
    runCommand(() => router.push(hit.url));
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
        shouldFilter={!query.trim()}
        loop
      >
        <div className="flex items-center border-b border-[rgba(255,255,255,0.06)] px-4">
          <Search className="mr-3 h-5 w-5 text-[var(--text-tertiary)] shrink-0" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search agents, workflows, memory, runs..."
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

          {query.trim() && hits.length > 0 && (
            <Command.Group heading="Results" className="px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              {hits.map((hit) => {
                const Icon = typeIcon[hit.type] || FileText;
                return (
                  <Command.Item key={`${hit.type}-${hit.id}`} value={`${hit.title} ${hit.type} ${hit.id}`} onSelect={() => goToHit(hit)} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
                    <Icon className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)] shrink-0" />
                    <span className="truncate flex-1">{hit.title}</span>
                    <span className="ml-3 text-[11px] text-[var(--text-tertiary)] capitalize shrink-0">{hit.type}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

          {!query.trim() && recent.length > 0 && (
            <Command.Group heading="Recent" className="px-2 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
              {recent.map((hit) => {
                const Icon = typeIcon[hit.type] || Clock;
                return (
                  <Command.Item key={`recent-${hit.id}`} value={`recent ${hit.title}`} onSelect={() => goToHit(hit)} className="flex cursor-pointer select-none items-center rounded-md px-3 py-2.5 text-sm outline-none aria-selected:bg-[var(--surface-2)] aria-selected:text-[var(--text-primary)] text-[var(--text-secondary)] group transition-colors">
                    <Icon className="mr-3 h-4 w-4 text-[var(--text-tertiary)] group-aria-selected:text-[var(--text-primary)] shrink-0" />
                    <span className="truncate flex-1">{hit.title}</span>
                    <span className="ml-3 text-[11px] text-[var(--text-tertiary)] capitalize shrink-0">{hit.type}</span>
                  </Command.Item>
                );
              })}
            </Command.Group>
          )}

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
