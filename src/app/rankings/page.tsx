import { createServiceClient } from '@/lib/supabase/service';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Image from 'next/image';
import Link from 'next/link';
import { formatCount } from '@/lib/format';

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
    return <span className="text-[10px] font-bold text-gold-500 tracking-wider">NEW</span>;
  }
  const diff = previous - current;
  if (diff > 0) return <span className="text-[11px] font-semibold text-emerald-400">↑{diff}</span>;
  if (diff < 0) return <span className="text-[11px] font-semibold text-red-400">↓{Math.abs(diff)}</span>;
  return <span className="text-obsidian-600 text-sm">—</span>;
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
      creators (
        id,
        channel_name,
        profile_image_url,
        subscriber_count
      )
    `)
    .eq('period', 'alltime')
    .order('rank_position');

  const rows = (rankings ?? []) as unknown as RankingRow[];

  return (
    <div className="min-h-screen bg-obsidian-950 flex flex-col">
      <Header />

      <main className="flex-1 pt-28 pb-20 px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Page header */}
          <div className="mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-500 mb-3">
              All-Time Global
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-obsidian-50 tracking-tight">
              Creator Rankings
            </h1>
            <p className="mt-3 text-obsidian-400 max-w-xl">
              Ranked by FameRank score — weighted across subscribers, average views per video, and publishing consistency.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="border border-obsidian-800 rounded-sm p-12 text-center text-obsidian-500">
              No rankings data yet. Run{' '}
              <code className="text-gold-500 text-sm">npm run fetch:creators</code> to populate.
            </div>
          ) : (
            <div className="border border-obsidian-800 rounded-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-obsidian-800 bg-obsidian-900/60">
                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-obsidian-500 w-24">
                      Rank
                    </th>
                    <th className="px-5 py-4 text-left text-[10px] font-semibold uppercase tracking-widest text-obsidian-500">
                      Creator
                    </th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-obsidian-500 hidden sm:table-cell">
                      Subscribers
                    </th>
                    <th className="px-5 py-4 text-right text-[10px] font-semibold uppercase tracking-widest text-obsidian-500">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/40">
                  {rows.map((row) => {
                    const creator = row.creators;
                    if (!creator) return null;
                    return (
                      <tr
                        key={creator.id}
                        className="hover:bg-obsidian-900/40 transition-colors group"
                      >
                        {/* Rank */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base font-bold text-obsidian-200 w-5 text-right tabular-nums">
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
                                width={40}
                                height={40}
                                className="rounded-full w-10 h-10 object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-obsidian-800 flex items-center justify-center text-obsidian-400 font-bold flex-shrink-0">
                                {creator.channel_name.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-obsidian-100 group-hover:text-gold-400 transition-colors">
                              {creator.channel_name}
                            </span>
                          </Link>
                        </td>

                        {/* Subscribers */}
                        <td className="px-5 py-4 text-right text-obsidian-400 tabular-nums hidden sm:table-cell">
                          {formatCount(creator.subscriber_count)}
                        </td>

                        {/* Score */}
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-gold-400 font-bold tabular-nums">
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
