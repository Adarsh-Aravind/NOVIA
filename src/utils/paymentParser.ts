import type { CapturedNotification } from '../../modules/notification-listener';

/**
 * Turns a payment app's notification into a transaction, or into nothing.
 *
 * This lives in JavaScript rather than in the Kotlin service on purpose. The
 * wording of these notifications is not a contract — payment apps reword them
 * whenever they redesign, and a pattern that silently stops matching produces
 * the worst possible failure: a feed that looks fine and is quietly missing
 * payments. Keeping the rules here means a fix ships over the air in minutes
 * instead of as a whole native build.
 *
 * Two consequences of that fragility are designed for rather than hoped away:
 * every pattern is written to fail closed (no match means no row, never a
 * guessed row), and unmatched notifications from a watched package are logged
 * in development so a new wording can be captured off a real device and turned
 * into a pattern.
 */

export interface ParsedPayment {
  direction: 'sent' | 'received';
  amount: number;
  counterparty: string;
  sourcePackage: string;
  /** ISO timestamp taken from the OS's post time, not from the parse time. */
  occurredAt: string;
  dedupKey: string;
}

/**
 * Ordered most-specific first. `amountAt`/`nameAt` are capture-group indices,
 * because the phrasings disagree about word order: a bank SMS puts the amount
 * before the name ("Sent Rs.20.00 ... to GAYATHRI UDAYAN") and a payment app
 * sometimes puts the name first ("Adarsh paid you Rs.500").
 *
 * The currency prefix is optional and loose — ₹, Rs, Rs., INR, or nothing at
 * all — since which of those appears varies by app, by bank, by locale
 * setting, and by notification style within a single sender.
 *
 * `GAP` is what sits between the amount and the counterparty: an account
 * number, a bank's name for itself, "in your A/c". It is bounded and cannot
 * cross a full stop, so a pattern can't wander into the next sentence and
 * mistake a UPI reference for a person.
 */
const CURRENCY = String.raw`(?:₹|rs\.?|inr)?\s*`;
const AMOUNT = String.raw`([\d,]+(?:\.\d{1,2})?)`;
const GAP = String.raw`(?:[^.]{0,60}?)?\s+`;

interface Pattern {
  re: RegExp;
  direction: 'sent' | 'received';
  amountAt: number;
  nameAt: number;
}

const PATTERNS: Pattern[] = [
  // Kotak, and bank SMS generally — the couple's actual source:
  // "Sent Rs.20.00 from XX2946 to GAYATHRI  UDAYAN on 07-Sep-26. UPI ref no..."
  {
    re: new RegExp(String.raw`\bsent\s+${CURRENCY}${AMOUNT}\b${GAP}to\s+(.+)`, 'i'),
    direction: 'sent',
    amountAt: 1,
    nameAt: 2,
  },
  // "Rs.500.00 debited from A/c XX2946 to ADARSH ARAVIND"
  {
    re: new RegExp(String.raw`${CURRENCY}${AMOUNT}\s+debited\b${GAP}to\s+(.+)`, 'i'),
    direction: 'sent',
    amountAt: 1,
    nameAt: 2,
  },
  // "You paid ₹500 to Gayathri Udhayan"  ·  "Paid ₹500 to Gayathri"
  {
    re: new RegExp(String.raw`(?:you\s+)?paid\s+${CURRENCY}${AMOUNT}\s+to\s+(.+)`, 'i'),
    direction: 'sent',
    amountAt: 1,
    nameAt: 2,
  },
  // "₹500 sent to Gayathri Udhayan"  ·  "₹500 paid to Gayathri"
  {
    re: new RegExp(String.raw`${CURRENCY}${AMOUNT}\s+(?:sent|paid)\s+to\s+(.+)`, 'i'),
    direction: 'sent',
    amountAt: 1,
    nameAt: 2,
  },
  // "You sent ₹500 to Gayathri"  ·  "Payment of ₹500 to Gayathri successful"
  {
    re: new RegExp(
      String.raw`(?:you\s+sent|payment\s+of|transferred)\s+${CURRENCY}${AMOUNT}\s+to\s+(.+)`,
      'i'
    ),
    direction: 'sent',
    amountAt: 1,
    nameAt: 2,
  },
  // "Received Rs.500.00 in your Kotak Bank AC XX2946 from ADARSH ARAVIND on..."
  {
    re: new RegExp(String.raw`\breceived\s+${CURRENCY}${AMOUNT}\b${GAP}from\s+(.+)`, 'i'),
    direction: 'received',
    amountAt: 1,
    nameAt: 2,
  },
  // "Rs.500.00 credited to your A/c XX2946 from ADARSH ARAVIND"
  {
    re: new RegExp(String.raw`${CURRENCY}${AMOUNT}\s+credited\b${GAP}from\s+(.+)`, 'i'),
    direction: 'received',
    amountAt: 1,
    nameAt: 2,
  },
  // "₹500 received from Adarsh"
  {
    re: new RegExp(String.raw`${CURRENCY}${AMOUNT}\s+received\s+from\s+(.+)`, 'i'),
    direction: 'received',
    amountAt: 1,
    nameAt: 2,
  },
  // "Adarsh Aravind paid you ₹500"  ·  "Adarsh sent you ₹500"
  {
    re: new RegExp(String.raw`(?:^|:\s*)(.+?)\s+(?:paid|sent)\s+you\s+${CURRENCY}${AMOUNT}`, 'i'),
    direction: 'received',
    amountAt: 2,
    nameAt: 1,
  },
];

