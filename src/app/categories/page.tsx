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
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Page header */}
          <div className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-3">
              Browse
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-obsidian-50 tracking-tight">
              All Categories
            </h1>
            <p className="mt-3 text-obsidian-400 max-w-xl">
              Rankings for every creator niche — from Music and Gaming to Fitness and Business.
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {(categories ?? []).map((cat) => (
              <Link
                key={cat.slug}
                href={`/rankings/${cat.slug}`}
                className="group relative flex flex-col rounded-sm border border-obsidian-800 bg-obsidian-900/50 p-6 hover:border-gold-600/50 hover:bg-gold-subtle transition-all duration-300 overflow-hidden"
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 100%, rgba(212,154,18,0.08) 0%, transparent 70%)' }}
                />

                <div className="text-3xl mb-4">{cat.icon}</div>

                <h2 className="text-lg font-bold text-obsidian-50 mb-2 group-hover:text-gold-400 transition-colors">
                  {cat.name}
                </h2>

                <p className="text-sm text-obsidian-400 leading-relaxed flex-1">
                  {cat.description}
                </p>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs text-obsidian-500 font-medium">
                    {cat.creator_count > 0
                      ? `${cat.creator_count.toLocaleString()} creators`
                      : 'Rankings live'}
                  </span>
                  <span className="text-gold-600 group-hover:text-gold-400 group-hover:translate-x-1 transition-all duration-200 text-lg leading-none">
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
