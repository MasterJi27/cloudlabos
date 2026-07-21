"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CheckCircle2, Download, Trash2, Box, Bell, Code, Sparkles, HardDrive, Link, Loader2, MessageSquare, BarChart3, ClipboardList, Bug, Mail, Brain, Database, GitBranch, AlertTriangle } from "lucide-react";
import { Tabs } from "@/components/Tabs";
import { api } from "@/lib/api";

const ICON_MAP: Record<string, React.ElementType> = { Bell, Code, Link, Box, HardDrive, Sparkles, MessageSquare, BarChart3, ClipboardList, Bug, Mail, Brain, Database, GitBranch, AlertTriangle, CheckCircle2 };

const CATEGORY_MAP: Record<string, string> = {
  communication: "Notifications", monitoring: "DevOps", alerting: "Notifications",
  "project-management": "Integrations", devops: "DevOps", storage: "Storage",
  data: "Integrations", ai: "AI/ML",
};

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set(["slack", "datadog", "github", "openai", "email"]));

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.listPlugins() as any[];
        setPlugins(data);
      } catch {
        setPlugins([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleInstall = (id: string) => {
    setInstalledPlugins(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPlugins = plugins.filter((plugin: any) => {
    const category = CATEGORY_MAP[plugin.category] || plugin.category || "Other";
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div data-ui-sweep className="page-shell animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Plugins Marketplace</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Discover and install integrations for your workspace.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input 
            type="text" 
            placeholder="Search plugins..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 w-full"
          />
        </div>
      </header>

      <div className="mb-8">
        <Tabs 
          activeTab={activeCategory}
          onChange={setActiveCategory}
          tabs={[
            { id: "All", label: "All Plugins" },
            { id: "Notifications", label: "Notifications" },
            { id: "DevOps", label: "DevOps" },
            { id: "AI/ML", label: "AI & ML" },
            { id: "Storage", label: "Storage" },
            { id: "Integrations", label: "Integrations" }
          ]}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-24 text-[var(--text-tertiary)]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredPlugins.map((plugin: any, idx) => {
            const isInstalled = installedPlugins.has(plugin.id);
            const Icon = ICON_MAP[plugin.icon] || Box;
            const category = CATEGORY_MAP[plugin.category] || plugin.category || "Other";

            return (
              <motion.div
                layout
                key={plugin.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="card p-6 flex flex-col hover:bg-[var(--surface-2)] transition-colors shadow-[var(--edge-subtle)] hover:shadow-[var(--edge-default)]"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] shadow-[var(--edge-subtle)] flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[var(--text-primary)]" />
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 bg-[var(--surface-1)] shadow-[var(--edge-subtle)] text-[var(--text-secondary)] rounded-full uppercase tracking-wider">
                    {category}
                  </span>
                </div>
                
                <h3 className="text-[16px] font-medium tracking-body text-[var(--text-primary)] mb-2">{plugin.name}</h3>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed flex-1">{plugin.description}</p>
                
                <div className="flex items-center gap-4 mt-6 text-[11px] font-mono text-[var(--text-tertiary)]">
                  <span>v{plugin.version}</span>
                  <span className="flex items-center gap-1.5 ml-auto">
                    <Download className="w-3.5 h-3.5" /> {isInstalled ? "Installed" : "Available"}
                  </span>
                </div>

                <div className="mt-6 pt-5 border-t border-[rgba(255,255,255,0.04)]">
                  <button
                    onClick={() => toggleInstall(plugin.id)}
                    className={`w-full h-9 flex items-center justify-center gap-2 rounded-md text-[13px] font-medium transition-colors ${
                      isInstalled
                        ? "bg-[rgba(255,255,255,0.05)] text-[var(--text-primary)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] group"
                        : "btn-primary"
                    }`}
                  >
                    {isInstalled ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 group-hover:hidden text-[var(--success)]" />
                        <span className="group-hover:hidden">Installed</span>
                        <Trash2 className="w-4 h-4 hidden group-hover:block" />
                        <span className="hidden group-hover:block">Uninstall</span>
                      </>
                    ) : (
                      "Install Plugin"
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredPlugins.length === 0 && (
          <div className="col-span-full py-24 text-center text-[var(--text-tertiary)] border border-[rgba(255,255,255,0.04)] border-dashed rounded-xl">
            <Box className="w-10 h-10 mx-auto mb-4 opacity-40" />
            <p className="text-[14px] font-medium tracking-body text-[var(--text-secondary)]">No plugins found matching your criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
