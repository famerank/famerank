/**
 * FameRank Rankings Rebuild
 *
 * 1. Deletes all rankings rows for creators where is_human = false.
 * 2. Re-sequences rank_position (1, 2, 3…) by rank_score DESC so there are no gaps.
 *    previous_rank_position is set to the old position so the change indicator still works.
 *
 * Usage:
 *   npm run rebuild:rankings              # dry run
 *   npm run rebuild:rankings -- --apply   # make changes
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\nFameRank Rankings Rebuild — ${APPLY ? '⚡ APPLY MODE' : '🔍 DRY RUN (no changes)'}\n`);

  // ── Step 1: find non-human creator IDs ────────────────────────────────────
  const { data: nonHuman, error: nhErr } = await supabase
    .from('creators')
    .select('id, channel_name')
    .eq('is_human', false);

  if (nhErr) throw new Error(`Failed to fetch non-human creators: ${nhErr.message}`);

  const nonHumanIds = (nonHuman ?? []).map((c) => c.id);
  console.log(`Non-human creators : ${nonHumanIds.length}`);

  // Count their rankings rows
  const { count: nhRankCount } = await supabase
    .from('rankings')
    .select('id', { count: 'exact', head: true })
    .in('creator_id', nonHumanIds);

  console.log(`Rankings to delete : ${nhRankCount ?? 0}`);

  // ── Step 2: fetch remaining rankings ordered by score ─────────────────────
  // Fetch ALL existing alltime rows so we can preview / apply the renumbering.
  const { data: allRankings, error: rErr } = await supabase
    .from('rankings')
    .select('id, creator_id, rank_position, rank_score, period')
    .eq('period', 'alltime')
    .not('creator_id', 'in', `(${nonHumanIds.join(',')})`)
    .order('rank_score', { ascending: false });

  if (rErr) throw new Error(`Failed to fetch rankings: ${rErr.message}`);

  const humanRankings = allRankings ?? [];
  console.log(`Human rankings     : ${humanRankings.length}\n`);

  // Preview: show first 20 new positions
  console.log('─── Preview: new positions (top 20) ─────────────────────────────────────────');
  for (let i = 0; i < Math.min(20, humanRankings.length); i++) {
    const r = humanRankings[i];
    const newPos = i + 1;
    const moved = r.rank_position !== newPos ? ` (was #${r.rank_position})` : '';
    console.log(`  #${String(newPos).padEnd(3)} score ${Number(r.rank_score).toFixed(2)}${moved}`);
  }

  if (!APPLY) {
    console.log(`\n  ─ Dry run complete. Run with --apply to commit changes. ─\n`);
    console.log(`  npm run rebuild:rankings -- --apply\n`);
    return;
  }

  // ── Apply: delete non-human rankings ──────────────────────────────────────
  if (nonHumanIds.length > 0) {
    process.stdout.write('\nDeleting non-human rankings… ');
    const { error: delErr } = await supabase
      .from('rankings')
      .delete()
      .in('creator_id', nonHumanIds);

    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
    console.log('done.');
  }

  // ── Apply: renumber remaining rankings ────────────────────────────────────
  console.log(`Renumbering ${humanRankings.length} rankings…`);
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < humanRankings.length; i++) {
    const r = humanRankings[i];
    const newPos = i + 1;

    const { error: updErr } = await supabase
      .from('rankings')
      .update({
        rank_position:          newPos,
        previous_rank_position: r.rank_position, // old position becomes "previous"
      })
      .eq('id', r.id);

    if (updErr) {
      console.error(`  FAIL id=${r.id}: ${updErr.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  console.log(`\n  Renumbered : ${ok}`);
  if (fail) console.log(`  Errors     : ${fail}`);
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
