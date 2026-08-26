import { useState, useEffect } from "react";
import { api, SpecsDirectory } from "../api/client";

export default function FeatureAdd() {
  const [specs, setSpecs] = useState<SpecsDirectory | null>(null);
  const [specPath, setSpecPath] = useState("");
  const [featurePrompt, setFeaturePrompt] = useState("");
  const [autoApprove, setAutoApprove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.listSpecs().then((res) => {
      if (res.success) setSpecs(res.data);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!specPath || !featurePrompt.trim()) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await api.addFeature({
        specPath,
        featurePrompt: featurePrompt.trim(),
        autoApprove,
      });
      if (res.success) {
        setSuccess(true);
        setFeaturePrompt("");
      } else {
        setError(res.errors?.join(", ") || "Feature addition failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Feature Add</h1>
      <p className="text-slate-500 mb-6">
        Add a new feature to an existing spec and optionally trigger a rebuild.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Target Spec *
          </label>
          <select
            value={specPath}
            onChange={(e) => setSpecPath(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
            required
          >
            <option value="">Select a spec...</option>
            {specs?.entries.map((entry) => (
              <option key={entry.path} value={entry.path}>
                {entry.projectName} (v{entry.version})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Feature Description *
          </label>
          <textarea
            value={featurePrompt}
            onChange={(e) => setFeaturePrompt(e.target.value)}
            placeholder="e.g., Add dark mode support with system preference detection..."
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none"
            required
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="autoApprove"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="rounded border-slate-300"
          />
          <label htmlFor="autoApprove" className="text-sm text-slate-600">
            Auto-approve (write spec and rebuild immediately)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !specPath || !featurePrompt.trim()}
          className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Adding Feature..." : "Add Feature"}
        </button>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          ✅ Feature addition completed successfully!
          {!autoApprove && (
            <span className="block mt-1 text-green-600">
              Review the updated spec, then run a one-shot build.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
