import { useState } from "react";
import { api, BugReport, BugScanResult } from "../api/client";

export default function BugScanner() {
  const [scanPath, setScanPath] = useState(".");
  const [specPath, setSpecPath] = useState("");
  const [scanTypes, setScanTypes] = useState<string[]>(["static", "tests"]);
  const [result, setResult] = useState<BugScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fixingBug, setFixingBug] = useState<string | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.scanBugs({ scanPath, specPath: specPath || undefined, scanTypes });
      if (res.success && res.data) setResult(res.data);
      else setError(res.errors?.join(", ") || "Scan failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleFix(bug: BugReport) {
    setFixingBug(bug.id);
    try {
      await api.fixBug({ bug, sourcePath: scanPath, specPath: specPath || undefined });
      handleScan(new Event("submit") as unknown as React.FormEvent);
    } catch { /* silent */ }
    finally { setFixingBug(null); }
  }

  function toggleScanType(type: string) {
    setScanTypes((prev) => prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Bug Scanner</h1>
      <p className="text-slate-500 mb-6">Scan codebases for bugs via static analysis, tests, and log parsing.</p>
      <ScanForm {...{ scanPath, setScanPath, specPath, setSpecPath, scanTypes, toggleScanType, loading, handleScan }} />
      {error && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {error}</div>}
      {result && <BugResults result={result} fixingBug={fixingBug} handleFix={handleFix} />}
    </div>
  );
}

function ScanForm({ scanPath, setScanPath, specPath, setSpecPath, scanTypes, toggleScanType, loading, handleScan }: {
  scanPath: string; setScanPath: (v: string) => void; specPath: string; setSpecPath: (v: string) => void;
  scanTypes: string[]; toggleScanType: (t: string) => void; loading: boolean; handleScan: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={handleScan} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Scan Path</label>
          <input type="text" value={scanPath} onChange={(e) => setScanPath(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Spec Path (optional)</label>
          <input type="text" value={specPath} onChange={(e) => setSpecPath(e.target.value)} placeholder="Path to spec.md"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Scan Types</label>
        <div className="flex gap-3">
          {["static", "tests", "logs"].map((type) => (
            <button key={type} type="button" onClick={() => toggleScanType(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${scanTypes.includes(type) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-300 hover:border-brand-400"}`}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" disabled={loading}
        className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? "Scanning..." : "Scan for Bugs"}
      </button>
    </form>
  );
}

function BugResults({ result, fixingBug, handleFix }: { result: BugScanResult; fixingBug: string | null; handleFix: (b: BugReport) => void }) {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-5 gap-3 mb-6">
        <SummaryCard label="Total" value={result.summary.total} color="slate" />
        <SummaryCard label="Critical" value={result.summary.critical} color="red" />
        <SummaryCard label="High" value={result.summary.high} color="orange" />
        <SummaryCard label="Medium" value={result.summary.medium} color="yellow" />
        <SummaryCard label="Low" value={result.summary.low} color="blue" />
      </div>
      {result.bugs.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Severity</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">File</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Message</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {result.bugs.map((bug) => (
                <tr key={bug.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3"><SeverityBadge severity={bug.severity} /></td>
                  <td className="px-4 py-3 text-slate-600">{bug.category}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{bug.file}{bug.line ? `:${bug.line}` : ""}</td>
                  <td className="px-4 py-3 text-slate-700">{bug.message}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleFix(bug)} disabled={fixingBug === bug.id}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium disabled:opacity-50">
                      {fixingBug === bug.id ? "Fixing..." : "Auto-fix"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-6 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">✅ No bugs found!</div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const bg: Record<string, string> = { slate: "bg-slate-50 border-slate-200", red: "bg-red-50 border-red-200", orange: "bg-orange-50 border-orange-200", yellow: "bg-yellow-50 border-yellow-200", blue: "bg-blue-50 border-blue-200" };
  return (
    <div className={`rounded-lg border p-3 text-center ${bg[color]}`}>
      <p className="text-xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = { critical: "bg-red-100 text-red-700", high: "bg-orange-100 text-orange-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-blue-100 text-blue-700" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[severity] || styles.low}`}>{severity}</span>;
}

