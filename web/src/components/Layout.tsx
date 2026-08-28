import { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", icon: "📊" },
  { to: "/specs", label: "Spec Generator", icon: "📝" },
  { to: "/build", label: "One-Shot Build", icon: "🔨" },
  { to: "/features", label: "Feature Add", icon: "✨" },
  { to: "/bugs", label: "Bug Scanner", icon: "🐛" },
  { to: "/audit", label: "Audit Report", icon: "🔍" },
  { to: "/notifications", label: "Notifications", icon: "🔔" },
  { to: "/github", label: "GitHub", icon: "🐙" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-tight">ADLC Engine</h1>
          <p className="text-xs text-slate-400 mt-1">Spec-Driven SDLC</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-brand-600 text-white font-medium"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
          ADLC v1.0.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
