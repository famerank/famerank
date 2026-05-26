/**
 * Seeds the 12 top-level FameRank categories into the categories table.
 *
 * Usage:
 *   npm run seed:categories
 *
 * Safe to re-run — upserts on slug.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const CATEGORIES = [
  { name: 'Music',     slug: 'music',     icon: '🎵', description: 'Musicians, singers, bands, and music producers' },
  { name: 'Fitness',   slug: 'fitness',   icon: '💪', description: 'Personal trainers, athletes, and health influencers' },
  { name: 'Comedy',    slug: 'comedy',    icon: '😂', description: 'Comedians, sketch artists, and entertainers' },
  { name: 'Beauty',    slug: 'beauty',    icon: '💄', description: 'Makeup artists, skincare experts, and beauty gurus' },
  { name: 'Fashion',   slug: 'fashion',   icon: '👗', description: 'Fashion designers, stylists, and trendsetters' },
  { name: 'Food',      slug: 'food',      icon: '🍕', description: 'Chefs, food reviewers, and culinary creators' },
  { name: 'Gaming',    slug: 'gaming',    icon: '🎮', description: 'Gamers, streamers, and esports personalities' },
  { name: 'Lifestyle', slug: 'lifestyle', icon: '✨', description: 'Vloggers, daily life creators, and wellness influencers' },
  { name: 'Business',  slug: 'business',  icon: '💼', description: 'Entrepreneurs, investors, and business educators' },
  { name: 'Parenting', slug: 'parenting', icon: '👶', description: 'Parents, family creators, and child educators' },
  { name: 'Sports',    slug: 'sports',    icon: '⚽', description: 'Athletes, coaches, and sports analysts' },
  { name: 'Travel',    slug: 'travel',    icon: '✈️', description: 'Travel vloggers, adventurers, and destination guides' },
] as const;

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing from .env.local');
  if (!supabaseKey) throw new Error('No Supabase key found in .env.local');

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Seeding categories…');

  const { error } = await supabase
    .from('categories')
    .upsert(CATEGORIES, { onConflict: 'slug' });

  if (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }

  console.log(`✓ ${CATEGORIES.length} categories seeded`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
