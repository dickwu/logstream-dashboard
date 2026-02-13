"use client";

import { useEffect, useState, useRef, useCallback } from "react";

interface LogEntry {
  id: string;
  timestamp: string;
  project: string;
  level: string;
  message: string;
  traceId?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

export default function Dashboard() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [projects, setProjects] = useState<Set<string>>(new Set());
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [paused, setPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?mode=subscribe`);
    
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 2000);
    };
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      if (paused) return;
      const msg = JSON.parse(event.data);
      if (msg.type === "log") {
        setLogs((prev) => {
          const updated = [msg.data, ...prev].slice(0, 1000);
          return updated;
        });
        setProjects((prev) => new Set([...prev, msg.data.project]));
      }
    };
    
    wsRef.current = ws;
  }, [paused]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const filteredLogs = logs.filter((log) => {
    if (selectedProject && log.project !== selectedProject) return false;
    if (selectedLevel && log.level !== selectedLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const errorCount = logs.filter((l) => l.level === "error" || l.level === "fatal").length;

  const clearLogs = () => setLogs([]);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(filteredLogs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const levelColors: Record<string, string> = {
    debug: "text-gray-500",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
    fatal: "bg-red-600 text-white px-1 rounded",
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-200 flex flex-col">
      {/* Header */}
      <header className="bg-[#16213e] px-6 py-3 flex items-center justify-between border-b border-[#0f3460]">
        <h1 className="text-lg font-semibold">📡 Logstream</h1>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
          <span>{connected ? "Connected" : "Disconnected"}</span>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-[#16213e] px-6 py-2 flex flex-wrap gap-3 items-center border-b border-[#0f3460]">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="bg-[#1a1a2e] border border-[#0f3460] rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Projects</option>
          {[...projects].sort().map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={selectedLevel}
          onChange={(e) => setSelectedLevel(e.target.value)}
          className="bg-[#1a1a2e] border border-[#0f3460] rounded px-3 py-1.5 text-sm"
        >
          <option value="">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>

        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-[#1a1a2e] border border-[#0f3460] rounded px-3 py-1.5 text-sm w-48"
        />

        <button
          onClick={clearLogs}
          className="bg-[#0f3460] hover:bg-[#1a4a7a] px-4 py-1.5 rounded text-sm"
        >
          Clear
        </button>

        <button
          onClick={() => setPaused(!paused)}
          className={`px-4 py-1.5 rounded text-sm ${paused ? "bg-green-500 text-black" : "bg-[#0f3460]"}`}
        >
          {paused ? "Resume" : "Pause"}
        </button>

        <button
          onClick={exportLogs}
          className="bg-[#0f3460] hover:bg-[#1a4a7a] px-4 py-1.5 rounded text-sm"
        >
          Export
        </button>
      </div>

      {/* Stats */}
      <div className="bg-[#0f0f23] px-6 py-2 text-xs text-gray-500 flex gap-6">
        <span>Total: <span className="text-green-400">{logs.length}</span></span>
        <span>Showing: <span className="text-green-400">{filteredLogs.length}</span></span>
        <span>Errors: <span className="text-red-400">{errorCount}</span></span>
      </div>

      {/* Log Container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-2">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            {logs.length === 0 ? "Waiting for logs..." : "No logs match filters"}
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex gap-3 px-3 py-1 hover:bg-[#16213e] text-sm font-mono"
            >
              <span className="text-gray-500 min-w-[85px]">
                {log.timestamp?.split("T")[1]?.slice(0, 12) || ""}
              </span>
              <span className={`min-w-[50px] font-semibold ${levelColors[log.level] || ""}`}>
                {log.level}
              </span>
              <span className="text-purple-400 min-w-[120px]">{log.project}</span>
              <span className="text-emerald-400">
                {log.traceId ? `[${log.traceId.slice(0, 8)}]` : ""}
              </span>
              <span className="flex-1 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
