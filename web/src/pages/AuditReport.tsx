import { useState, useEffect } from "react";
import { api, AuditReport } from "../api/client";

export default function AuditReportPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    runAudit();
  }, []);

  async function runAudit() {
    setLoading(true);
    setError("");
    try {
      const res = await api.runAudit();
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.errors?.join(", ") || "Audit failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Report</h1>
          <p className="text-slate-500 text-sm">
            Spec coverage analysis across all projects.
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading}
          className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Scanning..." : "🔄 Refresh"}
        </button>
      </div>

      {loading && !report && (
        <div className="text-center py-12 text-slate-500">
          Running audit...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-6">
          ❌ {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-500">Total Projects</p>
              <p className="text-2xl font-bold text-slate-800">
                {report.summary.totalProjects}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-5">
              <p className="text-xs text-green-600">Valid Specs</p>
              <p className="text-2xl font-bold text-green-700">
                {report.summary.validSpecs}
              </p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <p className="text-xs text-red-600">Invalid Specs</p>
              <p className="text-2xl font-bold text-red-700">
                {report.summary.invalidSpecs}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
              <p className="text-xs text-purple-600">Avg Coverage</p>
              <p className="text-2xl font-bold text-purple-700">
                {report.summary.averageCoverage}%
              </p>
            </div>
          </div>

          {/* Flagged Issues */}
          {report.flagged.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">
                🚩 Flagged Issues ({report.flagged.length})
              </h2>
              <div className="space-y-3">
                {report.flagged.map((flag, i) => (
                  <div
                    key={i}
                    className={`p-4 rounded-lg border ${
                      flag.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : flag.severity === "warning"
                          ? "bg-yellow-50 border-yellow-200"
                          : "bg-blue-50 border-blue-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm">
                        {flag.severity === "critical"
                          ? "🔴"
                          : flag.severity === "warning"
                            ? "🟡"
                            : "🔵"}
                      </span>
                      <span className="text-sm font-medium text-slate-800">
                        [{flag.issue}] {flag.projectName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 ml-6">
                      {flag.details}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-amber-800 mb-3">
                💡 Recommendations
              </h2>
              <ul className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-amber-700">
                    • {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.flagged.length === 0 && (
            <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm text-center">
              ✅ No issues found! All specs are valid and well-covered.
            </div>
          )}
        </>
      )}
    </div>
  );
}
