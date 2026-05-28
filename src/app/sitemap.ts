import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/service';

const BASE_URL = 'https://www.thefamerank.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient();

  const { data: creators } = await supabase
    .from('creators')
    .select('id, updated_at')
    .eq('is_human', true);

  const creatorEntries: MetadataRoute.Sitemap = (creators ?? []).map((c) => ({
    url: `${BASE_URL}/creator/${c.id}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/rankings`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...creatorEntries,
  ];
}
