/**
 * Offline stand-ins for the Groq-backed chat and idea generator, for the demo
 * build. There is no model here — just a small bank of replies picked by
 * keyword — so the screens can be shown without an API key in the bundle.
 */

const IDEA_BANK: { keywords: string[]; ideas: string[] }[] = [
  {
    keywords: ['gift', 'present', 'birthday'],
    ideas: [
      'A framed print of the map around the place you first met.',
      'A jar of handwritten notes, one for each month you have been together.',
      'The book they keep borrowing from the library, with a note inside the cover.',
      'A class for the hobby they keep saying they will try.',
    ],
  },
  {
    keywords: ['sorry', 'apolog', 'fight', 'argument', 'upset'],
    ideas: [
      'Say what you got wrong in one sentence, without a "but" after it.',
      'Cook the comfort meal they reach for on bad days.',
      'Take the chore they hate off their list for the week, without announcing it.',
      'Ask what would help, then actually do that instead of guessing.',
    ],
  },
  {
    keywords: ['anniversary'],
    ideas: [
      'Recreate your first date, down to the order at the café.',
      'Write a letter to open on next year’s anniversary.',
      'Make a playlist of one song from every month of this year.',
      'Revisit the place you took your first photo together and take it again.',
    ],
  },
];

const DEFAULT_IDEAS = [
  'Pack a picnic and watch the sunset somewhere you have never been.',
  'Cook a recipe from a country neither of you has visited yet.',
  'Swap phones for an evening and plan a surprise for each other from the photo albums.',
  'Go to a pottery or painting class and give each other what you make.',
  'Have a no-screens breakfast in bed with the good coffee.',
];

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function demoIdeas(prompt: string): Promise<string[]> {
  await delay(900);
  const lower = prompt.toLowerCase();
  const match = IDEA_BANK.find((entry) => entry.keywords.some((k) => lower.includes(k)));
  return match ? match.ideas : DEFAULT_IDEAS;
}

export async function demoChatReply(message: string): Promise<string> {
  await delay(1100);
  const lower = message.toLowerCase();

  if (/\b(hi|hello|hey)\b/.test(lower)) {
    return 'Hi! This is the demo build, so I am answering from a short script rather than a live model. Ask me for date ideas, a gift, or how to patch up a disagreement.';
  }
  if (lower.includes('date') || lower.includes('weekend') || lower.includes('plan')) {
    return 'Keep it small and specific: a walk to somewhere with a view, a snack you both love, and your phones left in a bag. The best plans are the ones you actually do this week.';
  }
  if (lower.includes('fight') || lower.includes('argu') || lower.includes('sorry')) {
    return 'Start with what you heard them say, before what you meant. Then pick one concrete thing you will do differently. A short, specific apology lands better than a long one.';
  }
  if (lower.includes('gift') || lower.includes('present')) {
    return 'Think about something they mentioned in passing in the last month — that is usually the gift that feels like you were listening.';
  }
  return 'In the full app this goes to a live AI model. In the demo I can only offer a scripted reply — try asking about date ideas, gifts, or making up after an argument.';
}