/**
 * Everything a bank or payment app likes to bolt onto the end of a name: the
 * date, the rail, the reference, the "Not you?" line. Cutting at the first of
 * these is what turns "GAYATHRI  UDAYAN on 07-Sep-26. UPI ref no. 661622805265"
 * back into a name.
 */
const NAME_TAIL = /\s+(?:using|via|on|for|through|at|ref|utr|txn|—|-|\||·|,)\b.*$/i;

/** A name never runs past the end of its own sentence. */
const SENTENCE_END = /[.!?](?:\s|$)[\s\S]*$/;

function cleanName(raw: string): string {
  return raw
    .replace(SENTENCE_END, '')
    .replace(NAME_TAIL, '')
    .replace(/[.!·|]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Letters and digits only, lower-cased — the form both sides are compared in. */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Whether a detected counterparty is the partner.
 *
 * Deliberately generous in one direction only. The name a payment app shows is
 * whatever the bank has on file, so it is routinely longer than the name in
 * the app's own profile ("Gayathri Udhayan" against "Gayathri") and sometimes
 * an initial or a middle name apart. Matching on any shared token of three or
 * more characters bridges that; the three-character floor is what keeps
 * initials and honorifics from matching everyone.
 *
 * Being generous the other way would be worse than missing a payment: it would
 * put a stranger's transfer into a couple's shared feed.
 */
export function matchesPartner(counterparty: string, aliases: string[]): boolean {
  const found = normalize(counterparty);
  if (!found) return false;

  const foundTokens = new Set(found.split(' ').filter((t) => t.length >= 3));

  return aliases.some((alias) => {
    const want = normalize(alias);
    if (!want) return false;
    if (found === want || found.includes(want) || want.includes(found)) return true;
    return want.split(' ').some((t) => t.length >= 3 && foundTokens.has(t));
  });
}

/**
 * Same-device key. Android re-posts a notification when it updates in place,
 * and the payment apps do exactly that (pending → complete), so without this
 * a single transfer can arrive two or three times from one phone.
 *
 * The minute bucket is the reason this cannot also solve cross-device
 * duplicates: the two phones see the same payment seconds apart and routinely
 * land either side of a minute boundary. That pairing is done server-side, in
 * record_transaction().
 */
function makeDedupKey(
  sourcePackage: string,
  direction: string,
  amount: number,
  postTime: number
): string {
  const cents = Math.round(amount * 100);
  const minute = Math.floor(postTime / 60_000);
  return `${sourcePackage}|${direction}|${cents}|${minute}`;
}

export function parsePayment(
  notification: CapturedNotification,
  partnerAliases: string[]
): ParsedPayment | null {
  const haystack = `${notification.title} ${notification.text}`.trim();
  if (!haystack) return null;

  for (const pattern of PATTERNS) {
    const match = pattern.re.exec(haystack);
    if (!match) continue;

    const amount = Number(match[pattern.amountAt].replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    const counterparty = cleanName(match[pattern.nameAt] ?? '');
    if (!counterparty) continue;
    if (!matchesPartner(counterparty, partnerAliases)) {
      // A real payment, just not one between the two of them. Everything else
      // in their notification shade stays their own business.
      return null;
    }

    const postTime = notification.postTime || Date.now();
    return {
      direction: pattern.direction,
      amount,
      counterparty,
      sourcePackage: notification.packageName,
      occurredAt: new Date(postTime).toISOString(),
      dedupKey: makeDedupKey(notification.packageName, pattern.direction, amount, postTime),
    };
  }

  if (__DEV__) {
    // The capture path: a watched app said something we don't understand, and
    // this is the only place the new wording can be read off a real device.
    console.log('[payments] unmatched:', notification.packageName, JSON.stringify(haystack));
  }
  return null;
}
