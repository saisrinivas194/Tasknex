"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const nav = [
  { href: "/dashboard", label: "Workflows", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { href: "/dashboard/new", label: "Create with AI", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];

export function Sidebar({
  userEmail,
  onLogout,
}: {
  userEmail: string;
  onLogout: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 h-screen flex flex-col border-r border-[#253858] bg-[#0D1424] overflow-y-auto">
      <div className="p-4 border-b border-[#253858]">
        <Logo />
        <p className="text-muted text-xs mt-1.5">
          Goals → Workflows → Done
        </p>
      </div>
      <nav className="p-2 flex-1">
        <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Projects
        </p>
        <ul className="space-y-0.5 mt-1">
          {nav.map(({ href, label, icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition ${
                    active
                      ? "bg-primary/20 text-primary-200"
                      : "text-slate-300 hover:bg-[#253858] hover:text-white"
                  }`}
                >
                  <svg className="w-5 h-5 shrink-0 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                  </svg>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-3 border-t border-[#253858] space-y-2">
        <p className="text-muted text-xs px-3 truncate" title={userEmail}>
          {userEmail}
        </p>
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2 rounded text-sm text-slate-400 hover:bg-[#253858] hover:text-white transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
