/**
 * Fetches YouTube channel data and upserts it into the FameRank database.
 *
 * Usage:
 *   npm run fetch:creators -- UCxxxxxx UCyyyyyy ...
 *
 * Requires YOUTUBE_API_KEY and Supabase vars in .env.local.
 * Use SUPABASE_SERVICE_ROLE_KEY for write access when RLS is enabled.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const MAX_PER_REQUEST = 50;

// ─── Score calculation ────────────────────────────────────────────────────────

/**
 * Log-normalise a value to 0–100 against a reference maximum.
 * Using log scale because subscriber/view counts span many orders of magnitude.
 */
function logNormalize(value: number, refMax: number): number {
  if (value <= 0) return 0;
  return Math.min((Math.log10(value + 1) / Math.log10(refMax + 1)) * 100, 100);
}

function calculateFameRankScore(subscriberCount: number, viewCount: number, videoCount: number): number {
  const avgViewsPerVideo = videoCount > 0 ? viewCount / videoCount : 0;

  const subscriberScore  = logNormalize(subscriberCount, 200_000_000); // 200 M benchmark
  const avgViewsScore    = logNormalize(avgViewsPerVideo, 50_000_000);  // 50 M benchmark
  const growthScore      = 0;                                           // placeholder
  const consistencyScore = logNormalize(videoCount, 2_000);             // 2 000 video benchmark

  return (
    subscriberScore  * 0.40 +
    avgViewsScore    * 0.30 +
    growthScore      * 0.20 +
    consistencyScore * 0.10
  );
}

// ─── YouTube API ──────────────────────────────────────────────────────────────

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

async function fetchChannels(ids: string[], apiKey: string): Promise<YouTubeChannel[]> {
  const results: YouTubeChannel[] = [];

  for (let i = 0; i < ids.length; i += MAX_PER_REQUEST) {
    const batch = ids.slice(i, i + MAX_PER_REQUEST).join(',');
    const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${batch}&key=${apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`YouTube API ${res.status}: ${JSON.stringify(body)}`);
    }

    const data = await res.json();
    results.push(...(data.items ?? []));
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const channelIds = process.argv.slice(2);
  if (channelIds.length === 0) {
    console.error('Usage: npm run fetch:creators -- <channelId1> <channelId2> ...');
    process.exit(1);
  }

  const apiKey      = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer service role key so writes succeed even when RLS is on
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!apiKey)      throw new Error('YOUTUBE_API_KEY is missing from .env.local');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Fetching ${channelIds.length} channel(s) from YouTube…`);
  const channels = await fetchChannels(channelIds, apiKey);
  console.log(`Retrieved ${channels.length} channel(s)\n`);

  if (channels.length === 0) {
    console.log('No valid channels returned. Check the channel IDs and try again.');
    return;
  }

  // ── Pass 1: upsert all creators ─────────────────────────────────────────────
  type ScoredCreator = { id: string; name: string; score: number };
  const scored: ScoredCreator[] = [];

  for (const ch of channels) {
    const { snippet, statistics } = ch;
    const subscriberCount = parseInt(statistics.subscriberCount ?? '0', 10);
    const viewCount       = parseInt(statistics.viewCount       ?? '0', 10);
    const videoCount      = parseInt(statistics.videoCount      ?? '0', 10);

    const { data: creator, error: creatorErr } = await supabase
      .from('creators')
      .upsert(
        {
          youtube_channel_id: ch.id,
          channel_name:       snippet.title,
          description:        snippet.description ?? null,
          profile_image_url:  snippet.thumbnails.high?.url ?? snippet.thumbnails.default?.url ?? null,
          subscriber_count:   subscriberCount,
          view_count:         viewCount,
          video_count:        videoCount,
          country_code:       snippet.country        ?? null,
          language:           snippet.defaultLanguage ?? null,
        },
        { onConflict: 'youtube_channel_id' }
      )
      .select('id')
      .single();

    if (creatorErr || !creator) {
      console.error(`  SKIP ${snippet.title}: ${creatorErr?.message}`);
      continue;
    }

    scored.push({
      id:    creator.id,
      name:  snippet.title,
      score: calculateFameRankScore(subscriberCount, viewCount, videoCount),
    });
  }

  // ── Pass 2: assign rank positions by score, then upsert rankings ────────────
  // Sort descending so rank 1 = highest score
  scored.sort((a, b) => b.score - a.score);

  for (let i = 0; i < scored.length; i++) {
    const { id, name, score } = scored[i];
    const rankPosition = i + 1;

    // Fetch previous rank before overwriting
    const { data: existing } = await supabase
      .from('rankings')
      .select('rank_position')
      .match({ creator_id: id, period: 'alltime' })
      .maybeSingle();

    await supabase.from('rankings').delete().match({ creator_id: id, period: 'alltime' });

    const { error: rankErr } = await supabase.from('rankings').insert({
      creator_id:             id,
      rank_score:             parseFloat(score.toFixed(4)),
      rank_position:          rankPosition,
      previous_rank_position: existing?.rank_position ?? null,
      period:                 'alltime',
    });

    if (rankErr) {
      console.error(`  WARN ranking for ${name}: ${rankErr.message}`);
    } else {
      console.log(`  #${String(rankPosition).padEnd(3)} ${name.padEnd(40)} score: ${score.toFixed(2)}`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
