import { useState } from "react";
import { streamRequest, api, SpecMetadata } from "../api/client";
import BuildLogs from "../components/BuildLogs";

interface ProgressEvent {
  step: number;
  totalSteps: number;
  label: string;
  percent: number;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  data?: Record<string, unknown>;
}

const STEPS = [
  "Loading spec template...",
  "Analyzing product description...",
  "Generating spec content...",
  "Writing spec to disk...",
  "Finalizing...",
];

export default function SpecGenerator() {
  const [prompt, setPrompt] = useState("");
  const [projectName, setProjectName] = useState("");
  const [constraints, setConstraints] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<SpecMetadata & { outputPath?: string; specContent?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editableContent, setEditableContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    setProgress(null);
    setCompletedSteps([]);
    setLogs([]);

    try {
      const stream = await streamRequest("/specs/generate", {
        prompt: prompt.trim(),
        projectName: projectName.trim() || undefined,
        constraints: constraints.trim()
          ? constraints.split(",").map((c) => c.trim())
          : undefined,
        dryRun,
      });

      for await (const { event, data } of stream) {
        if (event === "progress") {
          const p = data as ProgressEvent;
          setProgress(p);
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            level: "info",
            message: p.label,
          }]);
          if (p.step > 0) {
            setCompletedSteps((prev) => {
              const next = [...prev];
              for (let i = 1; i < p.step; i++) {
                if (!next.includes(i)) next.push(i);
              }
              return next;
            });
          }
        } else if (event === "result") {
          const res = data as { success: boolean; data: (SpecMetadata & { outputPath?: string; specContent?: string }) | null; errors?: string[] };
          if (res.success && res.data) {
            setResult(res.data);
            if (res.data.specContent) {
              setEditableContent(res.data.specContent);
              setIsEditing(true);
            }
            setCompletedSteps([1, 2, 3, 4, 5]);
          } else {
            setError(res.errors?.join(", ") || "Spec generation failed");
          }
        } else if (event === "error") {
          setError((data as { error: string }).error);
          setLogs((prev) => [...prev, {
            timestamp: new Date().toISOString(),
            level: "error",
            message: (data as { error: string }).error,
          }]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  async function handleSaveSpec() {
    if (!result?.outputPath || !editableContent) return;

    setSaveStatus("saving");
    setSaveError("");

    try {
      const res = await api.saveSpec({
        outputPath: result.outputPath,
        content: editableContent,
      });

      if (res.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setSaveError("Failed to save spec");
      }
    } catch (err) {
      setSaveStatus("error");
      setSaveError(err instanceof Error ? err.message : "Failed to save spec");
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

      {/* Progress Stepper */}
      {loading && progress && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Generating Spec</h2>
            <span className="text-sm font-medium text-brand-600">{progress.percent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 mb-6">
            <div
              className="bg-brand-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <div className="space-y-3">
            {STEPS.map((stepLabel, i) => {
              const stepNum = i + 1;
              const isCompleted = completedSteps.includes(stepNum);
              const isCurrent = progress.step === stepNum;
              return (
                <div key={stepNum} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                    isCompleted ? "bg-green-500 text-white"
                      : isCurrent ? "bg-brand-600 text-white animate-pulse"
                      : "bg-slate-200 text-slate-500"
                  }`}>
                    {isCompleted ? "✓" : stepNum}
                  </div>
                  <span className={`text-sm ${
                    isCompleted ? "text-green-700 font-medium"
                      : isCurrent ? "text-slate-800 font-medium"
                      : "text-slate-400"
                  }`}>
                    {stepLabel}
                  </span>
                  {isCurrent && (
                    <div className="flex gap-1 ml-auto">
                      <div className="w-1.5 h-1.5 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 bg-brand-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          ❌ {error}
        </div>
      )}

      {/* Build Logs */}
      <div className="mt-6">
        <BuildLogs logs={logs} isStreaming={loading} />
      </div>

      {result && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">✅ Spec Generated Successfully</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <InfoItem label="Project" value={result.projectName} />
            <InfoItem label="Version" value={result.version} />
            <InfoItem label="Sections" value={String(result.sectionCount)} />
            <InfoItem label="User Stories" value={String(result.userStoryCount)} />
          </div>
          {result.outputPath && <InfoItem label="Output Path" value={result.outputPath} />}

          {/* Editable Spec Content */}
          {isEditing && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-md font-semibold text-slate-700">📄 Spec Content (Editable)</h3>
                <div className="flex items-center gap-3">
                  {saveStatus === "saved" && (
                    <span className="text-sm text-green-600 font-medium">✅ Saved</span>
                  )}
                  {saveStatus === "error" && (
                    <span className="text-sm text-red-600 font-medium">❌ {saveError}</span>
                  )}
                  <button
                    onClick={handleSaveSpec}
                    disabled={saveStatus === "saving"}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saveStatus === "saving" ? "Saving..." : "💾 Save Changes"}
                  </button>
                </div>
              </div>
              <textarea
                value={editableContent}
                onChange={(e) => {
                  setEditableContent(e.target.value);
                  setSaveStatus("idle");
                }}
                className="w-full h-96 p-4 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-700 font-mono whitespace-pre-wrap resize-y focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-slate-400">
                Edit the spec content above and click "Save Changes" to update the file on disk.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-800 break-all">{value}</p>
    </div>
  );
}
