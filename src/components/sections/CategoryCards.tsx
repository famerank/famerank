import { createServiceClient } from '@/lib/supabase/service';
import Link from 'next/link';

export default async function CategoryCards() {
  const supabase = createServiceClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, icon, description, creator_count')
    .is('parent_id', null)
    .order('name');

  if (!categories || categories.length === 0) return null;

  return (
    <section className="py-24 px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-3">
            Browse by Category
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-obsidian-50 tracking-tight">
            Every Genre. Every Niche.{' '}
            <span className="text-gold-gradient">Ranked.</span>
          </h2>
          <p className="mt-4 text-obsidian-400 max-w-xl mx-auto">
            Explore rankings across the world&apos;s most competitive creator
            categories — updated daily with real-time data.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.map((cat, index) => (
            <Link
              key={cat.slug}
              href={`/rankings/${cat.slug}`}
              className="group relative flex flex-col rounded-sm border border-obsidian-800 bg-obsidian-900/50 p-6 hover:border-gold-600/50 hover:bg-gold-subtle transition-all duration-300 overflow-hidden"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hover glow */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(212,154,18,0.08) 0%, transparent 70%)' }}
              />

              {/* Rank label */}
              <span className="text-xs font-semibold tracking-widest text-obsidian-600 uppercase mb-4">
                #{index + 1} {cat.name} Rankings
              </span>

              {/* Icon */}
              <div className="text-3xl mb-4">{cat.icon}</div>

              {/* Name */}
              <h3 className="text-xl font-bold text-obsidian-50 mb-2 group-hover:text-gold-400 transition-colors">
                {cat.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-obsidian-400 leading-relaxed flex-1">
                {cat.description}
              </p>

              {/* Stats + arrow */}
              <div className="mt-6 flex items-center justify-between">
                <span className="text-xs text-obsidian-500 font-medium">
                  {cat.creator_count > 0 ? `${cat.creator_count.toLocaleString()} creators` : 'Rankings live'}
                </span>
                <span className="text-gold-600 group-hover:text-gold-400 group-hover:translate-x-1 transition-all duration-200 text-lg leading-none">
                  &rarr;
                </span>
              </div>
            </Link>
          ))}
        </div>

        {/* See all CTA */}
        <div className="text-center mt-12">
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gold-500 hover:text-gold-400 transition-colors uppercase tracking-wide"
          >
            View All Categories
            <span className="text-base leading-none">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
