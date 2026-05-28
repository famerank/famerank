import { createClient } from '@supabase/supabase-js';

// Server-only client that uses the service role key.
// Use this in server components and API routes for data fetching.
// Never import this in client components.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: {
      // Bypass Next.js data cache — every request must hit Supabase directly.
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
