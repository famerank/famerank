/**
 * Targeted Creator Discovery Sweep
 *
 * Fills demographic and topical gaps in the creator database using focused
 * search terms. Operates as a mega-sweep: upserts channel data without
 * overwriting existing primary_category assignments.
 *
 * Usage:
 *   npm run sweep:targeted
 *
 * Quota estimate (YouTube Data API v3 — 10,000 units/day):
 *   13 groups × 2 queries × 2 pages × 100 units = 5,200 search units
 *   + ~60 units for channels.list batches
 *   Total ≈ 5,260 units  (~half the daily quota)
 *
 * After this sweep, re-run the human filter on new creators:
 *   npm run filter:creators -- --apply
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateBio } from './lib/generate-bio';

// ─── Config ───────────────────────────────────────────────────────────────────

const MIN_SUBSCRIBERS  = 100_000;
const PAGES_PER_QUERY  = 2;
const MAX_PER_BATCH    = 50;
const SEARCH_DELAY_MS  = 7_000; // stay under 10 search.list calls/minute
const BIO_DELAY_MS     = 350;
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── Sweep groups ─────────────────────────────────────────────────────────────
// Each group runs 2 query variants to maximise result diversity.
// Groups are ordered so quota-limited runs still cover the most valuable ones.

const SWEEP_GROUPS: Array<{ label: string; queries: string[] }> = [
  {
    label:   'Female Creators',
    queries: ['top female YouTubers', 'best women content creators YouTube'],
  },
  {
    label:   'UK Creators',
    queries: ['top UK YouTubers', 'best British YouTubers'],
  },
  {
    label:   'Beauty',
    queries: ['top beauty YouTubers', 'best beauty vloggers YouTube'],
  },
  {
    label:   'Baking',
    queries: ['top baking YouTubers', 'best baking channel YouTube'],
  },
  {
    label:   'Podcasts',
    queries: ['top podcast YouTubers', 'most popular podcast YouTube channel'],
  },
  {
    label:   'Self Development',
    queries: ['top self development YouTubers', 'personal growth mindset YouTube'],
  },
  {
    label:   'Comedy UK',
    queries: ['top comedy YouTubers UK', 'British comedy YouTube channel'],
  },
  {
    label:   'Gaming',
    queries: ['top gaming YouTubers', 'best gaming YouTube channel'],
  },
  {
    label:   'Finance',
    queries: ['top finance YouTubers', 'best personal finance money YouTube'],
  },
  {
    label:   'Food',
    queries: ['top food YouTubers', 'best food vlog YouTube channel'],
  },
  {
    label:   'Travel',
    queries: ['top travel vloggers', 'best travel YouTube channel'],
  },
  {
    label:   'Female Fitness',
    queries: ['top fitness female YouTubers', 'women workout fitness YouTube'],
  },
  {
    label:   'News Commentary',
    queries: ['top news commentary YouTubers', 'political commentary analysis YouTube'],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    country?: string;
    defaultLanguage?: string;
    thumbnails: { high?: { url: string }; default?: { url: string } };
  };
  statistics: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

interface SearchResult {
  id: { channelId: string };
}

class QuotaExhaustedError extends Error {
  constructor() { super('YouTube API daily quota exhausted'); }
}

// ─── Helpers (mirrors discover-creators.ts) ───────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchChannelIds(query: string, apiKey: string, pages: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    if (page > 0 || ids.length > 0) await sleep(SEARCH_DELAY_MS);

    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set('part',       'id');
    url.searchParams.set('type',       'channel');
    url.searchParams.set('q',          query);
    url.searchParams.set('order',      'viewCount');
    url.searchParams.set('maxResults', String(MAX_PER_BATCH));
    url.searchParams.set('key',        apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body   = await res.json().catch(() => ({}));
      const reason: string = body?.error?.errors?.[0]?.reason ?? '';

      if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
        throw new QuotaExhaustedError();
      }
      if (res.status === 429 || (res.status === 403 && reason === 'rateLimitExceeded')) {
        console.warn(`  rate limit on "${query}" p${page + 1} — waiting 60 s`);
        await sleep(60_000);
        const retry = await fetch(url.toString());
        if (!retry.ok) {
          const rb = await retry.json().catch(() => ({}));
          const rr: string = rb?.error?.errors?.[0]?.reason ?? '';
          if (retry.status === 403 && (rr === 'quotaExceeded' || rr === 'dailyLimitExceeded')) {
            throw new QuotaExhaustedError();
          }
          console.warn(`  retry failed for "${query}" p${page + 1}, skipping`);
          break;
        }
        const rd = await retry.json();
        (rd.items ?? []).forEach((i: SearchResult) => { if (i.id.channelId) ids.push(i.id.channelId); });
        pageToken = rd.nextPageToken;
        if (!pageToken) break;
        continue;
      }
      console.warn(`  search warn "${query}" p${page + 1}: ${res.status} ${reason}`);
      break;
    }

    const data = await res.json();
    (data.items ?? []).forEach((i: SearchResult) => { if (i.id.channelId) ids.push(i.id.channelId); });
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}

async function fetchChannelStats(ids: string[], apiKey: string): Promise<YouTubeChannel[]> {
  const results: YouTubeChannel[] = [];
  for (let i = 0; i < ids.length; i += MAX_PER_BATCH) {
    const batch = ids.slice(i, i + MAX_PER_BATCH).join(',');
    const res = await fetch(
      `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${batch}&key=${apiKey}`,
    );
    if (!res.ok) {
      const body   = await res.json().catch(() => ({}));
      const reason: string = body?.error?.errors?.[0]?.reason ?? '';
      if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
        throw new QuotaExhaustedError();
      }
      throw new Error(`YouTube channels API ${res.status}: ${JSON.stringify(body)}`);
    }
    const data = await res.json();
    results.push(...(data.items ?? []));
  }
  return results;
}

// ─── Group processing ─────────────────────────────────────────────────────────

async function processGroup(
  label:        string,
  queries:      string[],
  apiKey:       string,
  supabase:     ReturnType<typeof createClient>,
  seenChannels: Set<string>,
): Promise<{ newCount: number; updatedCount: number }> {
  const candidateIds = new Set<string>();

  for (let qi = 0; qi < queries.length; qi++) {
    if (qi > 0 || seenChannels.size > 0) await sleep(SEARCH_DELAY_MS);
    const ids = await searchChannelIds(queries[qi], apiKey, PAGES_PER_QUERY);
    ids.forEach((id) => candidateIds.add(id));
    process.stdout.write(`  search "${queries[qi]}" → ${ids.length} results\n`);
  }

  const newCandidates = Array.from(candidateIds).filter((id) => !seenChannels.has(id));
  console.log(`  ${candidateIds.size} unique candidates (${newCandidates.length} not yet seen this run)`);

  if (!newCandidates.length) {
    console.log('  nothing new to process');
    return { newCount: 0, updatedCount: 0 };
  }

  const channels = await fetchChannelStats(newCandidates, apiKey);

  const qualifying = channels
    .filter((ch) => {
      const subs = parseInt(ch.statistics.subscriberCount ?? '0', 10);
      return subs >= MIN_SUBSCRIBERS && !ch.statistics.hiddenSubscriberCount;
    })
    .sort((a, b) =>
      parseInt(b.statistics.subscriberCount ?? '0', 10) -
      parseInt(a.statistics.subscriberCount ?? '0', 10),
    );

  console.log(
    `  ${qualifying.length} channels with ${(MIN_SUBSCRIBERS / 1_000).toFixed(0)}k+ subs` +
    ` (from ${channels.length} fetched)`,
  );

  let newCount     = 0;
  let updatedCount = 0;

  for (const ch of qualifying) {
    seenChannels.add(ch.id);

    const subs   = parseInt(ch.statistics.subscriberCount ?? '0', 10);
    const views  = parseInt(ch.statistics.viewCount       ?? '0', 10);
    const videos = parseInt(ch.statistics.videoCount      ?? '0', 10);

    const { data: existingRaw } = await supabase
      .from('creators')
      .select('id, primary_category')
      .eq('youtube_channel_id', ch.id)
      .maybeSingle();
    const existing = existingRaw as { id: string; primary_category: string | null } | null;

    const payload: Record<string, unknown> = {
      youtube_channel_id: ch.id,
      channel_name:       ch.snippet.title,
      description:        ch.snippet.description ?? null,
      profile_image_url:  ch.snippet.thumbnails.high?.url ?? ch.snippet.thumbnails.default?.url ?? null,
      subscriber_count:   subs,
      view_count:         views,
      video_count:        videos,
      country_code:       ch.snippet.country         ?? null,
      language:           ch.snippet.defaultLanguage ?? null,
    };

    // Mega-sweep: never overwrite an existing primary_category assignment
    if (!existing?.primary_category) {
      payload.primary_category = null;
    }

    const { data: upsertData, error: upsertErr } = await supabase
      .from('creators')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: 'youtube_channel_id' })
      .select('id')
      .single();

    if (upsertErr) {
      console.error(`  SKIP ${ch.snippet.title}: ${upsertErr.message}`);
      continue;
    }

    if (existing) {
      updatedCount++;
    } else {
      newCount++;
      if (process.env.ANTHROPIC_API_KEY && upsertData?.id) {
        await sleep(BIO_DELAY_MS);
        const bio = await generateBio(ch.snippet.title, ch.snippet.description ?? null);
        if (bio) {
          await supabase.from('creators').update({ generated_bio: bio }).eq('id', upsertData.id);
        }
      }
    }
  }

  return { newCount, updatedCount };
}

// ─── Ranking recalculation ────────────────────────────────────────────────────

async function recalculateRankings(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data: allCreators, error } = await supabase
    .from('creators')
    .select('id, channel_name, subscriber_count, view_count, video_count');

  if (error || !allCreators) throw new Error(`Failed to fetch creators: ${error?.message}`);

  const scored = allCreators
    .map((c) => {
      const subs  = c.subscriber_count ?? 0;
      const views = c.view_count       ?? 0;
      const vids  = c.video_count      ?? 0;
      const avg   = vids > 0 ? views / vids : 0;
      const score =
        Math.min((Math.log10(subs  + 1) / Math.log10(200_000_001)) * 100, 100) * 0.40 +
        Math.min((Math.log10(avg   + 1) / Math.log10( 50_000_001)) * 100, 100) * 0.30 +
        Math.min((Math.log10(vids  + 1) / Math.log10(      2_001)) * 100, 100) * 0.10;
      return { id: c.id, score };
    })
    .sort((a, b) => b.score - a.score);

  const { data: existing } = await supabase
    .from('rankings')
    .select('creator_id, rank_position')
    .eq('period', 'alltime')
    .is('category', null);

  const prevRank = Object.fromEntries((existing ?? []).map((r) => [r.creator_id, r.rank_position]));

  await supabase.from('rankings').delete().eq('period', 'alltime').is('category', null);

  const rows = scored.map((c, i) => ({
    creator_id:             c.id,
    rank_score:             parseFloat(c.score.toFixed(4)),
    rank_position:          i + 1,
    previous_rank_position: prevRank[c.id] ?? null,
    period:                 'alltime' as const,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const { error: rankErr } = await supabase.from('rankings').insert(rows.slice(i, i + 500));
    if (rankErr) throw new Error(`Rankings insert failed: ${rankErr.message}`);
  }

  return scored.length;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey      = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey)      throw new Error('YOUTUBE_API_KEY missing from .env.local');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\nFameRank Targeted Creator Sweep');
  console.log(`  ${SWEEP_GROUPS.length} groups · ${SWEEP_GROUPS.reduce((n, g) => n + g.queries.length, 0)} queries · min-subs=${MIN_SUBSCRIBERS.toLocaleString()}\n`);

  const seenChannels   = new Set<string>();
  const completed:     string[] = [];
  const skipped:       string[] = [];
  const groupResults:  Array<{ label: string; newCount: number; updatedCount: number }> = [];
  let   totalNew     = 0;
  let   totalUpdated = 0;
  let   quotaHit     = false;

  for (const group of SWEEP_GROUPS) {
    console.log(`\n─── ${group.label.toUpperCase()} ${'─'.repeat(Math.max(0, 52 - group.label.length))}`);

    try {
      const { newCount, updatedCount } = await processGroup(
        group.label, group.queries, apiKey, supabase, seenChannels,
      );
      totalNew     += newCount;
      totalUpdated += updatedCount;
      groupResults.push({ label: group.label, newCount, updatedCount });
      console.log(`  +${newCount} new  ~${updatedCount} updated`);
      completed.push(group.label);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        quotaHit = true;
        const remaining = SWEEP_GROUPS.slice(SWEEP_GROUPS.indexOf(group) + 1).map((g) => g.label);
        skipped.push(group.label, ...remaining);
        console.warn('\n  ⚠ YouTube daily quota exhausted — stopping early');
        break;
      }
      throw err;
    }
  }

  // ── Per-group summary ──────────────────────────────────────────────────────
  console.log('\n─── Results per group ───────────────────────────────────────────────────────');
  for (const { label, newCount, updatedCount } of groupResults) {
    const newStr  = newCount     > 0 ? `+${newCount} new`      : '  0 new';
    const updStr  = updatedCount > 0 ? `~${updatedCount} upd`  : '';
    console.log(`  ${label.padEnd(22)} ${newStr.padEnd(12)} ${updStr}`);
  }

  console.log('\n─── Overall summary ─────────────────────────────────────────────────────────');
  if (quotaHit) console.log('  ⚠ Stopped early — quota exhausted');
  console.log(`  Groups completed : ${completed.length} / ${SWEEP_GROUPS.length}`);
  if (skipped.length) console.log(`  Groups skipped   : ${skipped.join(', ')}`);
  console.log(`  New creators     : +${totalNew}`);
  console.log(`  Updated          : ~${totalUpdated}`);

  // ── Recalculate global rankings ────────────────────────────────────────────
  console.log('\nRecalculating global alltime rankings…');
  const rankedCount = await recalculateRankings(supabase);
  console.log(`  Ranked ${rankedCount} creators total`);

  if (totalNew > 0) {
    console.log(`\n  Tip: re-run the human filter to catch any non-human channels in new additions:`);
    console.log(`    npm run filter:creators -- --apply\n`);
  } else {
    console.log('');
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
