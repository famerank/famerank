import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,154,18,0.15) 0%, transparent 65%)",
        }}
      />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,222,149,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,222,149,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-gold-subtle px-4 py-1.5 mb-8 bg-gold-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-500 animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-gold-400">
            Rankings Updated Daily
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] text-balance mb-6">
          <span className="block text-obsidian-50">The World&apos;s Most</span>
          <span className="block text-obsidian-50">Authoritative</span>
          <span className="block text-gold-gradient mt-1">Creator Rankings</span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-6 text-lg sm:text-xl text-obsidian-400 max-w-2xl mx-auto leading-relaxed text-balance">
          FameRank tracks millions of creators across every category — delivering
          transparent, data-driven rankings trusted by talent agencies, brands,
          and fans worldwide.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/rankings"
            className="w-full sm:w-auto rounded-sm bg-gold-600 px-8 py-3.5 text-sm font-bold text-obsidian-950 hover:bg-gold-500 transition-colors tracking-wide uppercase"
          >
            Explore Rankings
          </Link>
          <Link
            href="/methodology"
            className="w-full sm:w-auto rounded-sm border border-obsidian-700 px-8 py-3.5 text-sm font-semibold text-obsidian-300 hover:border-gold-600 hover:text-gold-400 transition-colors tracking-wide uppercase"
          >
            Our Methodology
          </Link>
        </div>

        {/* Social proof */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
          {[
            { value: "50M+", label: "Creators Tracked" },
            { value: "200+", label: "Categories" },
            { value: "Daily", label: "Rank Updates" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-gold-400">{stat.value}</div>
              <div className="text-xs uppercase tracking-widest text-obsidian-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none bg-gradient-to-t from-obsidian-950 to-transparent" />
    </section>
  );
}
