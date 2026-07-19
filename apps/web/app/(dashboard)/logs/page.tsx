"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Terminal, Search, Download, Trash2, PauseCircle, PlayCircle, 
  Info, AlertTriangle, Bug, AlertCircle
} from "lucide-react";

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
}

const LOG_LEVELS: LogLevel[] = ["INFO", "WARN", "ERROR", "DEBUG"];
const AGENT_NAMES = ["AuthSystem", "WorkflowEngine", "SecurityAudit", "APIGateway", "DatabaseSync", "JobScheduler"];
const MESSAGES: Record<LogLevel, string[]> = {
  INFO: [
    "User authentication successful",
    "Workflow execution started",
    "Sync completed successfully",
    "API request processed in 45ms",
    "Cache warmed up",
    "New job scheduled",
  ],
  WARN: [
    "Rate limit threshold approaching",
    "Memory usage above 80%",
    "Retry attempt 2 for external API",
    "Deprecated API endpoint called",
  ],
  ERROR: [
    "Database connection timeout",
    "Failed to authenticate token",
    "Unhandled exception in job worker",
    "Constraint violation error",
  ],
  DEBUG: [
    "Payload size: 2.4kb",
    "Cache miss for key user_123",
    "Evaluating condition ruleset_A",
    "WebSocket connection established",
  ]
};

const levelConfig: Record<LogLevel, { color: string; badgeBg: string; icon: React.ElementType }> = {
  ERROR: { color: "text-[var(--danger)]", badgeBg: "bg-[var(--danger)]/15 text-[var(--danger)]", icon: Bug },
  WARN: { color: "text-[var(--warning)]", badgeBg: "bg-[var(--warning)]/15 text-[var(--warning)]", icon: AlertTriangle },
  INFO: { color: "text-[var(--text-primary)]", badgeBg: "bg-[var(--surface-3)] text-[var(--text-primary)]", icon: Info },
  DEBUG: { color: "text-[var(--text-tertiary)]", badgeBg: "bg-[rgba(255,255,255,0.05)] text-[var(--text-tertiary)]", icon: AlertCircle },
};

export default function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogLevel | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
      const source = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
      const msgList = MESSAGES[level];
      const message = msgList[Math.floor(Math.random() * msgList.length)];
      
      const newLog: LogEntry = {
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
      };
      
      setLogs((prev) => [...prev.slice(-999), newLog]);
    }, Math.random() * 2000 + 1000);
    
    return () => clearInterval(interval);
  }, [isPaused]);
  
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10;
    setAutoScroll(isAtBottom);
  };

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleExportLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] [${l.level}] [${l.source}] ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((log) => {
    if (filter !== "ALL" && log.level !== filter) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase()) && !log.source.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div data-ui-sweep className="page-shell animate-fade-in flex flex-col h-[calc(100vh-2rem)]">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 flex-shrink-0">
        <div>
          <h1 className="page-heading text-[var(--text-primary)] mb-2 flex items-center gap-3">
            <Terminal className="w-6 h-6 text-[var(--text-secondary)]" />
            Live Logs
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)]">Real-time system event stream.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsPaused(!isPaused)} 
            className={`btn-secondary h-8 px-4 ${isPaused ? "bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20" : ""}`}
          >
            {isPaused ? <PlayCircle className="w-3.5 h-3.5 mr-1.5" /> : <PauseCircle className="w-3.5 h-3.5 mr-1.5" />}
            {isPaused ? "Resume" : "Pause"}
          </button>
          
          <button 
            onClick={handleClearLogs}
            className="btn-secondary h-8 px-3"
            title="Clear Logs"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleExportLogs}
            className="btn-secondary h-8 px-3"
            title="Export Logs"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[var(--surface-1)] p-4 rounded-t-lg shadow-[var(--edge-subtle)] flex-shrink-0">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text" 
            placeholder="Search logs by message or source..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 font-mono text-[12px] h-8"
          />
        </div>
        
        <div className="flex items-center gap-1.5">
          {["ALL", ...LOG_LEVELS].map((lvl) => (
            <button
              key={lvl} 
              onClick={() => setFilter(lvl as LogLevel | "ALL")}
              className={`px-3 py-1 rounded-md text-[11px] font-mono tracking-wider transition-colors whitespace-nowrap ${
                filter === lvl 
                  ? "bg-[var(--text-primary)] text-[var(--void)]" 
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div 
        className="flex-1 bg-[var(--void)] rounded-b-lg overflow-y-auto font-mono text-[12px] relative shadow-[var(--edge-subtle),inset_0_2px_10px_rgba(0,0,0,0.5)]"
        onScroll={handleScroll}
        ref={scrollRef}
      >
        <div className="min-w-max p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-24 text-[var(--text-tertiary)] font-sans">
              <Terminal className="w-8 h-8 mx-auto mb-4 opacity-40" />
              <p className="text-[13px] tracking-body">No logs matching criteria</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredLogs.map((log) => {
                const config = levelConfig[log.level];
                
                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`log-row flex items-start gap-4 px-3 py-1.5 hover:bg-[var(--surface-2)] transition-colors ${log.level === 'ERROR' ? 'bg-[var(--danger)]/5 hover:bg-[var(--danger)]/10' : ''} ${log.level === 'WARN' ? 'bg-[var(--warning)]/5 hover:bg-[var(--warning)]/10' : ''}`}
                  >
                    <span className="text-[var(--text-tertiary)] flex-shrink-0 w-[160px] tabular-nums opacity-70 text-[11px]">
                      {log.timestamp.replace('T', ' ').replace('Z', '')}
                    </span>
                    
                    <span className={`flex-shrink-0 w-14 px-1 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase flex items-center justify-center ${config.badgeBg}`}>
                      {log.level}
                    </span>
                    
                    <span className="text-[var(--text-secondary)] opacity-80 flex-shrink-0 w-[140px] truncate text-[11px]">
                      [{log.source}]
                    </span>
                    
                    <span className={`flex-1 break-words leading-relaxed ${config.color}`}>
                      {log.message}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
        
        {!autoScroll && (
          <button
            onClick={() => {
              setAutoScroll(true);
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-[var(--text-primary)] text-[var(--void)] text-[12px] font-medium tracking-body rounded-full shadow-[var(--elev-3)] hover:opacity-90 flex items-center gap-2 z-10 transition-opacity"
          >
            Resume Auto-scroll
          </button>
        )}
      </div>
    </div>
  );
}
