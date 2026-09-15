/**
 * Fictional starting data for the demo build.
 *
 * Every name, note and amount here is invented. Dates are generated relative to
 * the moment the app starts, so the demo always looks lived-in — a step season
 * in progress, a cycle prediction ahead, an anniversary coming up — no matter
 * when someone installs it.
 */

export const DEMO_USER_ID = '00000000-0000-4000-8000-00000000a1e1';
export const DEMO_PARTNER_ID = '00000000-0000-4000-8000-00000000b0b2';
export const DEMO_COUPLE_ID = '00000000-0000-4000-8000-00000000c0c3';

export const DEMO_EMAIL = 'alex@demo.novia';

type Row = Record<string, any>;

const DAY_MS = 86_400_000;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Midnight today, local, shifted by whole days. */
function dayOffset(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

/** A timestamp `days` ago at a given local hour and minute. */
function at(days: number, hour: number, minute = 0): string {
  const d = dayOffset(-days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Deterministic noise, so the step graph is the same on every launch. */
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Steps the demo user has "walked" so far today — climbs through the day. */
export function demoTodaySteps(now = new Date()): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  const walkingHours = Math.max(0, Math.min(hours - 7, 14));
  return Math.round(walkingHours * 610 + 180);
}

function quarterStart(now = new Date()): Date {
  return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
}

function stepRows(): Row[] {
  const rows: Row[] = [];
  const start = quarterStart();
  const today = dayOffset(0);
  const days = Math.round((today.getTime() - start.getTime()) / DAY_MS);

  for (let i = days; i >= 1; i--) {
    const date = isoDate(dayOffset(-i));
    const weekend = [0, 6].includes(dayOffset(-i).getDay());
    const mine = Math.round(5200 + noise(i) * 6800 + (weekend ? 1800 : 0));
    const theirs = Math.round(5600 + noise(i + 101) * 6400 + (weekend ? 1200 : 0));
    rows.push(
      { couple_id: DEMO_COUPLE_ID, user_id: DEMO_USER_ID, step_date: date, steps: mine },
      { couple_id: DEMO_COUPLE_ID, user_id: DEMO_PARTNER_ID, step_date: date, steps: theirs }
    );
  }

  // The partner has synced part of today; the demo user's own number arrives
  // through the step hook, as it would from Health Connect.
  const partnerToday = Math.max(0, demoTodaySteps() - 740);
  rows.push({
    couple_id: DEMO_COUPLE_ID,
    user_id: DEMO_PARTNER_ID,
    step_date: isoDate(today),
    steps: partnerToday,
  });
  return rows;
}

function periodRows(): Row[] {
  return [4, 32, 60].map((ago, i) => ({
    couple_id: DEMO_COUPLE_ID,
    start_date: isoDate(dayOffset(-ago)),
    end_date: isoDate(dayOffset(-ago + 5)),
    cycle_length_override: null,
    symptoms: i === 0 ? ['Cramps', 'Fatigue'] : i === 1 ? ['Headache'] : [],
    notes: i === 0 ? 'Hot water bottle and an early night.' : null,
    created_at: at(ago, 9),
  }));
}

/** Seed tables, keyed by table name. Ids and timestamps are filled in by the store. */
export function buildSeed(): Record<string, Row[]> {
  const quarterKey = `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`;
  const anniversary = dayOffset(12);
  anniversary.setFullYear(anniversary.getFullYear() - 3);

  return {
    profiles: [
      {
        id: DEMO_USER_ID,
        couple_id: DEMO_COUPLE_ID,
        display_name: 'Alex',
        avatar_url: null,
        partner_id: DEMO_PARTNER_ID,
        current_mood: 'Happy',
        mood_updated_at: at(0, 8, 10),
        updated_at: at(0, 8, 10),
      },
      {
        id: DEMO_PARTNER_ID,
        couple_id: DEMO_COUPLE_ID,
        display_name: 'Sam',
        avatar_url: null,
        partner_id: DEMO_USER_ID,
        current_mood: 'Loved',
        mood_updated_at: at(0, 7, 45),
        updated_at: at(0, 7, 45),
      },
    ],

    notes: [
      {
        couple_id: DEMO_COUPLE_ID,
        content: 'Picked up the plant you liked from the market. It is on the balcony, go say hi.',
        created_by: DEMO_PARTNER_ID,
        updated_by: DEMO_PARTNER_ID,
        created_at: at(0, 9, 20),
        updated_at: at(0, 9, 20),
        reactions: { [DEMO_USER_ID]: '❤️' },
      },
      {
        couple_id: DEMO_COUPLE_ID,
        content: 'Groceries: oat milk, basil, lemons, the good bread.',
        created_by: DEMO_USER_ID,
        updated_by: DEMO_USER_ID,
        created_at: at(1, 18, 5),
        updated_at: at(1, 18, 5),
        reactions: {},
      },
      {
        couple_id: DEMO_COUPLE_ID,
        content: 'Movie night list: the space one, the heist one, anything with subtitles.',
        created_by: DEMO_PARTNER_ID,
        updated_by: DEMO_PARTNER_ID,
        created_at: at(3, 21, 40),
        updated_at: at(3, 21, 40),
        reactions: { [DEMO_USER_ID]: '😂' },
      },
    ],

    todos: [
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Book tickets for the weekend trip',
        notes: 'Train, not bus this time.',
        due_at: at(-1, 19),
        recurrence: 'once',
        is_completed: false,
        created_by: DEMO_USER_ID,
      },
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Water the plants',
        notes: null,
        due_at: at(-2, 8),
        recurrence: 'weekly',
        is_completed: false,
        created_by: DEMO_PARTNER_ID,
      },
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Pay the internet bill',
        notes: null,
        due_at: at(2, 10),
        recurrence: 'monthly',
        is_completed: true,
        created_by: DEMO_USER_ID,
      },
    ],

    complaints: [
      {
        couple_id: DEMO_COUPLE_ID,
        created_by: DEMO_PARTNER_ID,
        title: 'The thermostat war',
        body: 'Someone keeps setting it to arctic. Proposing a truce at 24°.',
        status: 'open',
        created_at: at(2, 22, 15),
        updated_at: at(1, 8, 0),
      },
      {
        couple_id: DEMO_COUPLE_ID,
        created_by: DEMO_USER_ID,
        title: 'Last slice of cake',
        body: 'It was labelled. It had my name on it.',
        status: 'resolved',
        created_at: at(9, 20, 0),
        updated_at: at(8, 12, 0),
      },
    ],

    complaint_replies: [],

    milestones: [
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Anniversary',
        milestone_date: isoDate(anniversary),
        recurrence: 'yearly',
        emoji: '💍',
        created_by: DEMO_USER_ID,
      },
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Sam’s birthday',
        milestone_date: `1996-${isoDate(dayOffset(47)).slice(5)}`,
        recurrence: 'yearly',
        emoji: '🎂',
        created_by: DEMO_USER_ID,
      },
      {
        couple_id: DEMO_COUPLE_ID,
        title: 'Moved in together',
        milestone_date: isoDate(dayOffset(-400)),
        recurrence: 'yearly',
        emoji: '🏡',
        created_by: DEMO_PARTNER_ID,
      },
    ],

    periods: periodRows(),

    step_counts: stepRows(),

    step_forfeits: [
      {
        couple_id: DEMO_COUPLE_ID,
        period_key: quarterKey,
        forfeit: 'Loser cooks breakfast every Sunday next quarter.',
        set_by: DEMO_PARTNER_ID,
      },
    ],

    transactions: [
      { direction: 'sent', amount: 450, counterparty: 'Sam', source_package: 'android.sms', days: 0, hour: 13 },
      { direction: 'received', amount: 1200, counterparty: 'Sam', source_package: 'com.google.android.apps.nbu.paisa.user', days: 1, hour: 20 },
      { direction: 'sent', amount: 89, counterparty: 'Sam', source_package: 'com.phonepe.app', days: 3, hour: 9 },
      { direction: 'received', amount: 2500, counterparty: 'Sam', source_package: 'android.sms', days: 6, hour: 18 },
    ].map((t, i) => ({
      couple_id: DEMO_COUPLE_ID,
      user_id: DEMO_USER_ID,
      direction: t.direction,
      amount: t.amount,
      counterparty: t.counterparty,
      source_package: t.source_package,
      occurred_at: at(t.days, t.hour, 12),
      dedup_key: `demo-${i}`,
      created_at: at(t.days, t.hour, 12),
    })),

    bucket_list: [
      {
        couple_id: DEMO_COUPLE_ID,
        category: 'traveling',
        title: 'See the northern lights',
        description: 'Somewhere cold, with a very good jacket.',
        created_by: DEMO_PARTNER_ID,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        created_at: at(20, 12),
      },
      {
        couple_id: DEMO_COUPLE_ID,
        category: 'fine_dining',
        title: 'Tasting menu night',
        description: null,
        created_by: DEMO_USER_ID,
        is_completed: true,
        completed_at: at(14, 22),
        completed_by: DEMO_USER_ID,
        created_at: at(40, 12),
      },
      {
        couple_id: DEMO_COUPLE_ID,
        category: 'adventure',
        title: 'Learn to scuba dive',
        description: null,
        created_by: DEMO_USER_ID,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        created_at: at(11, 12),
      },
      {
        couple_id: DEMO_COUPLE_ID,
        category: 'learning',
        title: 'Take a pottery class together',
        description: null,
        created_by: DEMO_PARTNER_ID,
        is_completed: false,
        completed_at: null,
        completed_by: null,
        created_at: at(5, 12),
      },
    ],

    medical_vault: [
      {
        user_id: DEMO_PARTNER_ID,
        metric_type: 'hospital_visit',
        value_json: { reason: 'Annual check-up', test_results: 'All clear. Vitamin D slightly low.' },
        record_date: at(25, 11),
        attachments: [],
        notes: null,
      },
    ],

    app_updates: [
      {
        version: 'demo',
        title: 'Welcome to the NOVIA demo',
        body: 'Everything here is fictional and lives only on this phone. Add, edit and delete freely — it resets when the app restarts.',
        created_at: at(0, 6),
      },
    ],
  };
}
