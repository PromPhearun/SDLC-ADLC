import { useState } from "react";
import { api, DigestSummary } from "../api/client";

export default function Notifications() {
  const [digest, setDigest] = useState<DigestSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadDigest(demo = false) {
    setLoading(true);
    setError("");
    try {
      const res = await api.getDigest(demo);
      if (res.success) {
        setDigest(res.data);
      } else {
        setError("Failed to load digest");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const severityColors: Record<string, string> = {
    info: "bg-blue-50 border-blue-200",
    success: "bg-green-50 border-green-200",
    warning: "bg-yellow-50 border-yellow-200",
    error: "bg-red-50 border-red-200",
  };

  const severityIcons: Record<string, string> = {
    info: "📋",
    success: "✅",
    warning: "⚠️",
    error: "🚨",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Notifications</h1>
      <p className="text-slate-500 mb-6">
        View compressed notification digests from agent activity.
      </p>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => loadDigest(true)}
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading..." : "📋 Load Demo Digest"}
        </button>
        <button
          onClick={() => loadDigest(false)}
          disabled={loading}
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Load Live Digest
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">
          ❌ {error}
        </div>
      )}

      {digest && (
        <div
          className={`rounded-xl border p-6 ${
            severityColors[digest.severity] || severityColors.info
          }`}
        >
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">
              {severityIcons[digest.severity] || "📋"}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {digest.title}
              </h2>
              <p className="text-xs text-slate-500">
                {digest.entryCount} events · Severity: {digest.severity}
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {digest.bullets.map((bullet, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 bg-white/60 rounded-lg"
              >
                <span className="text-slate-400 mt-0.5">•</span>
                <span className="text-sm text-slate-700">{bullet}</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-slate-500 border-t border-slate-200/50 pt-3">
            📅 {new Date(digest.timeRange.from).toLocaleString()} →{" "}
            {new Date(digest.timeRange.to).toLocaleString()}
          </div>
        </div>
      )}

      {!digest && !loading && !error && (
        <div className="text-center py-12 text-slate-400">
          <p className="text-4xl mb-3">🔔</p>
          <p>No digest loaded. Click a button above to view notifications.</p>
        </div>
      )}
    </div>
  );
}
