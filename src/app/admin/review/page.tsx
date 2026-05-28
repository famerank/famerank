import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { formatCount } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Review Flagged Creators — FameRank Admin' };

type FlaggedCreator = {
  id:                string;
  channel_name:      string;
  profile_image_url: string | null;
  subscriber_count:  number | null;
  country_code:      string | null;
  filter_reason:     string | null;
};

export default async function AdminReviewPage() {
  const supabase = createServiceClient();

  const { data: flagged, error } = await supabase
    .from('creators')
    .select('id, channel_name, profile_image_url, subscriber_count, country_code, filter_reason')
    .eq('is_human', false)
    .order('subscriber_count', { ascending: false });

  // ── Server actions ──────────────────────────────────────────────────────────
  async function markAsHuman(formData: FormData) {
    'use server';
    const id = formData.get('creatorId') as string;
    const svc = createServiceClient();
    await svc
      .from('creators')
      .update({ is_human: true, filter_reason: null })
      .eq('id', id);
    revalidatePath('/admin/review');
  }

  // ── Migration not run yet ───────────────────────────────────────────────────
  if (error) {
    const needsMigration = error.message.includes('is_human') || error.message.includes('column');
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
        <div className="max-w-xl w-full">
          <h1 className="text-2xl font-black text-ink-950 mb-3">Migration Required</h1>
          <p className="text-ink-500 mb-6">
            {needsMigration
              ? 'The is_human column doesn\'t exist yet. Run this SQL in your Supabase dashboard first:'
              : `Database error: ${error.message}`}
          </p>
          {needsMigration && (
            <pre className="bg-ink-100 border border-ink-200 rounded p-5 text-xs text-ink-700 leading-relaxed overflow-x-auto">
              {`ALTER TABLE creators
  ADD COLUMN IF NOT EXISTS is_human      boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS filter_reason text;

CREATE INDEX IF NOT EXISTS creators_is_human_idx ON creators (is_human);`}
            </pre>
          )}
          <p className="mt-5 text-sm text-ink-400">
            Then run:{' '}
            <code className="text-gold-600 bg-ink-100 px-1.5 py-0.5 rounded text-xs">
              npm run filter:creators -- --apply
            </code>
          </p>
        </div>
      </div>
    );
  }

  const rows = (flagged ?? []) as FlaggedCreator[];

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-6 lg:px-8 py-12">

        {/* Header */}
        <div className="mb-10 pb-8 border-b border-ink-200">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-600 mb-3">
            Admin
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-ink-950 tracking-tight">
            Flagged Creators
          </h1>
          <p className="mt-3 text-ink-500 font-light">
            {rows.length > 0
              ? `${rows.length} creator${rows.length === 1 ? '' : 's'} flagged as non-human. Mark any incorrect flags to restore them to rankings.`
              : 'No flagged creators.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/rankings"
              className="text-sm font-medium text-ink-500 hover:text-ink-950 transition-colors"
            >
              ← Back to Rankings
            </Link>
            <span className="text-ink-300">·</span>
            <span className="text-sm text-ink-400">
              To re-run:
              <code className="ml-1.5 text-gold-600 bg-ink-100 px-1.5 py-0.5 rounded text-xs">
                npm run filter:creators -- --apply
              </code>
            </span>
          </div>
        </div>

        {/* Empty state */}
        {rows.length === 0 && (
          <div className="border border-ink-200 rounded p-12 text-center">
            <p className="text-ink-400 font-light">No creators have been flagged yet.</p>
            <p className="mt-3 text-sm text-ink-400">
              Run{' '}
              <code className="text-gold-600 bg-ink-100 px-1.5 py-0.5 rounded text-xs">
                npm run filter:creators -- --apply
              </code>{' '}
              to flag non-human channels.
            </p>
          </div>
        )}

        {/* Flagged list */}
        {rows.length > 0 && (
          <div className="border border-ink-200 rounded overflow-hidden">
            {rows.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-4 px-5 py-4 border-b border-ink-100 last:border-b-0"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-ink-200 bg-ink-100 mt-0.5">
                  {c.profile_image_url ? (
                    <Image
                      src={c.profile_image_url}
                      alt={c.channel_name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-ink-400">
                      {c.channel_name.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/creator/${c.id}`}
                      className="font-semibold text-ink-950 hover:text-gold-600 transition-colors"
                    >
                      {c.channel_name}
                    </Link>
                    {c.country_code && (
                      <span className="text-xs text-ink-400 border border-ink-200 rounded px-1.5 py-0.5">
                        {c.country_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {formatCount(c.subscriber_count)} subscribers
                  </p>
                  {c.filter_reason && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2 leading-relaxed">
                      {c.filter_reason}
                    </p>
                  )}
                </div>

                {/* Toggle action */}
                <form action={markAsHuman}>
                  <input type="hidden" name="creatorId" value={c.id} />
                  <button
                    type="submit"
                    className="flex-shrink-0 text-xs font-semibold text-gold-600 border border-gold-300 rounded px-3 py-1.5 hover:bg-gold-50 transition-colors whitespace-nowrap"
                  >
                    Mark as Human ✓
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Also show a section for manually flagging borderline creators */}
        <div className="mt-12 pt-8 border-t border-ink-200">
          <h2 className="text-sm font-semibold text-ink-500 mb-3 uppercase tracking-widest">
            Manually Flag a Creator
          </h2>
          <ManualFlagForm supabase={supabase} />
        </div>
      </div>
    </div>
  );
}

// ── Manual flag section ────────────────────────────────────────────────────────
// Simple search box to look up and flag a creator by name

async function ManualFlagForm({
  supabase,
}: {
  supabase: ReturnType<typeof createServiceClient>;
}) {
  // Fetch a sample of human creators for the manual flag section
  const { data: humans } = await supabase
    .from('creators')
    .select('id, channel_name, subscriber_count')
    .eq('is_human', true)
    .order('subscriber_count', { ascending: false })
    .limit(20);

  if (!humans?.length) return null;

  return (
    <p className="text-sm text-ink-400 font-light">
      To manually flag a creator, find them at{' '}
      <Link href="/rankings" className="text-gold-600 hover:text-gold-500 transition-colors">
        /rankings
      </Link>{' '}
      and note their ID, then run the script with{' '}
      <code className="text-xs bg-ink-100 text-gold-600 px-1.5 py-0.5 rounded">--apply</code> or
      update <code className="text-xs bg-ink-100 text-ink-700 px-1.5 py-0.5 rounded">is_human</code>{' '}
      directly in the Supabase dashboard.
    </p>
  );
}
