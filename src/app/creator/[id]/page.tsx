import { createServiceClient } from '@/lib/supabase/service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatCount } from '@/lib/format';

type Ranking  = { rank_position: number; rank_score: number; period: string };
type Category = { name: string; slug: string };

type Creator = {
  id: string;
  channel_name: string;
  description: string | null;
  profile_image_url: string | null;
  subscriber_count: number | null;
  view_count: number | null;
  video_count: number | null;
  country_code: string | null;
  language: string | null;
  primary_cat: Category | null;
  rankings: Ranking[];
};

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`border rounded p-5 ${highlight ? 'border-gold-300 bg-gold-50' : 'border-ink-200 bg-ink-100'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-2">{label}</p>
      <p className={`text-2xl font-black tabular-nums ${highlight ? 'text-gold-600' : 'text-ink-950'}`}>
        {value}
      </p>
    </div>
  );
}

export default async function CreatorPage({ params }: { params: { id: string } }) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('creators')
    .select(`
      id,
      channel_name,
      description,
      profile_image_url,
      subscriber_count,
      view_count,
      video_count,
      country_code,
      language,
      primary_cat:categories!primary_category (name, slug),
      rankings (rank_position, rank_score, period)
    `)
    .eq('id', params.id)
    .single();

  if (error || !data) notFound();

  const creator = data as unknown as Creator;
  const alltime = creator.rankings?.find((r) => r.period === 'alltime');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-24 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">

          {/* Breadcrumb */}
          <Link
            href="/rankings"
            className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-gold-600 transition-colors mb-10"
          >
            <span>&larr;</span> Back to Rankings
          </Link>

          {/* Profile header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-10 pb-10 border-b border-ink-200">
            {creator.profile_image_url ? (
              <Image
                src={creator.profile_image_url}
                alt={creator.channel_name}
                width={96}
                height={96}
                className="rounded-full w-24 h-24 object-cover border border-ink-200 flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-ink-100 border border-ink-200 flex items-center justify-center text-3xl font-black text-ink-400 flex-shrink-0">
                {creator.channel_name.charAt(0)}
              </div>
            )}

            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">
                {creator.channel_name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {creator.primary_cat && (
                  <Link
                    href={`/rankings/${creator.primary_cat.slug}`}
                    className="text-[11px] font-semibold uppercase tracking-widest text-gold-600 hover:text-gold-700 transition-colors border border-gold-300 bg-gold-50 rounded-full px-3 py-1"
                  >
                    {creator.primary_cat.name}
                  </Link>
                )}
                {creator.country_code && (
                  <span className="text-sm text-ink-400">{creator.country_code}</span>
                )}
                {creator.language && (
                  <span className="text-sm text-ink-400">{creator.language.toUpperCase()}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-10">
            {alltime && (
              <>
                <StatCard label="FameRank Score" value={Number(alltime.rank_score).toFixed(1)} highlight />
                <StatCard label="Global Rank"    value={`#${alltime.rank_position}`} />
              </>
            )}
            <StatCard label="Subscribers" value={formatCount(creator.subscriber_count)} />
            <StatCard label="Total Views"  value={formatCount(creator.view_count)} />
            <StatCard label="Videos"       value={formatCount(creator.video_count)} />
          </div>

          {/* Description */}
          {creator.description && (
            <div className="border-t border-ink-200 pt-8">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-ink-400 mb-4">
                About
              </h2>
              <p className="text-ink-600 leading-relaxed max-w-2xl line-clamp-6 font-light">
                {creator.description}
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
