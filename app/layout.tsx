import type { Metadata } from "next";
import { Archivo, Geist_Mono, Newsreader } from "next/font/google";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { PostHogProvider } from "@/components/posthog-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

// Newsreader carries the brand's editorial weight on financial / quantitative
// values (settings/billing usage tiles, billing amounts) and page heroes.
// Never use sans-serif numerals for money in the product surface.
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500"],
  style: ["normal", "italic"],
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
      className={`${sans.variable} ${mono.variable} ${serif.variable} h-full bg-background antialiased`}
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
