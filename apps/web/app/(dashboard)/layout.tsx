"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import {
  LayoutDashboard, Workflow, Play, Shield, Database, Cpu,
  Terminal, Globe, Plug, BarChart3, FileText, Settings, Bell, Search,
  ChevronLeft, LogOut, CreditCard, Mail, Webhook, ChevronDown,
  X, ChevronRight, Check, AlertTriangle, Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";

const navGroups = [
  {
    title: "Operations",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/" },
      { icon: Workflow, label: "Workflows", path: "/workflows" },
      { icon: Play, label: "Runs", path: "/runs" },
    ]
  },
  {
    title: "AI Orchestration",
    items: [
      { icon: Cpu, label: "Agents", path: "/agents" },
      { icon: Database, label: "Memory", path: "/memory" },
      { icon: Shield, label: "Approvals", path: "/approvals" },
    ]
  },
  {
    title: "Developer Tools",
    items: [
      { icon: Terminal, label: "Terminal", path: "/terminal" },
      { icon: Globe, label: "Browser", path: "/browser" },
      { icon: Webhook, label: "Webhooks", path: "/webhooks" },
      { icon: FileText, label: "Logs", path: "/logs" },
      { icon: Plug, label: "Plugins", path: "/plugins" },
    ]
  },
  {
    title: "Settings & Billing",
    items: [
      { icon: BarChart3, label: "Analytics", path: "/analytics" },
      { icon: CreditCard, label: "Billing", path: "/billing" },
      { icon: Mail, label: "Invitations", path: "/invitations" },
      { icon: Settings, label: "Settings", path: "/settings" },
    ]
  }
];

const allNavItems = navGroups.flatMap(g => g.items);

const MOCK_NOTIFICATIONS = [
  { id: "n1", type: "success" as const, title: "Deployment Successful", desc: "Workflow 'daily-scraper' deployed to production", time: "2m ago", read: false },
  { id: "n2", type: "warning" as const, title: "Approval Required", desc: "Agent 'sentinel-v2' requesting elevated permissions", time: "15m ago", read: false },
  { id: "n3", type: "error" as const, title: "Pipeline Failed", desc: "Run #3842 exited with code 1 at step 'validate'", time: "1h ago", read: false },
  { id: "n4", type: "info" as const, title: "New Plugin Available", desc: "Datadog Metrics Exporter v2.1.0 released", time: "3h ago", read: true },
  { id: "n5", type: "success" as const, title: "Agent Online", desc: "Vision agent 'hawk-eye' reconnected", time: "5h ago", read: true },
];

