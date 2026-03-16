import { HomeClient } from "@/components/HomeClient";
import { Logo } from "@/components/Logo";
import Link from "next/link";

/** Server-rendered landing so AI/crawlers get full content instead of "Loading…". */
export default function Home() {
  return (
    <HomeClient>
      <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-6 bg-navy">
        <div className="flex flex-col items-center gap-6 text-center">
          <Logo />
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight sm:text-2xl">
              Turn goals into executable workflows
            </h1>
            <p className="text-muted text-sm mt-2 max-w-md">
              Plan with AI. Track progress on a Kanban board. Get from idea to done.
            </p>
          </div>
        </div>
        <p className="text-muted text-sm max-w-sm text-center">
          Sign in or create an account to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto sm:min-w-[240px]">
          <Link href="/login" className="btn-primary text-center py-2.5">
            Sign in
          </Link>
          <Link href="/signup" className="btn-secondary text-center py-2.5">
            Create account
          </Link>
        </div>
      </div>
    </HomeClient>
  );
}
