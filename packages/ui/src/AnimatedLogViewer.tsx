import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Check, AlertTriangle, XCircle, ChevronRight } from "lucide-react";
import { cn } from "./cn";

export interface LogEntry {
  id?: string;
  timestamp?: string | Date;
  level: string;
  message: string;
}

interface AnimatedLogViewerProps {
  logs: LogEntry[];
  status: string;
  className?: string;
  title?: string;
}

export const AnimatedLogViewer: React.FC<AnimatedLogViewerProps> = ({
  logs,
  status,
  className,
  title = "Deployment Build Engine (Docker Container)",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll smooth animation to latest log entry
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [logs]);

  const getLevelStyle = (level: string) => {
    switch (level.toUpperCase()) {
      case "COMMAND":
        return {
          text: "text-zinc-100 font-semibold bg-zinc-800/60 px-2 py-0.5 rounded border border-zinc-700/60",
          icon: <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
        };
      case "ERROR":
        return {
          text: "text-rose-400 font-medium",
          icon: <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
        };
      case "WARN":
        return {
          text: "text-amber-400",
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
        };
      default:
        return {
          text: "text-zinc-300",
          icon: <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0 mt-2 mx-1.5" />,
        };
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-zinc-800/90 bg-[#0c0c0e]/90 backdrop-blur-2xl shadow-2xl overflow-hidden font-mono text-xs",
        className
      )}
    >
      {/* Sleek Terminal Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
        <div className="flex items-center space-x-2.5">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-zinc-700/60 border border-zinc-600/40" />
            <div className="w-3 h-3 rounded-full bg-zinc-700/60 border border-zinc-600/40" />
            <div className="w-3 h-3 rounded-full bg-zinc-700/60 border border-zinc-600/40" />
          </div>
          <span className="flex items-center text-zinc-400 font-medium tracking-wide">
            <Terminal className="w-3.5 h-3.5 mr-2 text-zinc-500" />
            {title}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {status === "BUILDING" && (
            <div className="flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>Streaming Live Output...</span>
            </div>
          )}
          {status === "READY" && (
            <div className="flex items-center space-x-1.5 text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Container Build Completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Log Output Window with Framer Motion entry animations */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[460px] min-h-[260px] scrollbar-thin scrollbar-thumb-zinc-800"
      >
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 space-y-2">
            <Terminal className="w-8 h-8 opacity-40 animate-pulse" />
            <p>Waiting for build container output stream...</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log, index) => {
              const { text, icon } = getLevelStyle(log.level);
              const timeStr = log.timestamp
                ? new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                : "";

              return (
                <motion.div
                  key={log.id || `${index}-${log.message}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start space-x-3 leading-relaxed hover:bg-white/[0.02] px-2 py-1 rounded transition-colors"
                >
                  {timeStr && <span className="text-zinc-600 select-none shrink-0 text-[11px]">{timeStr}</span>}
                  {icon}
                  <span className={cn("break-all", text)}>{log.message}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Terminal Footer status info */}
      <div className="border-t border-zinc-800/60 bg-zinc-950/60 px-4 py-2 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{logs.length} log lines captured</span>
        <span>Isolated Docker Engine v24.0.7</span>
      </div>
    </div>
  );
};
