import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function GET(req: NextRequest) {
  const q     = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '6', 10), 20);

  if (q.length < 1) return NextResponse.json({ results: [] });

  const supabase = createServiceClient();

  const { data: creators, error } = await supabase
    .from('creators')
    .select('id, channel_name, profile_image_url, subscriber_count')
    .ilike('channel_name', `%${q}%`)
    .order('subscriber_count', { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!creators?.length) return NextResponse.json({ results: [] });

  const creatorIds = creators.map((c) => c.id);
  const { data: rankings } = await supabase
    .from('rankings')
    .select('creator_id, rank_position, rank_score')
    .in('creator_id', creatorIds)
    .eq('period', 'alltime')
    .is('category', null);

  const rankMap = Object.fromEntries(
    (rankings ?? []).map((r) => [r.creator_id, { rank_position: r.rank_position, rank_score: r.rank_score }]),
  );

  const results = creators.map((c) => ({
    id:                c.id,
    channel_name:      c.channel_name,
    profile_image_url: c.profile_image_url,
    rank_position:     rankMap[c.id]?.rank_position ?? null,
    rank_score:        rankMap[c.id]?.rank_score    ?? null,
  }));

  return NextResponse.json({ results });
}
