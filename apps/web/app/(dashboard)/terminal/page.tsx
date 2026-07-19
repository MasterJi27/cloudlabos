"use client";

import { useState, useEffect, useRef } from "react";
import { Maximize2, Minimize2, Terminal as TerminalIcon } from "lucide-react";
import { useStore } from "@/store";

interface TerminalLine {
  id: number;
  type: "input" | "output" | "error";
  text: string;
}

export default function TerminalPage() {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: "output", text: "CloudLabOS Terminal v1.0.0" },
    { id: 1, type: "output", text: "Type 'help' for available commands." },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { workflows, activeRuns, runHistory, agents, fetchExecuteWorkflow, fetchRuns } = useStore();

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;
    const id = lines.length;
    setLines((prev) => [...prev, { id, type: "input", text: `$ ${cmd}` }]);
    setHistory((prev) => [...prev, cmd]);
    setHistoryIndex(-1);
    setCommand("");

    const parts = cmd.trim().split(/\s+/);
    const primaryCmd = parts[0];

    if (primaryCmd === "help") {
      setLines((prev) => [...prev, { 
        id: id + 1, 
        type: "output", 
        text: "Available commands:\n" +
              "  help               - Show this help list\n" +
              "  clear              - Clear terminal display logs\n" +
              "  status             - Show live service statuses\n" +
              "  whoami             - Show current logged-in identity\n" +
              "  date               - Show current system timestamp\n" +
              "  list-workflows     - List registered workflows\n" +
              "  run-workflow <id>  - Execute a specific workflow run\n" +
              "  list-runs          - List execution run logs\n" +
              "  list-agents        - Show connected agent nodes\n" +
              "  echo <text>        - Print input text back to stdout" 
      }]);
    } else if (primaryCmd === "clear") {
      setLines([]);
    } else if (primaryCmd === "status") {
      setLines((prev) => [...prev, { id: id + 1, type: "output", text: "System Status: Operational\n  API Gateway:     healthy\n  Agent Service:   healthy\n  Workflow Engine: healthy\n  Memory Service:  healthy\n  Browser Service: healthy" }]);
    } else if (primaryCmd === "whoami") {
      setLines((prev) => [...prev, { id: id + 1, type: "output", text: "admin@cloudlabos.ai (admin)" }]);
    } else if (primaryCmd === "date") {
      setLines((prev) => [...prev, { id: id + 1, type: "output", text: new Date().toISOString() }]);
    } else if (primaryCmd === "list-workflows") {
      if (workflows.length === 0) {
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: "No workflows found in this workspace." }]);
      } else {
        const header = "  ID           | NAME                                     | STATUS\n" +
                       "  -------------+------------------------------------------+---------";
        const wfs = workflows.map(w => `  ${w.id.padEnd(12)} | ${w.name.padEnd(40)} | ${w.status}`).join("\n");
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: `${header}\n${wfs}` }]);
      }
    } else if (primaryCmd === "list-runs") {
      const allRuns = [...activeRuns, ...runHistory];
      if (allRuns.length === 0) {
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: "No runs found in this workspace." }]);
      } else {
        const header = "  RUN ID               | WORKFLOW NAME                            | STATUS\n" +
                       "  ---------------------+------------------------------------------+---------";
        const rns = allRuns.map(r => `  ${r.id.padEnd(20)} | ${r.workflow_name.padEnd(40)} | ${r.status}`).join("\n");
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: `${header}\n${rns}` }]);
      }
    } else if (primaryCmd === "list-agents") {
      if (agents.length === 0) {
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: "No agents currently registered." }]);
      } else {
        const header = "  NAME                      | STATUS     | TASKS      | UPTIME\n" +
                       "  --------------------------+------------+------------+---------";
        const ags = agents.map(a => `  ${a.name.padEnd(25)} | ${a.status.padEnd(10)} | ${(String(a.tasks_total) + " tasks").padEnd(10)} | ${a.uptime}`).join("\n");
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: `${header}\n${ags}` }]);
      }
    } else if (primaryCmd === "run-workflow") {
      const wfId = parts.slice(1).join(" ").trim();
      if (!wfId) {
        setLines((prev) => [...prev, { id: id + 1, type: "error", text: "Usage: run-workflow <workflow_id>" }]);
        return;
      }
      const wf = workflows.find(w => w.id === wfId);
      if (!wf) {
        setLines((prev) => [...prev, { id: id + 1, type: "error", text: `Workflow not found: ${wfId}. Type 'list-workflows' to see valid IDs.` }]);
      } else {
        setLines((prev) => [...prev, { id: id + 1, type: "output", text: `Spawning manual execution run for workflow "${wf.name}"...` }]);
        try {
          const runId = await fetchExecuteWorkflow(wfId);
          await fetchRuns(); // Refresh runs list in store
          setLines((prev) => [...prev, { id: prev.length, type: "output", text: `[success] Run initiated: ${runId}` }]);
        } catch {
          setLines((prev) => [...prev, { id: prev.length, type: "error", text: `[error] Execution rejected by pipeline engine` }]);
        }
      }
    } else if (primaryCmd === "echo") {
      setLines((prev) => [...prev, { id: id + 1, type: "output", text: parts.slice(1).join(" ") }]);
    } else {
      setLines((prev) => [...prev, { id: id + 1, type: "error", text: `command not found: ${primaryCmd}` }]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { executeCommand(command); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(history[history.length - 1 - newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand("");
      }
    }
  };

  return (
    <div data-ui-sweep className={`page-shell animate-fade-in ${isFullscreen ? "fixed inset-0 z-50 bg-[var(--void)] p-8 max-w-none" : ""}`}>
      {!isFullscreen && (
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <h1 className="page-heading text-[var(--text-primary)] mb-2">Terminal</h1>
            <p className="text-[14px] text-[var(--text-secondary)]">Interactive shell for system commands.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLines([])} className="btn-secondary">Clear</button>
            <button onClick={() => setIsFullscreen(true)} className="btn-ghost text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-2">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {isFullscreen && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-[var(--text-secondary)]">
            <TerminalIcon className="w-5 h-5" />
            <span className="text-[14px] font-mono">root@cloudlabos-ai-core:~</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setLines([])} className="btn-secondary">Clear</button>
            <button onClick={() => setIsFullscreen(false)} className="btn-ghost text-[var(--text-tertiary)] hover:text-[var(--text-primary)] px-2">
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className={`terminal-pane ${isFullscreen ? "h-[calc(100vh-100px)]" : "h-[calc(100vh-320px)]"} overflow-hidden flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3 shadow-[0_1px_0_0_rgba(255,255,255,0.06)]">
          <span className="text-[11px] font-mono text-[var(--text-secondary)]">root@cloudlabos-ai-core:~</span>
          <span className="text-[10px] font-mono text-[var(--text-tertiary)]">interactive shell</span>
        </div>
        <div
          ref={terminalRef}
          onClick={() => inputRef.current?.focus()}
          className="flex-1 p-5 overflow-y-auto font-mono text-[13px] leading-relaxed cursor-text"
        >
          {lines.map((line) => (
            <div key={line.id} className={`py-0.5 whitespace-pre-wrap ${
              line.type === "input" ? "text-[var(--text-primary)]" : line.type === "error" ? "text-[var(--danger)]" : "text-[var(--text-secondary)]"
            }`}>{line.text}</div>
          ))}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[var(--accent)] font-semibold">$</span>
            <input
              ref={inputRef}
              type="text" value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none text-[var(--text-primary)] font-mono text-[13px] caret-[var(--accent)]"
              autoFocus
            />
          </div>
        </div>
      </div>
    </div>
  );
}
