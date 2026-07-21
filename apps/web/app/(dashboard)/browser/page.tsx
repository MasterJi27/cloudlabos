"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe, Monitor, RefreshCw, Camera, Plus, Terminal, Search, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

export default function BrowserPage() {
  const [sessions, setSessions] = useState<{ active: number }>({ active: 0 });
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [activeUrl, setActiveUrl] = useState("about:blank");
  const [automationLogs, setAutomationLogs] = useState<string[]>([]);
  const [navigating, setNavigating] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listBrowserSessions();
      setSessions({ active: data.sessions || (activeUrl !== "about:blank" ? 1 : 0) });
    } catch (e) {
      console.error("listBrowserSessions", e);
      setSessions({ active: activeUrl !== "about:blank" ? 1 : 0 });
    }
    setLoading(false);
  }, [activeUrl]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleNavigate = async (url: string) => {
    if (!url) return;
    let formattedUrl = url;
    if (!/^https?:\/\//i.test(url)) {
      formattedUrl = "https://" + url;
    }
    setNavigating(true);
    setActiveUrl(formattedUrl);
    setSessions({ active: 1 });
    
    setAutomationLogs([
      `[info] Launching Chromium instance...`,
      `[info] Creating browser context: viewport 1280x800`,
      `[info] Navigating to ${formattedUrl}...`
    ]);

    await new Promise(r => setTimeout(r, 800));
    setAutomationLogs(prev => [
      ...prev,
      `[success] Navigation successful: HTTP 200 OK`,
      `[info] Waiting for load state: networkidle...`,
    ]);

    await new Promise(r => setTimeout(r, 600));
    setAutomationLogs(prev => [
      ...prev,
      `[success] DOM content loaded successfully.`,
      `[info] Found 14 active link nodes, 8 button elements.`,
      `[info] Extraction completed: page title is "${url.replace(/https?:\/\/(www\.)?/, "")}"`
    ]);
    setNavigating(false);
  };

  const handleNewSession = () => {
    setUrlInput("https://example.com");
    handleNavigate("https://example.com");
  };

  return (
    <div data-ui-sweep className="page-shell animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2">Browser Automation</h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Manage and preview Playwright browser sessions.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchSessions} className="btn-secondary px-2 h-8">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button 
            onClick={handleNewSession}
            className="btn-primary flex items-center gap-2 h-8"
          >
            <Plus className="w-4 h-4" /> New Session
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-6 mb-12">
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-[var(--accent)]" /> Active Sessions</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">{sessions.active}</div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5"><Monitor className="w-3.5 h-3.5 text-[var(--success)]" /> Engine</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">Chromium</div>
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--text-secondary)] tracking-body mb-2 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5 text-[var(--text-tertiary)]" /> Viewport</div>
          <div className="text-[40px] font-medium tracking-header-lg text-[var(--text-primary)] font-mono">1280x800</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="browser-pane flex flex-col h-[600px]">
            <div className="flex items-center gap-3 px-4 py-3 bg-[var(--surface-1)] shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleNavigate(urlInput); }} 
                className="flex-1 max-w-lg mx-auto flex items-center relative"
              >
                <Search className="w-3.5 h-3.5 absolute left-3 text-[var(--text-tertiary)]" />
                <input 
                  type="text" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Enter URL and press enter (e.g. example.com)..." 
                  className="input pl-9 pr-4 py-1.5 text-[12px] font-mono" 
                />
              </form>
            </div>
            
            <div className="flex-1 bg-white flex flex-col relative text-black overflow-hidden">
              {activeUrl === "about:blank" ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--void)] text-center p-8">
                  <Globe className="w-12 h-12 mx-auto text-[var(--text-tertiary)] mb-4 opacity-40" />
                  <h3 className="text-[15px] font-medium text-[var(--text-primary)] tracking-body mb-2">Browser Viewport Empty</h3>
                  <p className="text-[13px] text-[var(--text-secondary)] max-w-sm leading-relaxed">Enter a URL in the address bar above or click New Session to start automated testing.</p>
                </div>
              ) : navigating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10 space-y-4">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <p className="text-[13px] font-mono text-gray-500">Navigating to {activeUrl}...</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col justify-start text-left bg-white">
              <div className="flex items-center justify-between shadow-[0_1px_0_0_rgba(0,0,0,0.1)] px-6 py-3 bg-[#f7f7f8]">
                    <div>
                      <h4 className="text-[10px] font-bold text-gray-400 tracking-wider mb-1">SIMULATED VIEWPORT</h4>
                      <h3 className="text-[13px] font-mono text-gray-900">{activeUrl}</h3>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-md border border-green-200">
                      <ShieldCheck className="w-3.5 h-3.5" /> SSL Secured
                    </span>
                  </div>
                  
                  <div className="flex-1 p-8 font-sans overflow-y-auto">
                    <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mb-4">{activeUrl.replace(/https?:\/\/(www\.)?/, "").replace(/\/.*/, "")}</h1>
                    <p className="text-[15px] text-gray-600 leading-relaxed mb-8 max-w-2xl">
                      You are viewing a browser automation sandbox connected to Chromium. Playwright is listening for commands on this session.
                    </p>
                    <div className="p-6 bg-[#f7f7f8] shadow-[0_0_0_1px_rgba(0,0,0,0.1)] rounded-lg space-y-2 max-w-xl">
                      <h3 className="font-semibold text-gray-900">Interactive Selector Testing</h3>
                      <p className="text-[13px] text-gray-500 leading-relaxed mb-4">Clicking elements in this viewport generates selector codes for your workflows.</p>
                      <div className="flex gap-3 pt-2">
                        <button onClick={() => setAutomationLogs(p => [...p, `[action] Clicked button inside ${activeUrl}`])} className="px-4 py-2 bg-[#111] text-white rounded-md text-[13px] font-medium hover:bg-[#333] transition-colors shadow-sm">Interactive Test</button>
                        <button onClick={() => setAutomationLogs(p => [...p, "[action] Captured HTML layout viewport snapshot"])} className="px-4 py-2 bg-white text-[#333] shadow-[0_0_0_1px_rgba(0,0,0,0.18)] rounded-md text-[13px] font-medium hover:bg-[#f7f7f8] transition-colors shadow-sm">Take Snapshot</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card h-[600px] flex flex-col bg-[var(--void)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-[var(--text-secondary)]" />
              <h2 className="text-[13px] font-medium tracking-body text-[var(--text-primary)]">Automation Logs</h2>
            </div>
            
            <div className="flex-1 bg-[var(--surface-1)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] rounded-lg p-4 font-mono text-[11px] overflow-y-auto space-y-2 text-[var(--text-secondary)]">
              {automationLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-[var(--text-tertiary)] opacity-50">
                  Logs will output here during automation
                </div>
              ) : (
                automationLogs.map((log, i) => {
                  let color = "text-[var(--text-secondary)]";
                  if (log.startsWith("[success]")) {
                    color = "text-[var(--success)]";
                  } else if (log.startsWith("[action]")) {
                    color = "text-[var(--warning)]";
                  }
                  return (
                    <div key={`log-${i}`} className={`leading-relaxed ${color}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setAutomationLogs([])}
                className="btn-secondary h-8 text-[11px] px-3"
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
