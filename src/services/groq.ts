/**
 * Groq-backed idea generation.
 *
 * Deliberately narrow: this asks for date/gift/message ideas and nothing else.
 * It sends only what the user typed — no moods, check-ins, cycle data or step
 * history ever leave the device through here. That was a product decision, and
 * it is worth keeping: the app holds the most private things two people share,
 * and "the assistant knows everything about your relationship" is a very
 * different privacy posture from "the assistant suggests date ideas".
 *
 * The key ships in the bundle via EXPO_PUBLIC_GROQ_API_KEY, which means anyone
 * who unzips the APK can read it. That is an accepted trade for a free-tier
 * key — the exposure is someone burning the rate limit, not a bill or a data
 * leak. If this ever moves to a paid tier, put a Supabase Edge Function in
 * front of it and keep the key server-side; the call signature below wouldn't
 * change.
 */

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Production-tier, 131K context, and the model Groq names as the migration
 * target for everything it has retired. Note llama-3.3-70b-versatile and
 * llama-3.1-8b-instant were both deprecated in 2026 — don't reach for them.
 */
const MODEL = 'openai/gpt-oss-120b';

/** Long enough for a slow network, short enough that a dead call gives up. */
const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT = [
  'You suggest ideas for a couple: dates, gifts, small gestures, and things to say.',
  'Reply with 3 to 5 concrete, specific suggestions as a plain list, one per line, each starting with "- ".',
  'No preamble, no sign-off, no markdown headings, no numbering.',
  'Each suggestion is one or two sentences. Favour the specific and doable over the grand and vague:',
  '"recreate the meal from your first date" beats "have a romantic dinner".',
  'Assume a modest budget unless told otherwise. Never mention that you are an AI.',
].join(' ');

export interface IdeaResult {
  ideas: string[];
  error?: string;
}

/** Split the model's reply into individual suggestions. */
function parseIdeas(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
    // A model that ignores the format instruction can return one long
    // paragraph; better to show that than to show nothing.
    .slice(0, 8);
}

export async function generateIdeas(prompt: string): Promise<IdeaResult> {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!key) {
    return {
      ideas: [],
      error: 'No Groq key configured. Add EXPO_PUBLIC_GROQ_API_KEY to .env and restart the bundler.',
    };
  }

  const trimmed = prompt.trim();
  if (!trimmed) return { ideas: [] };

  // fetch has no timeout of its own, so a stalled connection would hang the
  // spinner indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: trimmed },
        ],
        temperature: 0.9, // ideas should vary between asks
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      // Surface the cases a user can actually act on, rather than a raw status.
      if (res.status === 401) return { ideas: [], error: 'Groq rejected the API key.' };
      if (res.status === 429) return { ideas: [], error: 'Rate limited — try again in a moment.' };
      return { ideas: [], error: `Groq returned ${res.status}.` };
    }

    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    const ideas = parseIdeas(text);
    if (ideas.length === 0) return { ideas: [], error: 'No ideas came back. Try rephrasing.' };
    return { ideas };
  } catch (e: any) {
    if (e?.name === 'AbortError') return { ideas: [], error: 'Timed out. Check your connection.' };
    return { ideas: [], error: 'Could not reach Groq. Check your connection.' };
  } finally {
    clearTimeout(timer);
  }
}
