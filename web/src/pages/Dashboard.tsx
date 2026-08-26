import { useEffect, useState } from "react";
import { api, SpecsDirectory, AuditReport, DigestSummary } from "../api/client";

export default function Dashboard() {
  const [specs, setSpecs] = useState<SpecsDirectory | null>(null);
  const [audit, setAudit] = useState<AuditReport | null>(null);
  const [digest, setDigest] = useState<DigestSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [specsRes, auditRes, digestRes] = await Promise.allSettled([
          api.listSpecs(),
          api.runAudit(),
          api.getDigest(true),
        ]);
        if (specsRes.status === "fulfilled") setSpecs(specsRes.value.data);
        if (auditRes.status === "fulfilled") setAudit(auditRes.value.data);
        if (digestRes.status === "fulfilled") setDigest(digestRes.value.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Specs" value={specs?.totalSpecs ?? 0} icon="📄" color="blue" />
        <StatCard title="Valid Specs" value={specs?.validSpecs ?? 0} icon="✅" color="green" />
        <StatCard title="Avg Coverage" value={`${specs?.stats.averageCoverage ?? 0}%`} icon="📈" color="purple" />
        <StatCard title="Flagged Issues" value={audit?.flagged.length ?? 0} icon="🚩" color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SpecsList specs={specs} />
        <ActivityPanel digest={digest} />
      </div>

      {audit && audit.recommendations.length > 0 && (
        <RecommendationsPanel recommendations={audit.recommendations} />
      )}
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    purple: "bg-purple-50 border-purple-200",
    red: "bg-red-50 border-red-200",
  };
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold text-slate-800">{value}</span>
      </div>
      <p className="text-sm text-slate-600 mt-2">{title}</p>
    </div>
  );
}

function CoverageBadge({ score }: { score: number }) {
  const color = score >= 75 ? "bg-green-100 text-green-700" : score >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{score}%</span>;
}

function SpecsList({ specs }: { specs: SpecsDirectory | null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Specs</h2>
      {specs && specs.entries.length > 0 ? (
        <div className="space-y-3">
          {specs.entries.map((entry) => (
            <div key={entry.projectName} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium text-slate-800">{entry.projectName}</div>
                <div className="text-xs text-slate-500">v{entry.version} · {entry.status}</div>
              </div>
              <div className="flex items-center gap-3">
                <CoverageBadge score={entry.coverageScore} />
                {entry.isValid ? <span className="text-green-600 text-xs">✓ Valid</span> : <span className="text-red-600 text-xs">✗ Invalid</span>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-sm">No specs found. Generate your first spec!</p>
      )}
    </div>
  );
}

function ActivityPanel({ digest }: { digest: DigestSummary | null }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Recent Activity</h2>
      {digest ? (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-3">{digest.title}</p>
          <ul className="space-y-2">
            {digest.bullets.map((bullet, i) => (
              <li key={i} className="text-sm text-slate-600 flex gap-2">
                <span className="text-slate-400">•</span>{bullet}
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-400 mt-3">{digest.entryCount} events · {digest.severity}</p>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">No recent activity.</p>
      )}
    </div>
  );
}

function RecommendationsPanel({ recommendations }: { recommendations: string[] }) {
  return (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-amber-800 mb-3">💡 Recommendations</h2>
      <ul className="space-y-2">
        {recommendations.map((rec, i) => (
          <li key={i} className="text-sm text-amber-700">• {rec}</li>
        ))}
      </ul>
    </div>
  );
}