function getPageLabel(pathname: string): string {
  const item = allNavItems.find(i => i.path === pathname || (i.path !== "/" && pathname.startsWith(i.path)));
  return item?.label || "Dashboard";
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, logout, workspaces, currentWorkspace } = useStore();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const triggerCommandPalette = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
  };

  if (!mounted) return <div className="min-h-screen bg-[var(--void)]" />;

  const handleWorkspaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    useStore.setState({ currentWorkspace: e.target.value });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotif = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const notifIcon = (type: string) => {
    if (type === "success") return <Check className="w-3.5 h-3.5 text-[var(--success)]" />;
    if (type === "warning") return <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />;
    if (type === "error") return <Zap className="w-3.5 h-3.5 text-[var(--danger)]" />;
    return <Bell className="w-3.5 h-3.5 text-[var(--text-secondary)]" />;
  };

  return (
    <div className="min-h-screen flex bg-[var(--void)]">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col bg-[var(--void)] shadow-[1px_0_0_0_rgba(255,255,255,0.06)] transition-all duration-200 ${collapsed ? "w-14" : "w-[240px]"}`}
      >
        {/* Brand / Workspace Header */}
        <div className="h-14 flex items-center px-4 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] gap-2">
          {!collapsed ? (
            <div className="flex-1 min-w-0 relative flex items-center gap-2">
              <div className="w-5 h-5 rounded-[4px] bg-[var(--text-primary)] flex items-center justify-center text-[var(--void)] text-[10px] font-bold flex-shrink-0">
                {workspaces.find(w => w.id === currentWorkspace)?.name?.charAt(0) || "P"}
              </div>
              <div className="flex-1 min-w-0 flex items-center relative group">
                <select
                  value={currentWorkspace || "ws_prod"}
                  onChange={handleWorkspaceChange}
                  className="w-full bg-transparent text-[13px] font-medium tracking-body text-[var(--text-primary)] focus:outline-none cursor-pointer pr-4 appearance-none"
                >
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id} className="bg-[var(--surface-1)] text-[var(--text-primary)]">{ws.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 absolute right-0 text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] pointer-events-none transition-colors" />
              </div>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-[4px] bg-[var(--text-primary)] flex items-center justify-center text-[var(--void)] text-[10px] font-bold mx-auto flex-shrink-0">
              {workspaces.find(w => w.id === currentWorkspace)?.name?.charAt(0) || "P"}
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              {!collapsed && (
                <h3 className="px-2 pb-1 text-[11px] font-medium tracking-micro text-[var(--text-tertiary)]">
                  {group.title}
                </h3>
              )}
              <div className="space-y-[2px]">
                {group.items.map((item) => {
                  const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      title={collapsed ? item.label : undefined}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] tracking-body transition-colors ${
                        isActive
                          ? "bg-[var(--surface-2)] text-[var(--text-primary)] shadow-[var(--edge-subtle)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </a>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 shadow-[0_-1px_0_0_rgba(255,255,255,0.06)]">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 px-2 py-1">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center text-[var(--text-primary)] text-[11px] font-medium flex-shrink-0">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium tracking-body text-[var(--text-primary)] truncate">{user?.name || "User"}</p>
                </div>
              </div>
              <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-[var(--surface-1)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCollapsed(false)}
              className="w-6 h-6 rounded-full bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center text-[var(--text-primary)] text-[11px] font-medium mx-auto flex-shrink-0 hover:bg-[var(--surface-3)] transition-colors"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`flex-1 transition-all duration-200 ${collapsed ? "ml-14" : "ml-[240px]"}`}>
        
        {/* Topbar */}
        <header className="h-14 shadow-[0_1px_0_0_rgba(255,255,255,0.06)] flex items-center justify-between px-6 bg-[var(--void)] sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-[13px] tracking-body text-[var(--text-secondary)]">
              <span className="text-[var(--text-tertiary)]">CloudLabOS</span>
              <span className="text-[var(--text-tertiary)]">/</span>
              <span className="text-[var(--text-primary)] font-medium">{getPageLabel(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Command Palette Trigger */}
            <button
              onClick={triggerCommandPalette}
              className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] rounded-md text-[12px] tracking-body text-[var(--text-secondary)] hover:bg-[var(--surface-2)] transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[var(--surface-2)] shadow-[var(--edge-subtle)] rounded text-[10px] text-[var(--text-secondary)] font-mono">
                ⌘K
              </kbd>
            </button>

            <div className="w-px h-4 bg-[rgba(255,255,255,0.06)] mx-1" />

            {/* Notification Bell */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                className="relative p-1.5 rounded-md hover:bg-[var(--surface-1)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center bg-[var(--accent)] text-[var(--accent-foreground)] text-[9px] font-bold rounded-full px-0.5">
                    {unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-10 w-80 bg-[var(--void)] shadow-[var(--elev-3)] rounded-xl z-50 overflow-hidden border border-[rgba(255,255,255,0.1)]"
                  >
                    <div className="flex items-center justify-between px-4 py-3 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
                      <h4 className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Notifications</h4>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Mark all read</button>
                      )}
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y divide-[rgba(255,255,255,0.04)]">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[12px] tracking-body text-[var(--text-tertiary)]">No notifications</div>
                      ) : notifications.map(n => (
                        <div key={n.id} className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-1)] transition-colors group ${!n.read ? "bg-[var(--surface-1)]" : ""}`}>
                          <div className="mt-0.5 flex-shrink-0">{notifIcon(n.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium tracking-body ${!n.read ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{n.title}</p>
                            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5 leading-relaxed">{n.desc}</p>
                            <p className="text-[11px] font-mono text-[var(--text-tertiary)] mt-1.5">{n.time}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); dismissNotif(n.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <div className="min-h-[calc(100vh-56px)] bg-[var(--void)]">{children}</div>
      </div>
    </div>
  );
}
