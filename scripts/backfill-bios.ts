/**
 * FameRank Bio Backfill
 *
 * Generates AI bios for all human creators that don't have one yet.
 * Queries Wikipedia for context, then rewrites it via the Anthropic API.
 *
 * Usage:
 *   npm run backfill:bios
 *
 * Prerequisite:
 *   Run supabase/migrations/20260528000002_add_generated_bio.sql first.
 *   Set ANTHROPIC_API_KEY in .env.local.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { generateBio } from './lib/generate-bio';

const BIO_DELAY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('\nFameRank Bio Backfill\n');

  const { data: creators, error } = await supabase
    .from('creators')
    .select('id, channel_name, description')
    .is('generated_bio', null)
    .eq('is_human', true)
    .order('subscriber_count', { ascending: false });

  if (error) {
    if (error.message.includes('column') || error.message.includes('schema cache')) {
      console.error('\n  Migration not applied. Run this SQL in your Supabase dashboard first:\n');
      console.error('    ALTER TABLE creators ADD COLUMN IF NOT EXISTS generated_bio text;\n');
      console.error('  Then re-run: npm run backfill:bios\n');
      process.exit(1);
    }
    throw new Error(`Failed to fetch creators: ${error.message}`);
  }

  if (!creators?.length) {
    console.log('All human creators already have bios. Nothing to do.');
    return;
  }

  console.log(`Generating bios for ${creators.length} creators…\n`);

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < creators.length; i++) {
    const c = creators[i];
    process.stdout.write(`  [${i + 1}/${creators.length}] ${c.channel_name}… `);

    const bio = await generateBio(c.channel_name, c.description);

    if (!bio) {
      process.stdout.write('skipped\n');
      failed++;
    } else {
      const { error: updateErr } = await supabase
        .from('creators')
        .update({ generated_bio: bio })
        .eq('id', c.id);

      if (updateErr) {
        process.stdout.write(`ERROR: ${updateErr.message}\n`);
        failed++;
      } else {
        process.stdout.write('done\n');
        generated++;
      }
    }

    if (i < creators.length - 1) await sleep(BIO_DELAY_MS);
  }

  console.log('\n─── Summary ────────────────────────────────────────────────');
  console.log(`  Generated : ${generated}`);
  console.log(`  Skipped   : ${failed}`);
  console.log(`  Total     : ${creators.length}`);
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
