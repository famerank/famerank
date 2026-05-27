/**
 * Automated creator discovery pipeline for FameRank.
 *
 * Usage:
 *   npm run discover:creators [-- --limit=50] [-- --min-subs=100000]
 *
 * For each of the 12 FameRank categories this script:
 *   1. Searches YouTube for top channels using category-specific queries
 *   2. Filters to channels with ≥ MIN_SUBSCRIBERS subscribers
 *   3. Takes the top LIMIT channels per category by subscriber count
 *   4. Upserts them into the creators table (with primary_category set)
 *   5. Recalculates global alltime rankings across all creators in the DB
 *
 * Safe to re-run — upserts on youtube_channel_id.
 * Designed to be scheduled weekly (see .github/workflows/discover-creators.yml).
 *
 * Quota cost (YouTube Data API v3, 10 000 units/day limit):
 *   search.list  = 100 units each  →  12 categories × 3 queries × 2 pages = 7 200 units
 *   channels.list = 1 unit each    →  ~36 batches of 50 channels            =    36 units
 *   Total ≈ 7 236 units  (within daily quota)
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name: string, fallback: number) => {
  const match = args.find((a) => a.startsWith(`--${name}=`));
  return match ? parseInt(match.split('=')[1], 10) : fallback;
};

const DISCOVERY_LIMIT  = getArg('limit',    50);
const MIN_SUBSCRIBERS  = getArg('min-subs', 100_000);
const PAGES_PER_QUERY  = 2;   // 2 × 50 results = 100 candidates per query
const MAX_PER_BATCH    = 50;  // channels.list max IDs per request
// YouTube allows 10 search.list calls/minute; 7 s gap keeps us safely under that
const SEARCH_DELAY_MS  = 7_000;

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── Category search queries ──────────────────────────────────────────────────
// Multiple queries per category to maximise channel diversity.
// order=viewCount surfaces the highest-traffic channels first.

const CATEGORY_QUERIES: Record<string, string[]> = {
  music:     ['top music artist youtube', 'best singer youtube channel', 'musician youtube'],
  fitness:   ['fitness workout youtube channel', 'personal trainer youtube', 'gym exercise youtube'],
  comedy:    ['comedy youtube channel', 'comedian funny videos', 'sketch comedy youtube'],
  beauty:    ['beauty makeup youtube channel', 'makeup tutorial youtube', 'skincare beauty guru'],
  fashion:   ['fashion style youtube channel', 'fashion influencer youtube', 'ootd style vlog'],
  food:      ['cooking food youtube channel', 'chef recipe youtube', 'food review mukbang'],
  gaming:    ['gaming youtube channel', 'lets play video games', 'game walkthrough youtube'],
  lifestyle: ['lifestyle vlog youtube', 'daily vlog channel', 'life advice youtube'],
  business:  ['business entrepreneur youtube', 'personal finance youtube', 'tech review youtube'],
  parenting: ['parenting family youtube channel', 'mom dad family vlog', 'kids family youtube'],
  sports:    ['sports youtube channel', 'athlete training youtube', 'sports highlights analysis'],
  travel:    ['travel vlog youtube channel', 'travel adventure youtube', 'travel destinations youtube'],
};

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

// ─── Score calculation (mirrors fetch-youtube-creators.ts) ───────────────────

function logNormalize(value: number, refMax: number): number {
  if (value <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(refMax + 1)) * 100, 100);
}

function calculateFameRankScore(subscribers: number, views: number, videos: number): number {
  const avgViews = videos > 0 ? views / videos : 0;
  return (
    logNormalize(subscribers, 200_000_000) * 0.40 +
    logNormalize(avgViews,    50_000_000)  * 0.30 +
    0                                      * 0.20 + // growth placeholder
    logNormalize(videos,      2_000)       * 0.10
  );
}

// ─── YouTube helpers ──────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchChannelIds(
  query: string,
  apiKey: string,
  pages: number,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set('part', 'id');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('q', query);
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('maxResults', String(MAX_PER_BATCH));
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    if (page > 0 || ids.length > 0) await sleep(SEARCH_DELAY_MS);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        // Back off and retry once
        console.warn(`  rate limit on "${query}" page ${page + 1} — waiting 60 s`);
        await sleep(60_000);
        const retry = await fetch(url.toString());
        if (!retry.ok) { console.warn(`  retry failed, skipping page`); break; }
        const retryData = await retry.json();
        const retryItems: SearchResult[] = retryData.items ?? [];
        ids.push(...retryItems.map((i) => i.id.channelId).filter(Boolean));
        pageToken = retryData.nextPageToken;
        if (!pageToken) break;
        continue;
      }
      console.warn(`  search warn [${query}] page ${page + 1}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const items: SearchResult[] = data.items ?? [];
    ids.push(...items.map((i) => i.id.channelId).filter(Boolean));

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}

async function fetchChannelStats(ids: string[], apiKey: string): Promise<YouTubeChannel[]> {
  const results: YouTubeChannel[] = [];

  for (let i = 0; i < ids.length; i += MAX_PER_BATCH) {
    const batch = ids.slice(i, i + MAX_PER_BATCH).join(',');
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${batch}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`YouTube channels API ${res.status}: ${JSON.stringify(body)}`);
    }

    const data = await res.json();
    results.push(...(data.items ?? []));
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey      = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey)      throw new Error('YOUTUBE_API_KEY is missing from .env.local');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`FameRank Creator Discovery`);
  console.log(`  limit=${DISCOVERY_LIMIT} per category  min-subs=${MIN_SUBSCRIBERS.toLocaleString()}\n`);

  // ── Fetch category UUIDs from DB ─────────────────────────────────────────
  const { data: categories, error: catErr } = await supabase
    .from('categories')
    .select('id, slug');

  if (catErr || !categories?.length) {
    throw new Error(`Failed to fetch categories: ${catErr?.message ?? 'no rows'}`);
  }

  const categoryIdBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // ── Phase 1: Discover + upsert creators per category ─────────────────────
  let totalNew       = 0;
  let totalUpdated   = 0;
  const seenChannels = new Set<string>(); // avoid duplicate work across categories

  for (const [slug, queries] of Object.entries(CATEGORY_QUERIES)) {
    const categoryId = categoryIdBySlug[slug];
    if (!categoryId) {
      console.warn(`SKIP category "${slug}" — not found in DB (run npm run seed:categories first)`);
      continue;
    }

    console.log(`\n─── ${slug.toUpperCase()} ─────────────────────────────────────`);

    // Collect candidate channel IDs from all queries
    const candidateIds = new Set<string>();
    for (let qi = 0; qi < queries.length; qi++) {
      if (qi > 0) await sleep(SEARCH_DELAY_MS);
      const ids = await searchChannelIds(queries[qi], apiKey, PAGES_PER_QUERY);
      ids.forEach((id) => candidateIds.add(id));
      process.stdout.write(`  search "${queries[qi]}" → ${ids.length} results\n`);
    }

    // Filter out channels already processed in an earlier category this run
    const newCandidates = [...candidateIds].filter((id) => !seenChannels.has(id));
    console.log(`  ${candidateIds.size} unique candidates (${newCandidates.length} not yet processed)`);

    if (newCandidates.length === 0) {
      console.log('  nothing new to process');
      continue;
    }

    // Fetch full stats
    const channels = await fetchChannelStats(newCandidates, apiKey);

    // Filter, sort by subscribers, take top DISCOVERY_LIMIT
    const qualifying = channels
      .filter((ch) => {
        const subs = parseInt(ch.statistics.subscriberCount ?? '0', 10);
        return subs >= MIN_SUBSCRIBERS && !ch.statistics.hiddenSubscriberCount;
      })
      .sort((a, b) => {
        const sa = parseInt(a.statistics.subscriberCount ?? '0', 10);
        const sb = parseInt(b.statistics.subscriberCount ?? '0', 10);
        return sb - sa;
      })
      .slice(0, DISCOVERY_LIMIT);

    console.log(`  ${qualifying.length} channels with ${(MIN_SUBSCRIBERS / 1000).toFixed(0)}k+ subs (from ${channels.length} fetched)`);

    // Upsert each qualifying channel
    let catNew = 0;
    let catUpdated = 0;

    for (const ch of qualifying) {
      seenChannels.add(ch.id);

      const subs   = parseInt(ch.statistics.subscriberCount ?? '0', 10);
      const views  = parseInt(ch.statistics.viewCount       ?? '0', 10);
      const videos = parseInt(ch.statistics.videoCount      ?? '0', 10);

      const { data: existing } = await supabase
        .from('creators')
        .select('id')
        .eq('youtube_channel_id', ch.id)
        .maybeSingle();

      const payload = {
        youtube_channel_id: ch.id,
        channel_name:       ch.snippet.title,
        description:        ch.snippet.description ?? null,
        profile_image_url:  ch.snippet.thumbnails.high?.url ?? ch.snippet.thumbnails.default?.url ?? null,
        subscriber_count:   subs,
        view_count:         views,
        video_count:        videos,
        country_code:       ch.snippet.country        ?? null,
        language:           ch.snippet.defaultLanguage ?? null,
        primary_category:   categoryId,
      };

      const { error: upsertErr } = await supabase
        .from('creators')
        .upsert(payload, { onConflict: 'youtube_channel_id' });

      if (upsertErr) {
        console.error(`  SKIP ${ch.snippet.title}: ${upsertErr.message}`);
        continue;
      }

      if (existing) { catUpdated++; } else { catNew++; }
    }

    totalNew     += catNew;
    totalUpdated += catUpdated;
    console.log(`  +${catNew} new  ~${catUpdated} updated`);
  }

  console.log(`\n─── Discovery complete ─────────────────────────────────────`);
  console.log(`  Total: +${totalNew} new creators, ~${totalUpdated} updated\n`);

  // ── Phase 2: Recalculate global alltime rankings for all creators ─────────
  console.log('Recalculating global alltime rankings…');

  const { data: allCreators, error: creatorsErr } = await supabase
    .from('creators')
    .select('id, channel_name, subscriber_count, view_count, video_count');

  if (creatorsErr || !allCreators) {
    throw new Error(`Failed to fetch creators for ranking: ${creatorsErr?.message}`);
  }

  type Scored = { id: string; name: string; score: number };
  const scored: Scored[] = allCreators.map((c) => ({
    id:    c.id,
    name:  c.channel_name,
    score: calculateFameRankScore(
      c.subscriber_count ?? 0,
      c.view_count       ?? 0,
      c.video_count      ?? 0,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Fetch existing rank positions to populate previous_rank_position
  const { data: existingRankings } = await supabase
    .from('rankings')
    .select('creator_id, rank_position')
    .eq('period', 'alltime')
    .is('category', null);

  const prevRankByCreator = Object.fromEntries(
    (existingRankings ?? []).map((r) => [r.creator_id, r.rank_position]),
  );

  // Delete all existing global alltime rows then bulk-insert
  await supabase
    .from('rankings')
    .delete()
    .eq('period', 'alltime')
    .is('category', null);

  const rankingRows = scored.map((c, i) => ({
    creator_id:             c.id,
    rank_score:             parseFloat(c.score.toFixed(4)),
    rank_position:          i + 1,
    previous_rank_position: prevRankByCreator[c.id] ?? null,
    period:                 'alltime' as const,
  }));

  // Insert in batches (Supabase recommends ≤1000 rows per insert)
  const INSERT_BATCH = 500;
  for (let i = 0; i < rankingRows.length; i += INSERT_BATCH) {
    const { error: rankErr } = await supabase
      .from('rankings')
      .insert(rankingRows.slice(i, i + INSERT_BATCH));

    if (rankErr) throw new Error(`Rankings insert failed: ${rankErr.message}`);
  }

  console.log(`  Ranked ${scored.length} creators`);
  console.log(`  #1  ${scored[0]?.name}  (${scored[0]?.score.toFixed(2)})`);
  console.log(`  #${scored.length}  ${scored[scored.length - 1]?.name}  (${scored[scored.length - 1]?.score.toFixed(2)})`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
