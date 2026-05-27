/**
 * Automated creator discovery pipeline for FameRank.
 *
 * Usage:
 *   npm run discover:creators                        # all categories
 *   npm run discover:creators -- --run=new           # only new P1+P2 categories
 *   npm run discover:creators -- --run=p1            # Priority 1 only
 *   npm run discover:creators -- --run=p2            # Priority 2 only
 *   npm run discover:creators -- --run=new --mega-sweep
 *   npm run discover:creators -- --limit=50 --min-subs=100000
 *
 * Stops gracefully if the YouTube daily quota is exhausted.
 * Reports which categories completed and which were skipped.
 *
 * Quota cost per full run (YouTube Data API v3, 10 000 units/day):
 *   search.list   = 100 units  →  25 cats × 3 queries × 2 pages = 15 000 units (spread over days)
 *   channels.list =   1 unit   →  ~60 batches of 50              =     60 units
 *   Per-category cost ≈ 600 units → P1 (6 cats) ≈ 3 600 units, P2 (7 cats) ≈ 4 200 units
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArgNum = (name: string, fallback: number) => {
  const m = args.find((a) => a.startsWith(`--${name}=`));
  return m ? parseInt(m.split('=')[1], 10) : fallback;
};
const getArgStr = (name: string, fallback: string) => {
  const m = args.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split('=')[1] : fallback;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

const DISCOVERY_LIMIT = getArgNum('limit',    50);
const MIN_SUBSCRIBERS = getArgNum('min-subs', 100_000);
const RUN_MODE        = getArgStr('run',      'all');  // all | new | p1 | p2
const MEGA_SWEEP      = hasFlag('mega-sweep');

const PAGES_PER_QUERY = 2;
const MAX_PER_BATCH   = 50;
const SEARCH_DELAY_MS = 7_000; // stay under 10 search.list calls/minute

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ─── Priority groupings ───────────────────────────────────────────────────────

const P1_SLUGS = [
  'technology', 'kids-family', 'news-politics',
  'science-education', 'cars-automotive', 'finance-investing',
] as const;

const P2_SLUGS = [
  'asmr', 'diy-home', 'nature-wildlife',
  'cooking-recipes', 'dance', 'mental-health', 'pets-animals',
] as const;

// ─── Category search queries ──────────────────────────────────────────────────

const CATEGORY_QUERIES: Record<string, string[]> = {
  // ── Original 12 ─────────────────────────────────────────────────────────
  music:             ['top music artist youtube', 'best singer youtube channel', 'musician youtube'],
  fitness:           ['fitness workout youtube channel', 'personal trainer youtube', 'gym exercise youtube'],
  comedy:            ['comedy youtube channel', 'comedian funny videos', 'sketch comedy youtube'],
  beauty:            ['beauty makeup youtube channel', 'makeup tutorial youtube', 'skincare beauty guru'],
  fashion:           ['fashion style youtube channel', 'fashion influencer youtube', 'ootd style vlog'],
  food:              ['food review youtube channel', 'mukbang eating youtube', 'street food youtube'],
  gaming:            ['gaming youtube channel', 'lets play video games', 'game walkthrough youtube'],
  lifestyle:         ['lifestyle vlog youtube', 'daily vlog channel', 'life advice youtube'],
  business:          ['business entrepreneur youtube', 'startup founder youtube', 'marketing youtube channel'],
  parenting:         ['parenting tips youtube', 'mom dad parenting vlog', 'raising kids youtube'],
  sports:            ['sports youtube channel', 'athlete training youtube', 'sports highlights analysis'],
  travel:            ['travel vlog youtube channel', 'travel adventure youtube', 'travel destinations youtube'],

  // ── Priority 1 ──────────────────────────────────────────────────────────
  technology:            ['tech review youtube channel', 'gadget unboxing youtube', 'smartphone technology youtube'],
  'kids-family':         ['kids youtube channel', 'children cartoon youtube', 'nursery rhymes youtube kids'],
  'news-politics':       ['news youtube channel', 'political commentary youtube', 'world news current events youtube'],
  'science-education':   ['science youtube channel', 'education learning youtube', 'science experiments youtube'],
  'cars-automotive':     ['car review youtube channel', 'automotive cars youtube', 'supercar review youtube'],
  'finance-investing':   ['investing finance youtube channel', 'stock market youtube', 'personal finance wealth youtube'],

  // ── Priority 2 ──────────────────────────────────────────────────────────
  asmr:              ['asmr youtube channel', 'asmr relaxation sounds', 'satisfying asmr tingles'],
  'diy-home':        ['diy home improvement youtube', 'home renovation projects youtube', 'crafts diy youtube channel'],
  'nature-wildlife': ['nature wildlife youtube channel', 'wild animals youtube', 'nature documentary youtube'],
  'cooking-recipes': ['recipe cooking tutorial youtube', 'baking recipes youtube channel', 'home cooking youtube'],
  dance:             ['dance tutorial youtube channel', 'choreography youtube', 'hip hop dance tutorial youtube'],
  'mental-health':   ['mental health youtube channel', 'anxiety mindfulness youtube', 'therapy wellness youtube'],
  'pets-animals':    ['pets animals youtube channel', 'dog training youtube', 'cute animals funny pets youtube'],
};

// ─── Mega sweep queries ───────────────────────────────────────────────────────
// Broad queries that surface mega-channels (CoComelon, etc.) not caught by
// category-specific searches. Channels are upserted without overwriting
// an existing primary_category assignment.

const MEGA_SWEEP_QUERIES = [
  'most subscribed youtube channel',
  'top entertainment youtube channel',
  'most popular youtube creators',
  'biggest youtube channel worldwide',
  'most viewed youtube channel ever',
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

async function searchChannelIds(query: string, apiKey: string, pages: number): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < pages; page++) {
    if (page > 0 || ids.length > 0) await sleep(SEARCH_DELAY_MS);

    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set('part', 'id');
    url.searchParams.set('type', 'channel');
    url.searchParams.set('q', query);
    url.searchParams.set('order', 'viewCount');
    url.searchParams.set('maxResults', String(MAX_PER_BATCH));
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const reason: string = body?.error?.errors?.[0]?.reason ?? '';

      if (res.status === 403 && (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded')) {
        throw new QuotaExhaustedError();
      }

      if (res.status === 429 || (res.status === 403 && reason === 'rateLimitExceeded')) {
        console.warn(`  rate limit on "${query}" page ${page + 1} — waiting 60 s`);
        await sleep(60_000);
        const retry = await fetch(url.toString());
        if (!retry.ok) {
          const rb = await retry.json().catch(() => ({}));
          const rr: string = rb?.error?.errors?.[0]?.reason ?? '';
          if (retry.status === 403 && (rr === 'quotaExceeded' || rr === 'dailyLimitExceeded')) {
            throw new QuotaExhaustedError();
          }
          console.warn(`  retry failed for "${query}" page ${page + 1}, skipping`);
          break;
        }
        const rd = await retry.json();
        (rd.items ?? []).forEach((i: SearchResult) => { if (i.id.channelId) ids.push(i.id.channelId); });
        pageToken = rd.nextPageToken;
        if (!pageToken) break;
        continue;
      }

      console.warn(`  search warn "${query}" page ${page + 1}: ${res.status} ${reason}`);
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
      const body = await res.json().catch(() => ({}));
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

// ─── Category processing ──────────────────────────────────────────────────────

async function processCategory(
  slug: string,
  queries: string[],
  categoryId: string | null,
  apiKey: string,
  supabase: ReturnType<typeof createClient>,
  seenChannels: Set<string>,
): Promise<{ newCount: number; updatedCount: number }> {
  const candidateIds = new Set<string>();

  for (let qi = 0; qi < queries.length; qi++) {
    if (qi > 0) await sleep(SEARCH_DELAY_MS);
    const ids = await searchChannelIds(queries[qi], apiKey, PAGES_PER_QUERY);
    ids.forEach((id) => candidateIds.add(id));
    process.stdout.write(`  search "${queries[qi]}" → ${ids.length} results\n`);
  }

  const newCandidates = Array.from(candidateIds).filter((id) => !seenChannels.has(id));
  console.log(`  ${candidateIds.size} unique candidates (${newCandidates.length} not yet processed this run)`);

  if (newCandidates.length === 0) {
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
    )
    .slice(0, DISCOVERY_LIMIT);

  console.log(
    `  ${qualifying.length} channels with ${(MIN_SUBSCRIBERS / 1_000).toFixed(0)}k+ subs` +
    ` (from ${channels.length} fetched)`,
  );

  let newCount = 0;
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

    // For mega sweep: don't overwrite an existing category assignment
    if (categoryId !== null) {
      payload.primary_category = categoryId;
    } else if (!existing?.primary_category) {
      payload.primary_category = null;
    }

    const { error: upsertErr } = await supabase
      .from('creators')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert(payload as any, { onConflict: 'youtube_channel_id' });

    if (upsertErr) {
      console.error(`  SKIP ${ch.snippet.title}: ${upsertErr.message}`);
      continue;
    }

    if (existing) { updatedCount++; } else { newCount++; }
  }

  return { newCount, updatedCount };
}

// ─── Ranking recalculation ────────────────────────────────────────────────────

async function recalculateRankings(supabase: ReturnType<typeof createClient>): Promise<number> {
  const { data: allCreators, error } = await supabase
    .from('creators')
    .select('id, channel_name, subscriber_count, view_count, video_count');

  if (error || !allCreators) throw new Error(`Failed to fetch creators: ${error?.message}`);

  type Scored = { id: string; name: string; score: number };
  const scored: Scored[] = allCreators
    .map((c) => ({
      id:    c.id,
      name:  c.channel_name,
      score: calculateFameRankScore(c.subscriber_count ?? 0, c.view_count ?? 0, c.video_count ?? 0),
    }))
    .sort((a, b) => b.score - a.score);

  const { data: existing } = await supabase
    .from('rankings')
    .select('creator_id, rank_position')
    .eq('period', 'alltime')
    .is('category', null);

  const prevRank = Object.fromEntries(
    (existing ?? []).map((r) => [r.creator_id, r.rank_position]),
  );

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

  if (!apiKey)      throw new Error('YOUTUBE_API_KEY is missing from .env.local');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('FameRank Creator Discovery');
  console.log(`  mode=${RUN_MODE}  limit=${DISCOVERY_LIMIT}  min-subs=${MIN_SUBSCRIBERS.toLocaleString()}  mega-sweep=${MEGA_SWEEP}\n`);

  const { data: categories, error: catErr } = await supabase.from('categories').select('id, slug');
  if (catErr || !categories?.length) {
    throw new Error(`Failed to fetch categories: ${catErr?.message ?? 'no rows — run seed:categories first'}`);
  }
  const categoryIdBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  // Determine which slugs to process based on --run mode
  let slugsToProcess: string[];
  if (RUN_MODE === 'p1')  slugsToProcess = [...P1_SLUGS];
  else if (RUN_MODE === 'p2')  slugsToProcess = [...P2_SLUGS];
  else if (RUN_MODE === 'new') slugsToProcess = [...P1_SLUGS, ...P2_SLUGS];
  else slugsToProcess = Object.keys(CATEGORY_QUERIES); // 'all'

  const completed: string[] = [];
  const skipped:   string[] = [];
  let totalNew = 0;
  let totalUpdated = 0;
  const seenChannels = new Set<string>();
  let quotaExhausted = false;

  // ── Phase 1: Category discovery ──────────────────────────────────────────
  for (const slug of slugsToProcess) {
    const queries    = CATEGORY_QUERIES[slug];
    const categoryId = categoryIdBySlug[slug] ?? null;

    if (!queries) { skipped.push(slug); continue; }
    if (!categoryId) {
      console.warn(`\nSKIP "${slug}" — not found in DB (run seed:categories first)`);
      skipped.push(slug);
      continue;
    }

    console.log(`\n─── ${slug.toUpperCase()} ─────────────────────────────────────`);

    try {
      const { newCount, updatedCount } = await processCategory(
        slug, queries, categoryId, apiKey, supabase, seenChannels,
      );
      totalNew     += newCount;
      totalUpdated += updatedCount;
      console.log(`  +${newCount} new  ~${updatedCount} updated`);
      completed.push(slug);
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        quotaExhausted = true;
        skipped.push(slug);
        // Skip remaining categories
        const remaining = slugsToProcess.slice(slugsToProcess.indexOf(slug) + 1);
        skipped.push(...remaining);
        break;
      }
      throw err;
    }
  }

  // ── Phase 2: Mega sweep ───────────────────────────────────────────────────
  if (MEGA_SWEEP && !quotaExhausted) {
    console.log('\n─── MEGA SWEEP (top channels across all categories) ────────');

    try {
      const { newCount, updatedCount } = await processCategory(
        'mega-sweep', MEGA_SWEEP_QUERIES, null, apiKey, supabase, seenChannels,
      );
      totalNew     += newCount;
      totalUpdated += updatedCount;
      console.log(`  +${newCount} new  ~${updatedCount} updated`);
      completed.push('mega-sweep');
    } catch (err) {
      if (err instanceof QuotaExhaustedError) {
        quotaExhausted = true;
        skipped.push('mega-sweep');
      } else {
        throw err;
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n─── Discovery complete ──────────────────────────────────────');
  if (quotaExhausted) {
    console.log('  ⚠ YouTube daily quota exhausted — stopped early');
  }
  console.log(`  Completed (${completed.length}): ${completed.join(', ') || 'none'}`);
  if (skipped.length) {
    console.log(`  Skipped   (${skipped.length}): ${skipped.join(', ')}`);
  }
  console.log(`  Total: +${totalNew} new creators, ~${totalUpdated} updated\n`);

  // ── Phase 3: Recalculate global rankings ─────────────────────────────────
  console.log('Recalculating global alltime rankings…');
  const rankedCount = await recalculateRankings(supabase);
  console.log(`  Ranked ${rankedCount} creators total`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
