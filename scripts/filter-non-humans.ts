/**
 * FameRank Human Creator Filter
 *
 * Scans all creators against three rules and either prints a dry-run report
 * or writes is_human = false to flagged rows.
 *
 * Usage:
 *   npm run filter:creators              # dry run — shows what would be flagged
 *   npm run filter:creators -- --apply   # writes changes to the database
 *
 * Prerequisite for --apply:
 *   Run supabase/migrations/20260528000001_add_is_human.sql in the Supabase dashboard first.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

// ─── Rule 1 — Name patterns ───────────────────────────────────────────────────
// Word-boundary regex so "Music" doesn't flag "Musical Ly" but does flag "XYZ Music"

const NAME_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /nursery/i,                 label: 'Nursery' },
  { re: /\brhymes\b/i,              label: 'Rhymes' },
  { re: /\bsongs\b/i,               label: 'Songs' },
  { re: /animation/i,               label: 'Animation' },
  { re: /cartoon/i,                 label: 'Cartoon' },
  { re: /\bstudios?\b/i,            label: 'Studio(s)' },
  { re: /\bnetwork\b/i,             label: 'Network' },
  { re: /\bofficial\b/i,            label: 'Official' },
  { re: /\btv\b/i,                  label: 'TV' },
  { re: /\bnews\b/i,                label: 'News' },
  { re: /\bmedia\b/i,               label: 'Media' },
  { re: /\bentertainment\b/i,       label: 'Entertainment' },
  { re: /\bmusic\b/i,               label: 'Music' },
  { re: /\bfilms?\b/i,              label: 'Film(s)' },
  { re: /productions?/i,            label: 'Production(s)' },
  { re: /\brecords\b/i,             label: 'Records' },
];

// ─── Rule 2 — Known non-human channels (blocklist) ───────────────────────────

const BLOCKLIST = [
  'Little Treehouse',
  'CoComelon',
  'Cocomelon',
  'Little Baby Bum',
  'Blippi',
  'T-Series',
  'SET India',
  'WWE',
  'NBA',
  'NFL',
  'Bright Side',
  '5-Minute Crafts',
  'BRIGHT SIDE',
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Creator {
  id:               string;
  channel_name:     string;
  description:      string | null;
  country_code:     string | null;
  subscriber_count: number | null;
}

// ─── Flagging logic ───────────────────────────────────────────────────────────

function checkCreator(c: Creator): string[] {
  const reasons: string[] = [];
  const name = c.channel_name;

  // Rule 1
  const matched = NAME_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (matched.length) {
    reasons.push(`Rule 1 (name pattern): ${matched.join(', ')}`);
  }

  // Rule 2
  const blockMatch = BLOCKLIST.find(
    (b) => name.toLowerCase() === b.toLowerCase() || name.toLowerCase().startsWith(b.toLowerCase() + ' '),
  );
  if (blockMatch) {
    reasons.push(`Rule 2 (blocklist): "${blockMatch}"`);
  }

  // Rule 3 — No country code AND no description
  if (!c.country_code && (!c.description || c.description.trim().length === 0)) {
    reasons.push('Rule 3: No country code and no description');
  }

  return reasons;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\nFameRank Human Creator Filter — ${APPLY ? '⚡ APPLY MODE' : '🔍 DRY RUN (no changes)'}\n`);

  const { data: creators, error } = await supabase
    .from('creators')
    .select('id, channel_name, description, country_code, subscriber_count')
    .order('subscriber_count', { ascending: false });

  if (error) throw new Error(`Failed to fetch creators: ${error.message}`);
  if (!creators?.length) { console.log('No creators found.'); return; }

  console.log(`Checking ${creators.length} creators against 3 rules…\n`);

  const flagged: Array<{ creator: Creator; reasons: string[] }> = [];

  for (const c of creators as Creator[]) {
    const reasons = checkCreator(c);
    if (reasons.length) flagged.push({ creator: c, reasons });
  }

  // ── Print flagged list ─────────────────────────────────────────────────────
  console.log(`─── Flagged channels (${flagged.length}) ──────────────────────────────────────────`);
  for (const { creator: c, reasons } of flagged) {
    const subs = (c.subscriber_count ?? 0).toLocaleString();
    console.log(`\n  ${c.channel_name}`);
    console.log(`  ${subs} subs  |  country: ${c.country_code ?? '—'}`);
    for (const r of reasons) console.log(`    → ${r}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const r1count = flagged.filter(({ reasons }) => reasons.some((r) => r.startsWith('Rule 1'))).length;
  const r2count = flagged.filter(({ reasons }) => reasons.some((r) => r.startsWith('Rule 2'))).length;
  const r3count = flagged.filter(({ reasons }) => reasons.some((r) => r.startsWith('Rule 3'))).length;

  console.log(`\n─── Summary ──────────────────────────────────────────────────────────────────`);
  console.log(`  Total creators      : ${creators.length}`);
  console.log(`  Flagged             : ${flagged.length}`);
  console.log(`  Would keep as human : ${creators.length - flagged.length}`);
  console.log(`\n  By rule:`);
  console.log(`    Rule 1 – name patterns  : ${r1count}`);
  console.log(`    Rule 2 – blocklist      : ${r2count}`);
  console.log(`    Rule 3 – no country+desc: ${r3count}`);

  if (!APPLY) {
    console.log(`\n  ─ Dry run complete. Review the list above. ─`);
    console.log(`\n  To apply:`);
    console.log(`    1. Run the migration in your Supabase dashboard:`);
    console.log(`         supabase/migrations/20260528000001_add_is_human.sql`);
    console.log(`    2. npm run filter:creators -- --apply\n`);
    return;
  }

  // ── Apply mode ─────────────────────────────────────────────────────────────
  console.log('\nWriting changes…');
  let ok = 0;
  let fail = 0;

  for (const { creator: c, reasons } of flagged) {
    const { error: updateErr } = await supabase
      .from('creators')
      .update({
        is_human:      false,
        filter_reason: reasons.join(' | '),
      })
      .eq('id', c.id);

    if (updateErr) {
      if (updateErr.message.includes('column') || updateErr.message.includes('schema cache')) {
        console.error('\n  ✗ Migration not applied. Run this SQL in your Supabase dashboard first:\n');
        console.error('    ALTER TABLE creators');
        console.error('      ADD COLUMN IF NOT EXISTS is_human      boolean NOT NULL DEFAULT true,');
        console.error('      ADD COLUMN IF NOT EXISTS filter_reason text;\n');
        console.error('  Then re-run: npm run filter:creators -- --apply\n');
        process.exit(1);
      }
      console.error(`  FAIL ${c.channel_name}: ${updateErr.message}`);
      fail++;
    } else {
      ok++;
    }
  }

  console.log(`\n  Marked ${ok} creators as is_human = false`);
  if (fail) console.log(`  ${fail} errors`);
  console.log('\nDone.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
