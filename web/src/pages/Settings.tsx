import { useState, useEffect } from "react";
import { api, LLMConfig, AgentSettings, Provider } from "../api/client";

const AGENTS: { id: keyof AgentSettings; label: string; icon: string; desc: string }[] = [
  { id: "spec-generator", label: "Spec Generator", icon: "📋", desc: "Generates technical specifications from feature descriptions" },
  { id: "oneshot-builder", label: "One-Shot Builder", icon: "🔨", desc: "Generates complete code implementations from specifications" },
  { id: "bug-scanner", label: "Bug Scanner", icon: "🐛", desc: "Scans code for bugs and generates fixes" },
];

export default function Settings() {
  const [settings, setSettings] = useState<AgentSettings | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [activeTab, setActiveTab] = useState<keyof AgentSettings>("spec-generator");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([api.settingsGetLLM(), api.settingsGetProviders()]);
        if (s.success) setSettings(s.data);
        if (p.success) setProviders(p.data);
      } catch (err) { setError(err instanceof Error ? err.message : "Failed to load"); }
    })();
  }, []);

  const cfg = settings?.[activeTab];

  function updateField(field: keyof LLMConfig, value: string | number) {
    if (!settings) return;
    setSettings({ ...settings, [activeTab]: { ...settings[activeTab], [field]: value } });
  }

  function applyProvider(pid: string) {
    const prov = providers.find((p) => p.id === pid);
    if (!prov || !settings) return;
    setSettings({ ...settings, [activeTab]: { ...settings[activeTab], provider: pid, baseUrl: prov.baseUrl, model: prov.models[0] || "" } });
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true); setError(""); setSuccess("");
    try { const res = await api.settingsUpdateLLM(activeTab, settings[activeTab]); if (res.success) setSuccess(`Saved for ${activeTab}!`); }
    catch (err) { setError(err instanceof Error ? err.message : "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleTest() {
    if (!cfg) return;
    setTesting(true); setTestResult(null);
    try {
      const res = await api.settingsTestLLM(cfg);
      setTestResult(res.success && res.data
        ? { success: true, message: `✅ Connected! Model: ${res.data.model} (${res.data.duration}ms)` }
        : { success: false, message: `❌ ${res.error || "Unknown error"}` });
    } catch (err) { setTestResult({ success: false, message: `❌ ${err instanceof Error ? err.message : "Test failed"}` }); }
    finally { setTesting(false); }
  }

  if (!settings) return <div className="flex items-center justify-center h-64"><div className="text-slate-500">Loading settings...</div></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">⚙️ Settings</h1>
      <p className="text-slate-500 mb-6">Configure LLM providers for each AI agent independently.</p>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">✅ {success}</div>}

      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-2">
        {AGENTS.map((agent) => (
          <button key={agent.id} onClick={() => { setActiveTab(agent.id); setTestResult(null); }}
            className={`px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors ${activeTab === agent.id ? "bg-brand-50 text-brand-700 border-b-2 border-brand-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"}`}>
            {agent.icon} {agent.label}
          </button>
        ))}
      </div>

      <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-sm text-slate-600">{AGENTS.find((a) => a.id === activeTab)?.desc}</p>
      </div>

      {cfg && <ConfigForm cfg={cfg} providers={providers} updateField={updateField} applyProvider={applyProvider}
        saving={saving} testing={testing} testResult={testResult} handleSave={handleSave} handleTest={handleTest} />}
    </div>
  );
}

function ConfigForm({ cfg, providers, updateField, applyProvider, saving, testing, testResult, handleSave, handleTest }: {
  cfg: LLMConfig; providers: Provider[]; updateField: (f: keyof LLMConfig, v: string | number) => void;
  applyProvider: (id: string) => void; saving: boolean; testing: boolean;
  testResult: { success: boolean; message: string } | null; handleSave: () => void; handleTest: () => void;
}) {
  const provider = providers.find((p) => p.id === cfg.provider);
  const models = provider?.models || [];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Provider</label>
          <select value={cfg.provider} onChange={(e) => applyProvider(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Model</label>
          {models.length > 0 ? (
            <select value={cfg.model} onChange={(e) => updateField("model", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <input type="text" value={cfg.model} onChange={(e) => updateField("model", e.target.value)} placeholder="model-name"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Base URL</label>
          <input type="text" value={cfg.baseUrl} onChange={(e) => updateField("baseUrl", e.target.value)} placeholder="https://api.openai.com/v1"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">API Key</label>
          <input type="password" value={cfg.apiKey} onChange={(e) => updateField("apiKey", e.target.value)} placeholder="sk-..."
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Temperature ({cfg.temperature})</label>
          <input type="range" min="0" max="2" step="0.1" value={cfg.temperature}
            onChange={(e) => updateField("temperature", parseFloat(e.target.value))} className="w-full accent-brand-600" />
          <div className="flex justify-between text-xs text-slate-400"><span>Precise (0)</span><span>Creative (2)</span></div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Max Tokens</label>
          <input type="number" value={cfg.maxTokens} onChange={(e) => updateField("maxTokens", parseInt(e.target.value) || 4096)}
            min={256} max={128000} step={256}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
        </div>
      </div>
      <div className="flex items-center gap-3 mt-6 pt-6 border-t border-slate-200">
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "💾 Save Settings"}
        </button>
        <button onClick={handleTest} disabled={testing}
          className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50 transition-colors border border-slate-300">
          {testing ? "Testing..." : "🔌 Test Connection"}
        </button>
        {testResult && <span className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>{testResult.message}</span>}
      </div>
    </div>
  );
}