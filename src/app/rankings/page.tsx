import { createServiceClient } from '@/lib/supabase/service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Creator = {
  id: string;
  channel_name: string;
  profile_image_url: string | null;
  subscriber_count: number | null;
};

type RankingRow = {
  rank_position: number;
  previous_rank_position: number | null;
  rank_score: number;
  creators: Creator | null;
};

function RankChange({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) {
    return (
      <span className="text-[10px] font-bold text-gold-600 tracking-wider bg-gold-50 border border-gold-200 px-1.5 py-0.5 rounded-sm">
        NEW
      </span>
    );
  }
  const diff = previous - current;
  if (diff > 0) return <span className="text-[11px] font-semibold text-emerald-600">↑{diff}</span>;
  if (diff < 0) return <span className="text-[11px] font-semibold text-red-500">↓{Math.abs(diff)}</span>;
  return <span className="text-ink-300 text-sm">—</span>;
}

export const metadata = {
  title: 'Global Rankings — FameRank',
  description: 'The definitive all-time creator rankings, scored by subscribers, views, and consistency.',
};

export default async function RankingsPage() {
  const supabase = createServiceClient();

  const { data: rankings } = await supabase
    .from('rankings')
    .select(`
      rank_position,
      previous_rank_position,
      rank_score,
      creators!inner (
        id,
        channel_name,
        profile_image_url,
        subscriber_count
      )
    `)
    .eq('period', 'alltime')
    .eq('creators.is_human', true)
    .order('rank_position');

  const rows = (rankings ?? []) as unknown as RankingRow[];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-24 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Page header */}
          <div className="mb-12 pb-8 border-b border-ink-200">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 mb-3">
              All-Time Global
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-ink-950 tracking-tight">
              Creator Rankings
            </h1>
            <p className="mt-3 text-ink-500 font-light max-w-xl">
              Ranked by FameRank score — weighted across subscribers, average views per video, and publishing consistency.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="border border-ink-200 rounded p-12 text-center text-ink-400">
              No rankings data yet. Run{' '}
              <code className="text-gold-600 text-sm bg-ink-100 px-1.5 py-0.5 rounded">npm run fetch:creators</code> to populate.
            </div>
          ) : (
            <div className="border border-ink-200 rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-ink-100 border-b border-ink-200">
                    <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-400 w-28">
                      Rank
                    </th>
                    <th className="px-5 py-3.5 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                      Creator
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-400 hidden sm:table-cell">
                      Subscribers
                    </th>
                    <th className="px-5 py-3.5 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-400">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {rows.map((row) => {
                    const creator = row.creators;
                    if (!creator) return null;
                    return (
                      <tr
                        key={creator.id}
                        className="hover:bg-ink-100 transition-colors group"
                      >
                        {/* Rank */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-sm font-bold text-ink-700 w-6 text-right tabular-nums">
                              {row.rank_position}
                            </span>
                            <RankChange
                              current={row.rank_position}
                              previous={row.previous_rank_position}
                            />
                          </div>
                        </td>

                        {/* Creator */}
                        <td className="px-5 py-4">
                          <Link
                            href={`/creator/${creator.id}`}
                            className="flex items-center gap-3"
                          >
                            {creator.profile_image_url ? (
                              <Image
                                src={creator.profile_image_url}
                                alt={creator.channel_name}
                                width={36}
                                height={36}
                                className="rounded-full w-9 h-9 object-cover flex-shrink-0 border border-ink-200"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-ink-100 border border-ink-200 flex items-center justify-center text-ink-500 font-bold text-sm flex-shrink-0">
                                {creator.channel_name.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-ink-900 group-hover:text-gold-600 transition-colors text-sm">
                              {creator.channel_name}
                            </span>
                          </Link>
                        </td>

                        {/* Subscribers */}
                        <td className="px-5 py-4 text-right text-ink-400 tabular-nums text-sm hidden sm:table-cell">
                          {formatCount(creator.subscriber_count)}
                        </td>

                        {/* Score */}
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-gold-600 font-bold tabular-nums text-sm">
                            {Number(row.rank_score).toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
