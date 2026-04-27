"use client";

import Link from "next/link";
import { useState } from "react";
import { primaryBtn, primaryBtnHover } from "./styles";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <nav className="sticky top-0 z-50 border-b border-[oklch(0.92_0.01_230)] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-[0.95rem] font-bold tracking-tight sm:gap-2.5" style={{ color: "oklch(0.35 0.10 230)" }}>
          <div className="flex size-7 items-center justify-center rounded-lg text-[0.7rem] font-extrabold text-white shadow-sm" style={{ background: "linear-gradient(135deg, oklch(0.35 0.10 230), oklch(0.45 0.12 210))" }}>
            Fx
          </div>
          <span className="hidden sm:inline">Fluxora</span>
        </Link>
        
        {/* Desktop nav */}
        <div className="hidden items-center gap-8 text-[0.88rem] font-medium text-[oklch(0.45_0.02_230)] md:flex">
          <a href="#features" className="transition-colors hover:text-[oklch(0.25_0.05_230)]">Features</a>
          <a href="#how-it-works" className="transition-colors hover:text-[oklch(0.25_0.05_230)]">How it works</a>
          <a href="#customers" className="transition-colors hover:text-[oklch(0.25_0.05_230)]">Customers</a>
          <a href="#pricing" className="transition-colors hover:text-[oklch(0.25_0.05_230)]">Pricing</a>
        </div>
        
        {/* Desktop buttons */}
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="inline-flex h-9 items-center rounded-lg px-4 text-[0.875rem] font-medium text-[oklch(0.45_0.02_230)] transition-colors hover:bg-[oklch(0.97_0.01_230)] hover:text-[oklch(0.25_0.05_230)]">
            Log in
          </Link>
          <Link href="/signup" className={`inline-flex h-9 items-center rounded-lg px-4 text-[0.875rem] font-semibold text-white shadow-sm transition-all lg:px-5 ${primaryBtnHover}`} style={primaryBtn}>
            Start free trial
          </Link>
        </div>
        
        {/* Mobile menu button */}
        <button 
          className="flex size-10 items-center justify-center rounded-lg text-[oklch(0.45_0.02_230)] transition-colors hover:bg-[oklch(0.97_0.01_230)] md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="border-t border-[oklch(0.92_0.01_230)] bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3 text-[0.9rem] font-medium text-[oklch(0.45_0.02_230)]">
            <a href="#features" className="rounded-lg px-3 py-2 transition-colors hover:bg-[oklch(0.97_0.01_230)]" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="rounded-lg px-3 py-2 transition-colors hover:bg-[oklch(0.97_0.01_230)]" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#customers" className="rounded-lg px-3 py-2 transition-colors hover:bg-[oklch(0.97_0.01_230)]" onClick={() => setMobileMenuOpen(false)}>Customers</a>
            <a href="#pricing" className="rounded-lg px-3 py-2 transition-colors hover:bg-[oklch(0.97_0.01_230)]" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
            <div className="mt-2 flex flex-col gap-2 border-t border-[oklch(0.92_0.01_230)] pt-4">
              <Link href="/login" className="rounded-lg px-3 py-2 text-center transition-colors hover:bg-[oklch(0.97_0.01_230)]">
                Log in
              </Link>
              <Link href="/signup" className={`rounded-lg px-3 py-2.5 text-center font-semibold text-white ${primaryBtnHover}`} style={primaryBtn}>
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
