import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You write concise, authoritative creator bios for FameRank, a YouTube creator ranking platform.
Write bios in third person, 2-3 sentences, focused on what the creator is known for and why they matter.
Be specific about their content type, audience impact, and what makes them notable.
Do not mention subscriber counts or statistics. Focus on their identity and reputation.
Never start with "I" or write in first person.`;

async function fetchWikipediaSummary(name: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(name.replace(/ /g, '_'));
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
      headers: { 'User-Agent': 'FameRank/1.0 (thefamerank.com)' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { extract?: string; type?: string };
    if (data.type === 'disambiguation') return null;
    return data.extract ?? null;
  } catch {
    return null;
  }
}

export async function generateBio(
  channelName: string,
  description: string | null,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  const wikiSummary = await fetchWikipediaSummary(channelName);

  const contextParts: string[] = [];
  if (wikiSummary) contextParts.push(`Wikipedia: ${wikiSummary}`);
  if (description?.trim()) contextParts.push(`Channel description: ${description.trim().slice(0, 500)}`);

  const context = contextParts.length > 0
    ? `\n\nContext:\n${contextParts.join('\n\n')}`
    : '';

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 256,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        } as Anthropic.TextBlockParam & { cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          content: `Write a 2-3 sentence bio for the YouTube creator "${channelName}".${context}`,
        },
      ],
    });

    const block = message.content[0];
    if (block.type !== 'text') return null;
    return block.text.trim() || null;
  } catch (err) {
    console.error(`  Bio generation failed for "${channelName}": ${(err as Error).message}`);
    return null;
  }
}
