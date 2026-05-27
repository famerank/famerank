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
    <section className="py-24 px-6 lg:px-8 bg-ink-100">
      <div className="mx-auto max-w-7xl">

        {/* Section header */}
        <div className="text-center mb-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 mb-3">
            Browse by Category
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">
            Every Genre. Every Niche.{' '}
            <span className="text-gold-gradient">Ranked.</span>
          </h2>
          <p className="mt-4 text-ink-500 font-light max-w-xl mx-auto">
            Explore rankings across the world&apos;s most competitive creator
            categories — updated daily with real-time data.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/rankings/${cat.slug}`}
              className="group flex flex-col bg-white rounded border border-ink-200 p-6 hover:border-gold-500/50 hover:shadow-sm transition-all duration-200"
            >
              {/* Icon */}
              <div className="text-2xl mb-4">{cat.icon}</div>

              {/* Name */}
              <h3 className="text-base font-bold text-ink-950 mb-2 group-hover:text-gold-600 transition-colors">
                {cat.name}
              </h3>

              {/* Description */}
              <p className="text-sm text-ink-500 leading-relaxed flex-1 font-light">
                {cat.description}
              </p>

              {/* Stats + arrow */}
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-ink-400 font-medium">
                  {cat.creator_count > 0
                    ? `${cat.creator_count.toLocaleString()} creators`
                    : 'Rankings live'}
                </span>
                <span className="text-ink-300 group-hover:text-gold-500 group-hover:translate-x-0.5 transition-all duration-150 text-base leading-none">
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
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-950 hover:text-gold-600 transition-colors border-b border-ink-950 hover:border-gold-500 pb-0.5"
          >
            View All Categories
            <span className="text-base leading-none">&rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
