"use client";

import Link from "next/link";

/** Tasknex logo: arrow through nodes (progress + workflow). Indigo + white. */
export function Logo({ className = "", href = "/dashboard" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <circle cx="8" cy="16" r="3" fill="#6366F1" />
        <circle cx="16" cy="16" r="3" fill="#6366F1" />
        <circle cx="24" cy="16" r="3" fill="#6366F1" />
        <path
          d="M11 16H13M19 16H21M14 14.5L15.5 16L14 17.5M20 14.5L21.5 16L20 17.5"
          stroke="#F1F5F9"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-semibold text-lg text-white tracking-tight">
        Tasknex
      </span>
    </Link>
  );
}
