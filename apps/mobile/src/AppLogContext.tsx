import { createContext, useCallback, useContext, useRef, useState } from "react";

const MAX_LOGS = 150;

type LogEntry = { id: number; level: "log" | "error" | "warn"; message: string; ts: number };

type AppLogContextType = {
  logs: LogEntry[];
  clearLogs: () => void;
  openLogViewer: () => void;
  closeLogViewer: () => void;
  logViewerVisible: boolean;
};

const AppLogContext = createContext<AppLogContextType | undefined>(undefined);

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a === null) return "null";
      if (a === undefined) return "undefined";
      if (typeof a === "object") try { return JSON.stringify(a); } catch { return String(a); }
      return String(a);
    })
    .join(" ");
}

export function AppLogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logViewerVisible, setLogViewerVisible] = useState(false);
  const idRef = useRef(0);
  const originalLogRef = useRef<typeof console.log | null>(null);
  const originalErrorRef = useRef<typeof console.error | null>(null);
  const originalWarnRef = useRef<typeof console.warn | null>(null);

  const pushLog = useCallback((level: "log" | "error" | "warn", args: unknown[]) => {
    const message = formatArgs(args);
    const entry: LogEntry = { id: ++idRef.current, level, message, ts: Date.now() };
    setLogs((prev) => {
      const next = [...prev, entry].slice(-MAX_LOGS);
      return next;
    });
  }, []);

  if (typeof console !== "undefined" && !originalLogRef.current) {
    originalLogRef.current = console.log;
    originalErrorRef.current = console.error;
    originalWarnRef.current = console.warn;
    console.log = (...args: unknown[]) => {
      originalLogRef.current?.(...args);
      pushLog("log", args);
    };
    console.error = (...args: unknown[]) => {
      originalErrorRef.current?.(...args);
      pushLog("error", args);
    };
    console.warn = (...args: unknown[]) => {
      originalWarnRef.current?.(...args);
      pushLog("warn", args);
    };
  }

  const clearLogs = useCallback(() => setLogs([]), []);
  const openLogViewer = useCallback(() => setLogViewerVisible(true), []);
  const closeLogViewer = useCallback(() => setLogViewerVisible(false), []);

  return (
    <AppLogContext.Provider
      value={{ logs, clearLogs, openLogViewer, closeLogViewer, logViewerVisible }}
    >
      {children}
    </AppLogContext.Provider>
  );
}

export function useAppLog() {
  const ctx = useContext(AppLogContext);
  if (!ctx) throw new Error("useAppLog must be used within AppLogProvider");
  return ctx;
}
