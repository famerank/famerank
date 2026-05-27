import { createServiceClient } from '@/lib/supabase/service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Categories — FameRank',
  description: 'Browse creator rankings across every category — Music, Gaming, Beauty, Fitness, and more.',
};

export default async function CategoriesPage() {
  const supabase = createServiceClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, icon, description, creator_count')
    .is('parent_id', null)
    .order('name');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Page header */}
          <div className="mb-12 pb-8 border-b border-ink-200">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 mb-3">
              Browse
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-ink-950 tracking-tight">
              All Categories
            </h1>
            <p className="mt-3 text-ink-500 font-light max-w-xl">
              Rankings for every creator niche — from Music and Gaming to Fitness and Business.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(categories ?? []).map((cat) => (
              <Link
                key={cat.slug}
                href={`/rankings/${cat.slug}`}
                className="group flex flex-col bg-white rounded border border-ink-200 p-6 hover:border-gold-500/50 hover:shadow-sm transition-all duration-200"
              >
                <div className="text-2xl mb-4">{cat.icon}</div>

                <h2 className="text-base font-bold text-ink-950 mb-2 group-hover:text-gold-600 transition-colors">
                  {cat.name}
                </h2>

                <p className="text-sm text-ink-500 leading-relaxed flex-1 font-light">
                  {cat.description}
                </p>

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
        </div>
      </main>

      <Footer />
    </div>
  );
}
