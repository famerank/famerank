import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16 bg-white">

      {/* Very subtle warm tint — barely perceptible */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8 text-center">

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 mb-10">
          <span className="h-px w-8 bg-gold-500 opacity-60" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600">
            Rankings Updated Daily
          </span>
          <span className="h-px w-8 bg-gold-500 opacity-60" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl sm:text-6xl lg:text-[76px] font-black tracking-[-0.02em] leading-[1.0] text-balance mb-7">
          <span className="block text-ink-950">The World&apos;s Most</span>
          <span className="block text-ink-950">Authoritative</span>
          <span className="block text-gold-gradient mt-1">Creator Rankings</span>
        </h1>

        {/* Sub-headline */}
        <p className="mt-6 text-lg sm:text-xl text-ink-500 max-w-2xl mx-auto leading-relaxed font-light text-balance">
          FameRank tracks millions of creators across every category — delivering
          transparent, data-driven rankings trusted by talent agencies, brands,
          and fans worldwide.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/rankings"
            className="w-full sm:w-auto rounded bg-ink-950 px-8 py-3.5 text-sm font-bold text-white hover:bg-ink-800 transition-colors tracking-wide"
          >
            Explore Rankings
          </Link>
          <Link
            href="/methodology"
            className="w-full sm:w-auto rounded border border-ink-300 px-8 py-3.5 text-sm font-semibold text-ink-600 hover:border-ink-950 hover:text-ink-950 transition-colors tracking-wide"
          >
            Our Methodology
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-20 flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-0 divide-y sm:divide-y-0 sm:divide-x divide-ink-200">
          {[
            { value: "785+",   label: "Creators Ranked" },
            { value: "25",     label: "Categories" },
            { value: "Daily",  label: "Rank Updates" },
          ].map((stat) => (
            <div key={stat.label} className="px-10 py-4 sm:py-0 text-center">
              <div className="text-2xl font-black text-ink-950 tabular-nums">{stat.value}</div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-ink-400 font-medium mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-ink-200" />
    </section>
  );
}
