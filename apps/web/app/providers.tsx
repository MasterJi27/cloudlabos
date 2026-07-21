"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthGuard } from "@/components/AuthGuard";
import { CommandPalette } from "@/components/CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthGuard>
            {children}
            <CommandPalette />
            <KeyboardShortcuts />
          </AuthGuard>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
