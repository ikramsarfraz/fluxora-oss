import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Acme Distribution ERP",
  description: "Wholesale meat distribution ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppErrorBoundary>
          <QueryProvider>{children}</QueryProvider>
        </AppErrorBoundary>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
