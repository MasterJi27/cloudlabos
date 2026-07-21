"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { Spinner } from "@/components/ui/Spinner";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const { isAuthenticated, fetchMe, loading } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchMe().finally(() => setMounted(true)).catch(() => {});
  }, [fetchMe]);

  useEffect(() => {
    if (mounted && !loading) {
      if (!isAuthenticated && pathname !== "/login") {
        router.replace("/login");
      }
      if (isAuthenticated && pathname === "/login") {
        router.replace("/");
      }
    }
  }, [mounted, loading, isAuthenticated, pathname, router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
        <Spinner size="lg" label="Initializing CloudLabOS..." />
      </div>
    );
  }

  if (!isAuthenticated && pathname !== "/login") {
    return null;
  }

  return <>{children}</>;
}
