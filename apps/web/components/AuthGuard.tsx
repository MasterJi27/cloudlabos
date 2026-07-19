"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/store";
import { Cpu } from "lucide-react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, fetchMe } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchMe().finally(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (mounted && !isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
  }, [mounted, isAuthenticated, pathname]);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="flex flex-col items-center gap-3">
          <Cpu className="w-6 h-6 text-[var(--accent)] animate-pulse" />
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
