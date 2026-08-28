import { useState, useEffect, useCallback } from "react";
import { api, GithubRepo, GithubStatus } from "../api/client";

export default function GitHub() {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneBranch, setCloneBranch] = useState("");
  const [cloning, setCloning] = useState(false);
  const [commitMsg, setCommitMsg] = useState("");
  const [pushing, setPushing] = useState(false);

  const loadRepos = useCallback(async () => {
    try { const res = await api.githubListRepos(); if (res.success) setRepos(res.data); } catch {}
  }, []);

  const loadStatus = useCallback(async (rp: string) => {
    if (!rp) { setStatus(null); return; }
    try { const res = await api.githubStatus(rp); if (res.success) setStatus(res.data); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
  }, []);

  useEffect(() => { loadRepos(); }, [loadRepos]);
  useEffect(() => { if (selectedRepo) loadStatus(selectedRepo); }, [selectedRepo, loadStatus]);

  async function handleClone(e: React.FormEvent) {
    e.preventDefault(); if (!cloneUrl.trim()) return;
    setCloning(true); setError(""); setSuccess("");
    try {
      const res = await api.githubClone({ url: cloneUrl.trim(), name: cloneName.trim() || undefined, branch: cloneBranch.trim() || undefined });
      if (res.success) { setSuccess(`Cloned "${res.data.name}"!`); setCloneUrl(""); setCloneName(""); setCloneBranch(""); loadRepos(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Clone failed"); }
    finally { setCloning(false); }
  }

  async function handlePush(e: React.FormEvent) {
    e.preventDefault(); if (!selectedRepo || !commitMsg.trim()) return;
    setPushing(true); setError(""); setSuccess("");
    try {
      const res = await api.githubPush({ repoPath: selectedRepo, message: commitMsg.trim() });
      if (res.success) { setSuccess(`Pushed to ${res.data.branch} — ${res.data.commit}`); setCommitMsg(""); loadStatus(selectedRepo); }
    } catch (err) { setError(err instanceof Error ? err.message : "Push failed"); }
    finally { setPushing(false); }
  }

  async function handleDelete(name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try { await api.githubDeleteRepo(name); if (selectedRepo?.includes(name)) { setSelectedRepo(""); setStatus(null); } loadRepos(); }
    catch (err) { setError(err instanceof Error ? err.message : "Delete failed"); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">GitHub Connection</h1>
      <p className="text-slate-500 mb-6">Clone repositories, view status, and push changes.</p>
      {error && <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">❌ {error}</div>}
      {success && <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">✅ {success}</div>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ClonePanel cloneUrl={cloneUrl} setCloneUrl={setCloneUrl} cloneName={cloneName} setCloneName={setCloneName} cloneBranch={cloneBranch} setCloneBranch={setCloneBranch} cloning={cloning} handleClone={handleClone} />
        <PushPanel repos={repos} selectedRepo={selectedRepo} setSelectedRepo={setSelectedRepo} commitMsg={commitMsg} setCommitMsg={setCommitMsg} pushing={pushing} handlePush={handlePush} />
      </div>
      <ReposList repos={repos} selectedRepo={selectedRepo} setSelectedRepo={setSelectedRepo} onDelete={handleDelete} onRefresh={loadRepos} />
      {status && <GitStatusPanel status={status} />}
    </div>
  );
}

function ClonePanel({ cloneUrl, setCloneUrl, cloneName, setCloneName, cloneBranch, setCloneBranch, cloning, handleClone }: {
  cloneUrl: string; setCloneUrl: (v: string) => void; cloneName: string; setCloneName: (v: string) => void;
  cloneBranch: string; setCloneBranch: (v: string) => void; cloning: boolean; handleClone: (e: React.FormEvent) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">📥 Clone Repository</h2>
      <form onSubmit={handleClone} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Repository URL *</label>
          <input type="text" value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} placeholder="https://github.com/user/repo.git"
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Name (optional)</label>
            <input type="text" value={cloneName} onChange={(e) => setCloneName(e.target.value)} placeholder="my-project"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Branch (optional)</label>
            <input type="text" value={cloneBranch} onChange={(e) => setCloneBranch(e.target.value)} placeholder="main"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none" />
          </div>
        </div>
        <button type="submit" disabled={cloning || !cloneUrl.trim()}
          className="w-full px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {cloning ? "Cloning..." : "📥 Clone Repository"}
        </button>
      </form>
    </div>
  );
}

function PushPanel({ repos, selectedRepo, setSelectedRepo, commitMsg, setCommitMsg, pushing, handlePush }: {
  repos: GithubRepo[]; selectedRepo: string; setSelectedRepo: (v: string) => void;
  commitMsg: string; setCommitMsg: (v: string) => void; pushing: boolean; handlePush: (e: React.FormEvent) => void;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">📤 Push Changes</h2>
      <form onSubmit={handlePush} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Repository *</label>
          <select value={selectedRepo} onChange={(e) => setSelectedRepo(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none">
            <option value="">Select a repo...</option>
            {repos.map((r) => <option key={r.path} value={r.path}>{r.name} ({r.branch})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Commit Message *</label>
          <textarea value={commitMsg} onChange={(e) => setCommitMsg(e.target.value)} placeholder="Describe your changes..." rows={3}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none resize-none" required />
        </div>
        <button type="submit" disabled={pushing || !selectedRepo || !commitMsg.trim()}
          className="w-full px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {pushing ? "Pushing..." : "📤 Stage, Commit & Push"}
        </button>
      </form>
    </div>
  );
}

function ReposList({ repos, selectedRepo, setSelectedRepo, onDelete, onRefresh }: {
  repos: GithubRepo[]; selectedRepo: string; setSelectedRepo: (v: string) => void;
  onDelete: (n: string) => void; onRefresh: () => void;
}) {
  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">📁 Local Repositories</h2>
        <button onClick={onRefresh} className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">🔄 Refresh</button>
      </div>
      {repos.length > 0 ? (
        <div className="space-y-2">
          {repos.map((repo) => (
            <div key={repo.name}
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${selectedRepo === repo.path ? "bg-brand-50 border-brand-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100"}`}
              onClick={() => setSelectedRepo(repo.path)}>
              <div className="flex items-center gap-3">
                <span className="text-xl">📁</span>
                <div>
                  <div className="font-medium text-slate-800">{repo.name}</div>
                  <div className="text-xs text-slate-500">
                    {repo.branch && <span className="inline-flex items-center gap-1 mr-3">🔀 {repo.branch}</span>}
                    {repo.isClean ? <span className="text-green-600">✓ Clean</span> : <span className="text-amber-600">● Modified</span>}
                    {repo.lastCommit && <span className="ml-3 text-slate-400">{repo.lastCommit.hash} — {repo.lastCommit.message.substring(0, 50)}</span>}
                  </div>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); onDelete(repo.name); }}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors">🗑 Delete</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm text-center py-8">No repositories cloned yet. Clone one above to get started.</p>
      )}
    </div>
  );
}

function GitStatusPanel({ status }: { status: GithubStatus }) {
  return (
    <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">🔀 Git Status — <span className="text-brand-600">{status.branch}</span></h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center"><p className="text-lg font-bold text-slate-800">{status.branch || "—"}</p><p className="text-xs text-slate-600">Branch</p></div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center"><p className="text-lg font-bold text-slate-800">{status.ahead}</p><p className="text-xs text-slate-600">Ahead</p></div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center"><p className="text-lg font-bold text-slate-800">{status.behind}</p><p className="text-xs text-slate-600">Behind</p></div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center"><p className="text-lg font-bold text-slate-800">{status.modified.length}</p><p className="text-xs text-slate-600">Modified</p></div>
      </div>
      {(status.modified.length > 0 || status.created.length > 0 || status.deleted.length > 0) && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Changed Files</h3>
          <div className="space-y-1">
            {status.modified.map((f) => <div key={f} className="flex items-center gap-2 text-sm"><span className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-amber-600 bg-amber-50">M</span><code className="text-slate-700 font-mono text-xs">{f}</code></div>)}
            {status.created.map((f) => <div key={f} className="flex items-center gap-2 text-sm"><span className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-green-600 bg-green-50">A</span><code className="text-slate-700 font-mono text-xs">{f}</code></div>)}
            {status.deleted.map((f) => <div key={f} className="flex items-center gap-2 text-sm"><span className="w-5 h-5 flex items-center justify-center rounded text-xs font-bold text-red-600 bg-red-50">D</span><code className="text-slate-700 font-mono text-xs">{f}</code></div>)}
          </div>
        </div>
      )}
      {status.commits.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Recent Commits</h3>
          <div className="space-y-2">
            {status.commits.slice(0, 8).map((c) => (
              <div key={c.hash} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <code className="text-xs text-brand-600 font-mono mt-0.5 shrink-0">{c.hash}</code>
                <div className="min-w-0"><p className="text-sm text-slate-800 truncate">{c.message}</p><p className="text-xs text-slate-400">{c.author} · {new Date(c.date).toLocaleDateString()}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}
      {status.isClean && <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 text-center mt-4">✅ Working tree is clean — nothing to commit.</div>}
    </div>
  );
}