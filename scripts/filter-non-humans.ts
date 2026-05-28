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

// ─── Rule 4 — Sports/News broadcasters ───────────────────────────────────────

const R4_NAME_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bSports\b/i,       label: 'Sports' },
  { re: /\bTelevision\b/i,   label: 'Television' },
  { re: /\bBroadcasting\b/i, label: 'Broadcasting' },
  { re: /\bArchive\b/i,      label: 'Archive' },
  { re: /\bChannel\b/i,      label: 'Channel' },
];

const R4_BLOCKLIST = [
  'Sky Sports', 'TNT Sports', 'CBS Sports', 'BBC', 'CNN', 'Bloomberg',
  'FRANCE 24', 'ITV Sport', 'GBNews', 'LBC', 'TalkTV', 'DAZN',
  'SuperSport', 'CNA', 'Telemundo', 'AP Archive', 'CANAL+',
  'Amazon Prime Video', 'Paramount Plus', 'Comedy Central',
];

// ─── Rule 5 — Generic/aggregator channels ────────────────────────────────────

const R5_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bWORKOUT\b/,      label: 'All-caps WORKOUT' },
  { re: /\bGYM\b/,          label: 'All-caps GYM' },
  { re: /\bHOMEWORKOUT\b/,  label: 'All-caps HOMEWORKOUT' },
  { re: /\bDIY\b/i,          label: 'DIY' },
  { re: /\bASMR\b/i,        label: 'ASMR' },
  { re: /\bRelaxing\b/i,    label: 'Relaxing' },
  { re: /\bAmbient\b/i,     label: 'Ambient' },
  { re: /\bDocumentary\b/i, label: 'Documentary' },
  { re: /\b(Toddler|Baby)\s+(Learning|Songs|Channel|TV|Rhymes)\b/i, label: 'Baby/Toddler learning' },
  { re: /\bKids\s+(Learning|Songs|TV|Channel|Rhymes)\b/i,           label: 'Kids learning/aggregator' },
];

// ─── Rule 6 — Corporate brand channels ───────────────────────────────────────

const R6_BLOCKLIST = [
  'Tasty', 'Bon Appétit', 'Bon Appetit', 'Charlotte Tilbury', 'MAC Cosmetics',
  'McLaren', 'The Home Depot', "Lowe's", 'Lowes', 'Play Nintendo',
  'Y Combinator', 'BuzzFeed',
];

// ─── Rule 7 — Group/duo channels ─────────────────────────────────────────────

const R7_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\bBros\b/i,                                label: 'Bros' },
  { re: /\bSisters\b/i,                             label: 'Sisters' },
  { re: /\bBrothers\b/i,                            label: 'Brothers' },
  { re: /\bSquad\b/i,                               label: 'Squad' },
  { re: /\s+&\s+/,                                  label: 'Ampersand duo (&)' },
  { re: /\b[A-Z][a-z]+ and [A-Z][a-z]+\b/,         label: 'Name and Name' },
];

// ─── Rule 8 — TV show brand channels ─────────────────────────────────────────

const R8_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /The Masked Singer/i,  label: 'The Masked Singer' },
  { re: /America.s Funniest/i, label: "America's Funniest" },
];

// ─── Exemption allowlist — confirmed human creators, never flagged ────────────

