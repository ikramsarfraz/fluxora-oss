import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";
import "./styles/erp.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppErrorBoundary>
          <QueryProvider>{children}</QueryProvider>
        </AppErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
