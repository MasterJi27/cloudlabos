import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthGuard } from "@/components/AuthGuard";
import { CommandPalette } from "@/components/CommandPalette";

export const metadata: Metadata = {
  title: "CloudLabOS",
  description: "Enterprise AI workflow operating system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen antialiased font-sans" suppressHydrationWarning>
        <AuthGuard>{children}</AuthGuard>
        <CommandPalette />
      </body>
    </html>
  );
}