const ALLOWLIST = [
  'Ms Rachel',
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
  // Platform / corporate channels
  'YouTube',
  // Comedy aggregators (not individual comedians)
  'Goldmines',
  'LIV Comedy',
  'LIV Kids',
  'Comedy Captain',
  'NOW COMEDY',
  'All Things Comedy',
  'Sri Balaji Comedy',
  // Kids aggregators
  'SLICK SLIME SAM',
  'PunToon Kids',
  'Kids Zone Pakistan',
  'Play Kids',
  'Moshi Kids',
  'Baby Shark Classroom',
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

function blocklistMatch(name: string, list: string[]): string | undefined {
  const lc = name.toLowerCase();
  return list.find((b) => lc === b.toLowerCase() || lc.startsWith(b.toLowerCase() + ' '));
}

function checkCreator(c: Creator): string[] {
  const reasons: string[] = [];
  const name = c.channel_name;

  // Allowlist — confirmed human, skip all rules
  const lc = name.toLowerCase();
  if (ALLOWLIST.some((a) => lc === a.toLowerCase() || lc.startsWith(a.toLowerCase() + ' ') || lc.startsWith(a.toLowerCase() + '-'))) return reasons;

  // Rule 1 — Name patterns
  const r1 = NAME_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (r1.length) reasons.push(`Rule 1 (name pattern): ${r1.join(', ')}`);

  // Rule 2 — Known non-human blocklist
  const r2 = blocklistMatch(name, BLOCKLIST);
  if (r2) reasons.push(`Rule 2 (blocklist): "${r2}"`);

  // Rule 3 — No country code AND no description
  if (!c.country_code && (!c.description || c.description.trim().length === 0)) {
    reasons.push('Rule 3: No country code and no description');
  }

  // Rule 4 — Sports/News broadcasters
  const r4name = R4_NAME_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (r4name.length) reasons.push(`Rule 4 (broadcaster pattern): ${r4name.join(', ')}`);
  const r4block = blocklistMatch(name, R4_BLOCKLIST);
  if (r4block) reasons.push(`Rule 4 (broadcaster blocklist): "${r4block}"`);

  // Rule 5 — Generic/aggregator channels
  const r5 = R5_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (r5.length) reasons.push(`Rule 5 (aggregator): ${r5.join(', ')}`);

  // Rule 6 — Corporate brand channels
  const r6 = blocklistMatch(name, R6_BLOCKLIST);
  if (r6) reasons.push(`Rule 6 (corporate brand): "${r6}"`);

  // Rule 7 — Group/duo channels
  const r7 = R7_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (r7.length) reasons.push(`Rule 7 (group channel): ${r7.join(', ')}`);

  // Rule 8 — TV show brand channels
  const r8 = R8_PATTERNS.filter(({ re }) => re.test(name)).map(({ label }) => label);
  if (r8.length) reasons.push(`Rule 8 (TV show): ${r8.join(', ')}`);

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

  console.log(`Checking ${creators.length} creators against 8 rules…\n`);

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
  const ruleCount = (prefix: string) =>
    flagged.filter(({ reasons }) => reasons.some((r) => r.startsWith(prefix))).length;

  const r1count = ruleCount('Rule 1');
  const r2count = ruleCount('Rule 2');
  const r3count = ruleCount('Rule 3');
  const r4count = ruleCount('Rule 4');
  const r5count = ruleCount('Rule 5');
  const r6count = ruleCount('Rule 6');
  const r7count = ruleCount('Rule 7');
  const r8count = ruleCount('Rule 8');

  const newRulesOnly = flagged.filter(({ reasons }) =>
    reasons.some((r) => /^Rule [45678]/.test(r)) &&
    !reasons.some((r) => /^Rule [123]/.test(r)),
  ).length;

  console.log(`\n─── Summary ──────────────────────────────────────────────────────────────────`);
  console.log(`  Total creators           : ${creators.length}`);
  console.log(`  Flagged                  : ${flagged.length}`);
  console.log(`  Would keep as human      : ${creators.length - flagged.length}`);
  console.log(`  NEW flags (rules 4-8 only): ${newRulesOnly}`);
  console.log(`\n  By rule:`);
  console.log(`    Rule 1 – name patterns        : ${r1count}`);
  console.log(`    Rule 2 – blocklist            : ${r2count}`);
  console.log(`    Rule 3 – no country+desc      : ${r3count}`);
  console.log(`    Rule 4 – broadcaster          : ${r4count}`);
  console.log(`    Rule 5 – aggregator           : ${r5count}`);
  console.log(`    Rule 6 – corporate brand      : ${r6count}`);
  console.log(`    Rule 7 – group/duo channel    : ${r7count}`);
  console.log(`    Rule 8 – TV show brand        : ${r8count}`);

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
