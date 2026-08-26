import React, { useEffect, useRef } from "react";

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: Record<string, unknown>;
}

interface BuildLogsProps {
  logs: LogEntry[];
  isStreaming?: boolean;
}

export const BuildLogs: React.FC<BuildLogsProps> = ({ logs, isStreaming }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error": return "text-red-400";
      case "warn": return "text-yellow-400";
      case "info": return "text-blue-400";
      case "debug": return "text-gray-500";
      default: return "text-gray-400";
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 font-semibold">Build Logs</h3>
        {isStreaming && (
          <span className="flex items-center text-green-400 text-xs">
            <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
            Streaming...
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="text-gray-500">No logs yet...</div>
      ) : (
        logs.map((log, index) => (
          <div key={index} className="mb-1">
            <span className="text-gray-600 mr-2">{log.timestamp}</span>
            <span className={`${getLevelColor(log.level)} mr-2`}>[{log.level.toUpperCase()}]</span>
            <span className="text-gray-300">{log.message}</span>
            {log.data && (
              <span className="text-gray-500 ml-2">
                {JSON.stringify(log.data)}
              </span>
            )}
          </div>
        ))
      )}

      <div ref={logsEndRef} />
    </div>
  );
};

export default BuildLogs;
