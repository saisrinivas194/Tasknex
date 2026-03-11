"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeProvider";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/new", label: "AI Generator" },
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
    <aside className="w-56 shrink-0 flex flex-col border-r border-slate-700/80 bg-navy-card/50 min-h-screen">
      <div className="p-5 border-b border-slate-700/80">
        <Logo />
        <p className="text-muted text-xs mt-1.5">
          Plan less. Execute faster.
        </p>
      </div>
      <nav className="p-3 flex-1">
        <ul className="space-y-0.5">
          {nav.map(({ href, label }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-slate-300 hover:bg-slate-700/50 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-3 border-t border-slate-700/80 space-y-2">
        <div className="flex items-center gap-2 px-3">
          <ThemeToggle />
        </div>
        <p className="text-muted text-xs px-3 truncate" title={userEmail}>
          {userEmail}
        </p>
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-400 hover:bg-slate-700/50 hover:text-white transition"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
