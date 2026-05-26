"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { label: "Rankings", href: "/rankings" },
  { label: "Categories", href: "/categories" },
  { label: "Trending", href: "/trending" },
  { label: "About", href: "/about" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-obsidian-900 bg-obsidian-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-xl font-bold tracking-tight text-gold-gradient">
              FAME
            </span>
            <span className="text-xl font-bold tracking-tight text-obsidian-50 group-hover:text-obsidian-200 transition-colors">
              RANK
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-obsidian-300 hover:text-gold-400 transition-colors tracking-wide uppercase"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-obsidian-300 hover:text-obsidian-50 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-obsidian-950 hover:bg-gold-500 transition-colors tracking-wide"
            >
              Get Access
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-2 text-obsidian-300 hover:text-obsidian-50"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span
                className={`block h-0.5 bg-current transition-transform duration-200 ${
                  menuOpen ? "rotate-45 translate-y-[7px]" : ""
                }`}
              />
              <span
                className={`block h-0.5 bg-current transition-opacity duration-200 ${
                  menuOpen ? "opacity-0" : ""
                }`}
              />
              <span
                className={`block h-0.5 bg-current transition-transform duration-200 ${
                  menuOpen ? "-rotate-45 -translate-y-[9px]" : ""
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-obsidian-900 py-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-2 py-2 text-sm font-medium text-obsidian-300 hover:text-gold-400 transition-colors uppercase tracking-wide"
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3 border-t border-obsidian-900 flex flex-col gap-2">
              <Link
                href="/login"
                className="px-2 py-2 text-sm text-obsidian-300 hover:text-obsidian-50"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="mx-2 rounded-sm bg-gold-600 px-4 py-2 text-sm font-semibold text-obsidian-950 text-center hover:bg-gold-500 transition-colors"
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
