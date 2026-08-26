import { useState } from "react";
import { api, SpecMetadata } from "../api/client";

export default function SpecGenerator() {
  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("");
  const [constraints, setConstraints] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<SpecMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await api.generateSpec({
        prompt: prompt.trim(),
        projectName: projectName.trim() || undefined,
        constraints: constraints.trim()
          ? constraints.split(",").map((c) => c.trim())
          : undefined,
        dryRun,
      });
      if (res.success && res.data) {
        setResult(res.data as unknown as SpecMetadata);
      } else {
        setError(res.errors?.join(", ") || "Spec generation failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Spec Generator</h1>
      <p className="text-slate-500 mb-6">
        Generate a comprehensive spec.md from a high-level product description.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Product Description *
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A real-time trading dashboard with live charts, order management, and portfolio tracking..."
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Auto-derived from prompt"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Constraints (comma-separated)
            </label>
            <input
              type="text"
              value={constraints}
              onChange={(e) => setConstraints(e.target.value)}
              placeholder="e.g., Must use React, Support dark mode"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="dryRun"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="rounded border-slate-300"
          />
          <label htmlFor="dryRun" className="text-sm text-slate-600">
            Dry run (preview without writing to disk)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Generating..." : "Generate Spec"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">
            ✅ Spec Generated
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <InfoItem label="Project" value={result.projectName} />
            <InfoItem label="Version" value={result.version} />
            <InfoItem label="Sections" value={String(result.sectionCount)} />
            <InfoItem
              label="User Stories"
              value={String(result.userStoryCount)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
