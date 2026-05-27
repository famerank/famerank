"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Rankings",   href: "/rankings" },
  { label: "Categories", href: "/categories" },
  { label: "Trending",   href: "/trending" },
  { label: "About",      href: "/about" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-ink-200">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-0.5 group">
            <span className="text-xl font-black tracking-tight text-gold-500">
              FAME
            </span>
            <span className="text-xl font-black tracking-tight text-ink-950">
              RANK
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[13px] font-medium text-ink-500 hover:text-ink-950 transition-colors tracking-wide"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-5">
            <Link
              href="/login"
              className="text-[13px] font-medium text-ink-500 hover:text-ink-950 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-ink-950 px-4 py-2 text-[13px] font-semibold text-white hover:bg-ink-800 transition-colors tracking-wide"
            >
              Get Access
            </Link>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-ink-500 hover:text-ink-950"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className={`block h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "rotate-45 translate-y-[7px]" : ""}`} />
              <span className={`block h-0.5 bg-current transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`} />
              <span className={`block h-0.5 bg-current transition-transform duration-200 ${menuOpen ? "-rotate-45 -translate-y-[9px]" : ""}`} />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-ink-200 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-2 py-2.5 text-sm font-medium text-ink-600 hover:text-ink-950 transition-colors"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-ink-200 flex flex-col gap-2">
              <Link href="/login" className="px-2 py-2 text-sm text-ink-500 hover:text-ink-950">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="mx-2 rounded bg-ink-950 px-4 py-2 text-sm font-semibold text-white text-center hover:bg-ink-800 transition-colors"
              >
                Get Access
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
