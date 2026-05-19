import type { Metadata } from "next";
import { Newsreader, Geist, Geist_Mono } from "next/font/google";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PostHogProvider } from "@/components/posthog-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  axes: ["opsz"],
  display: "swap",
});

const sans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fluxora",
  description:
    "Fluxora — multi-tenant ERP for distribution teams: orders, inventory, invoicing, and payments in one workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} ${mono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppErrorBoundary>
          <PostHogProvider>
            <QueryProvider>{children}</QueryProvider>
          </PostHogProvider>
        </AppErrorBoundary>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
