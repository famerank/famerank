import { createServiceClient } from '@/lib/supabase/service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { formatCount } from '@/lib/format';

type SearchResult = {
  id:                string;
  channel_name:      string;
  profile_image_url: string | null;
  subscriber_count:  number | null;
  rank_position:     number | null;
  rank_score:        number | null;
};

export function generateMetadata({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q?.trim() ?? '';
  return {
    title: q ? `"${q}" — FameRank Search` : 'Search — FameRank',
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q?.trim() ?? '';
  let results: SearchResult[] = [];

  if (query.length >= 1) {
    const supabase = createServiceClient();

    const { data: creators } = await supabase
      .from('creators')
      .select('id, channel_name, profile_image_url, subscriber_count')
      .eq('is_human', true)
      .ilike('channel_name', `%${query}%`)
      .order('subscriber_count', { ascending: false })
      .limit(50);

    if (creators?.length) {
      const ids = creators.map((c) => c.id);
      const { data: rankings } = await supabase
        .from('rankings')
        .select('creator_id, rank_position, rank_score')
        .in('creator_id', ids)
        .eq('period', 'alltime')
        .is('category', null);

      const rankMap = Object.fromEntries(
        (rankings ?? []).map((r) => [r.creator_id, r]),
      );

      results = creators.map((c) => ({
        id:                c.id,
        channel_name:      c.channel_name,
        profile_image_url: c.profile_image_url,
        subscriber_count:  c.subscriber_count,
        rank_position:     rankMap[c.id]?.rank_position ?? null,
        rank_score:        rankMap[c.id]?.rank_score    ?? null,
      }));

      results.sort((a, b) => {
        if (a.rank_position == null && b.rank_position == null) return 0;
        if (a.rank_position == null) return 1;
        if (b.rank_position == null) return -1;
        return a.rank_position - b.rank_position;
      });
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-24 px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">

          {/* Page header */}
          <div className="mb-10 pb-8 border-b border-ink-200">
            {query ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 mb-3">
                  Search Results
                </p>
                <h1 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">
                  &ldquo;{query}&rdquo;
                </h1>
                <p className="mt-3 text-ink-400 font-light">
                  {results.length > 0
                    ? `${results.length} creator${results.length === 1 ? '' : 's'} found`
                    : 'No creators found'}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-4xl font-black text-ink-950 tracking-tight">Search</h1>
                <p className="mt-3 text-ink-400 font-light">Search for creators by name.</p>
              </>
            )}
          </div>

          {/* Results list */}
          {results.length > 0 ? (
            <div className="border border-ink-200 rounded overflow-hidden">
              {results.map((r) => (
                <Link
                  key={r.id}
                  href={`/creator/${r.id}`}
                  className="flex items-center gap-4 px-5 py-4 border-b border-ink-100 last:border-b-0 hover:bg-ink-50 transition-colors group"
                >
                  {/* Rank number */}
                  {r.rank_position != null && (
                    <span className="flex-shrink-0 w-8 text-right text-sm font-bold text-ink-300 tabular-nums">
                      {r.rank_position}
                    </span>
                  )}

                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-ink-200 bg-ink-100">
                    {r.profile_image_url ? (
                      <Image
                        src={r.profile_image_url}
                        alt={r.channel_name}
                        width={44}
                        height={44}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-bold text-ink-400">
                        {r.channel_name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Name + subscribers */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-ink-950 group-hover:text-gold-600 transition-colors truncate">
                      {r.channel_name}
                    </p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {formatCount(r.subscriber_count)} subscribers
                    </p>
                  </div>

                  {/* Score */}
                  {r.rank_score != null && (
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-300 mb-0.5">Score</p>
                      <span className="font-mono font-bold text-gold-600 text-sm tabular-nums">
                        {Number(r.rank_score).toFixed(1)}
                      </span>
                    </div>
                  )}

                  <svg
                    className="w-4 h-4 text-ink-300 flex-shrink-0"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          ) : query ? (
            <div className="border border-ink-200 rounded p-12 text-center">
              <p className="text-ink-400 font-light">
                No creators found for &ldquo;{query}&rdquo;. Try a different name.
              </p>
              <Link
                href="/rankings"
                className="inline-block mt-5 text-sm font-medium text-gold-600 hover:text-gold-500 transition-colors"
              >
                Browse all rankings →
              </Link>
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
}
