/**
 * Seeds all FameRank categories into the categories table.
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
  // ── Original 12 ───────────────────────────────────────────────────────────
  { name: 'Music',        slug: 'music',        icon: '🎵', description: 'Musicians, singers, bands, and music producers' },
  { name: 'Fitness',      slug: 'fitness',      icon: '💪', description: 'Personal trainers, athletes, and health influencers' },
  { name: 'Comedy',       slug: 'comedy',       icon: '😂', description: 'Comedians, sketch artists, and entertainers' },
  { name: 'Beauty',       slug: 'beauty',       icon: '💄', description: 'Makeup artists, skincare experts, and beauty gurus' },
  { name: 'Fashion',      slug: 'fashion',      icon: '👗', description: 'Fashion designers, stylists, and trendsetters' },
  { name: 'Food',         slug: 'food',         icon: '🍕', description: 'Food reviewers, mukbang creators, and culinary explorers' },
  { name: 'Gaming',       slug: 'gaming',       icon: '🎮', description: 'Gamers, streamers, and esports personalities' },
  { name: 'Lifestyle',    slug: 'lifestyle',    icon: '✨', description: 'Vloggers, daily life creators, and wellness influencers' },
  { name: 'Business',     slug: 'business',     icon: '💼', description: 'Entrepreneurs, investors, and business educators' },
  { name: 'Parenting',    slug: 'parenting',    icon: '👶', description: 'Parents, family creators, and child educators' },
  { name: 'Sports',       slug: 'sports',       icon: '⚽', description: 'Athletes, coaches, and sports analysts' },
  { name: 'Travel',       slug: 'travel',       icon: '✈️', description: 'Travel vloggers, adventurers, and destination guides' },

  // ── Priority 1 additions ──────────────────────────────────────────────────
  { name: 'Technology & Gadgets', slug: 'technology',        icon: '💻', description: 'Tech reviewers, gadget unboxers, and software creators' },
  { name: 'Kids & Family',        slug: 'kids-family',       icon: '🧸', description: 'Children\'s entertainment, nursery rhymes, and family-friendly shows' },
  { name: 'News & Politics',      slug: 'news-politics',     icon: '📰', description: 'News channels, political commentators, and current affairs creators' },
  { name: 'Science & Education',  slug: 'science-education', icon: '🔬', description: 'Science communicators, educators, and academic content creators' },
  { name: 'Cars & Automotive',    slug: 'cars-automotive',   icon: '🚗', description: 'Car reviewers, automotive enthusiasts, and motorsport creators' },
  { name: 'Finance & Investing',  slug: 'finance-investing', icon: '📈', description: 'Financial educators, stock market analysts, and wealth-building guides' },

  // ── Priority 2 additions ──────────────────────────────────────────────────
  { name: 'ASMR',                   slug: 'asmr',             icon: '🎧', description: 'ASMR creators, relaxation, and satisfying content' },
  { name: 'DIY & Home',             slug: 'diy-home',         icon: '🔨', description: 'DIY projects, home improvement, and craft creators' },
  { name: 'Nature & Wildlife',      slug: 'nature-wildlife',  icon: '🌿', description: 'Nature documentarians, wildlife enthusiasts, and environmental creators' },
  { name: 'Cooking & Recipes',      slug: 'cooking-recipes',  icon: '👨‍🍳', description: 'Recipe tutorials, home cooks, and baking creators' },
  { name: 'Dance',                  slug: 'dance',            icon: '💃', description: 'Dancers, choreographers, and dance tutorial creators' },
  { name: 'Mental Health',          slug: 'mental-health',    icon: '🧠', description: 'Mental health advocates, therapists, and mindfulness creators' },
  { name: 'Pets & Animals',         slug: 'pets-animals',     icon: '🐾', description: 'Pet owners, animal trainers, and cute animal content' },
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

  console.log(`✓ ${CATEGORIES.length} categories seeded (12 original + 13 new)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
