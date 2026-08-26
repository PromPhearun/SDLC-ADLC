import { useState, useEffect } from "react";
import { api, streamRequest, SpecsDirectory, BuildResult, PipelineStage } from "../api/client";

interface ProgressEvent {
  step: number;
  totalSteps: number;
  stage: string;
  label: string;
  percent: number;
}

export default function OneShotBuilder() {
  const [specs, setSpecs] = useState<SpecsDirectory | null>(null);
  const [specPath, setSpecPath] = useState("");
  const [outputDir, setOutputDir] = useState("./build-output");
  const [mode, setMode] = useState("fresh");
  const [result, setResult] = useState<BuildResult | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);

  useEffect(() => {
    api.listSpecs().then((res) => { if (res.success) setSpecs(res.data); }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!specPath) return;
    setLoading(true);
    setError("");
    setResult(null);
    setStages([]);
    setProgress(null);

    try {
      const stream = await streamRequest("/build/oneshot", { specPath, outputDir, mode });

      for await (const { event, data } of stream) {
        if (event === "progress") {
          setProgress(data as ProgressEvent);
        } else if (event === "stage-complete") {
          const sc = data as { stage: string; success: boolean; duration: number; error?: string };
          setStages((prev) => {
            const existing = prev.findIndex((s) => s.stage === sc.stage);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = sc;
              return next;
            }
            return [...prev, sc];
          });
        } else if (event === "result") {
          const res = data as {
            success: boolean;
            data: BuildResult | null;
            pipeline: { stages: PipelineStage[]; totalDuration: number; errors: string[] };
          };
          if (res.success && res.data) {
            setResult(res.data);
          } else {
            setError(res.pipeline.errors.join(", ") || "Build failed");
          }
          setStages(res.pipeline.stages);
        } else if (event === "error") {
          setError((data as { error: string }).error);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">One-Shot Builder</h1>
      <p className="text-slate-500 mb-6">Generate a full application from a spec file in one shot.</p>
      <BuildForm {...{ specPath, setSpecPath, outputDir, setOutputDir, mode, setMode, loading, specs, handleSubmit }} />

      {/* Real-time progress */}
      {loading && progress && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-800">Building Application</h2>
            <span className="text-sm font-medium text-brand-600">{progress.percent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
            <div className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress.percent}%` }} />
          </div>
          <p className="text-sm text-slate-600">
            <span className="inline-block w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mr-2 align-middle" />
            {progress.label}
          </p>
        </div>
      )}

      {/* Pipeline stages — shown as they complete */}
      {stages.length > 0 && <PipelineStages stages={stages} />}

      {error && <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {error}</div>}
      {result && <BuildResultPanel result={result} />}
    </div>
  );
}

function BuildForm({ specPath, setSpecPath, outputDir, setOutputDir, mode, setMode, loading, specs, handleSubmit }: {
  specPath: string; setSpecPath: (v: string) => void; outputDir: string; setOutputDir: (v: string) => void;
  mode: string; setMode: (v: string) => void; loading: boolean; specs: SpecsDirectory | null;
  handleSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Spec File *</label>
        <select value={specPath} onChange={(e) => setSpecPath(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required>
          <option value="">Select a spec...</option>
          {specs?.entries.map((entry) => (
            <option key={entry.path} value={entry.path}>{entry.projectName} (v{entry.version})</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Output Directory</label>
          <input type="text" value={outputDir} onChange={(e) => setOutputDir(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Build Mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
            <option value="fresh">Fresh Build</option>
            <option value="refactor">Refactor Existing</option>
          </select>
        </div>
      </div>
      <button type="submit" disabled={loading || !specPath}
        className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
        {loading ? "Building..." : "Run One-Shot Build"}
      </button>
    </form>
  );
}

function PipelineStages({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Pipeline Stages</h2>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={i} className={`flex items-center justify-between p-3 rounded-lg ${stage.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <div className="flex items-center gap-3">
              <span>{stage.success ? "✅" : "❌"}</span>
              <span className="text-sm font-medium text-slate-800">{stage.stage}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{stage.duration}ms</span>
              {stage.error && <span className="text-xs text-red-600">{stage.error}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuildResultPanel({ result }: { result: BuildResult }) {
  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">✅ Build Complete</h2>
      <div className="grid grid-cols-3 gap-4">
        <div><p className="text-xs text-slate-500">Files Generated</p><p className="text-lg font-bold text-slate-800">{result.filesGenerated.length}</p></div>
        <div><p className="text-xs text-slate-500">Iterations</p><p className="text-lg font-bold text-slate-800">{result.iterations}</p></div>
        <div><p className="text-xs text-slate-500">Tests Passing</p><p className="text-lg font-bold text-slate-800">{result.testsPassing ? "✅ Yes" : "❌ No"}</p></div>
      </div>
    </div>
  );
}
