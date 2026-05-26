import Link from "next/link";

const footerLinks = {
  Platform: [
    { label: "Rankings", href: "/rankings" },
    { label: "Categories", href: "/categories" },
    { label: "Trending", href: "/trending" },
    { label: "Leaderboard", href: "/leaderboard" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Methodology", href: "/methodology" },
    { label: "Press", href: "/press" },
    { label: "Careers", href: "/careers" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-obsidian-900 bg-obsidian-950">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-gold-gradient">FAME</span>
              <span className="text-lg font-bold text-obsidian-50">RANK</span>
            </div>
            <p className="text-sm text-obsidian-400 leading-relaxed max-w-xs">
              The world&apos;s most authoritative platform for creator and
              influencer rankings.
            </p>
            <p className="text-xs text-obsidian-600 font-medium tracking-widest uppercase">
              TheFameRank.com
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading} className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-obsidian-500">
                {heading}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-obsidian-400 hover:text-gold-400 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-obsidian-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-obsidian-600">
            &copy; {new Date().getFullYear()} FameRank. All rights reserved.
          </p>
          <p className="text-xs text-obsidian-700 tracking-wide">
            The Definitive Authority on Creator Rankings
          </p>
        </div>
      </div>
    </footer>
  );
}
