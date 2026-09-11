export interface Couple {
  id: string;
  user_1_id: string;
  user_2_id: string;
  created_at: string;
}

export interface Profile {
  id: string;
  couple_id: string | null;
  display_name: string;
  avatar_url: string | null;
  partner_id: string | null;
  current_mood: string;
  mood_updated_at: string;
  updated_at: string;
}

export type TodoRecurrence = 'once' | 'weekly' | 'monthly' | 'yearly';

export interface Todo {
  id: string;
  couple_id: string;
  title: string;
  notes: string | null;
  due_at: string; // ISO timestamp — chosen reminder time / first fire
  recurrence: TodoRecurrence;
  is_completed: boolean;
  created_by: string;
  created_at: string;
}

export interface Complaint {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  body: string;
  status: 'open' | 'resolved';
  created_at: string;
  updated_at: string;
}

export interface ComplaintReply {
  id: string;
  complaint_id: string;
  couple_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface AppUpdate {
  id: string;
  version: string;
  title: string;
  body: string;
  created_at: string;
}

export type MilestoneRecurrence = 'yearly' | 'monthly' | 'once';

export interface Milestone {
  id: string;
  couple_id: string;
  title: string;
  milestone_date: string; // 'YYYY-MM-DD' — the original date
  recurrence: MilestoneRecurrence;
  emoji: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StepCount {
  id: string;
  couple_id: string;
  user_id: string;
  step_date: string; // 'YYYY-MM-DD'
  steps: number;
  created_at: string;
  updated_at: string;
}

export interface StepForfeit {
  id: string;
  couple_id: string;
  period_key: string; // calendar quarter, e.g. '2026-Q3'
  forfeit: string;
  set_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedNote {
  id: string;
  couple_id: string;
  content: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  /** Map of userId -> emoji. Each partner has at most one reaction per note. */
  reactions?: Record<string, string>;
}


/**
 * One payment observed by the notification listener.
 *
 * Only parsed fields are stored — never the raw notification text, which is
 * sensitive and would be replicated to Supabase verbatim.
 *
 * Both phones see the same payment from opposite sides ("you paid X" on one,
 * "received from Y" on the other), so `dedup_key` is derived from the amount
 * and a minute bucket and carries a couple-unique constraint. Whichever device
 * inserts first wins; the other's insert is swallowed as a conflict.
 */
export interface Transaction {
  id: string;
  couple_id: string;
  /** The device that observed it — not necessarily the payer. */
  user_id: string;
  /** Relative to the observing device's owner. */
  direction: 'sent' | 'received';
  amount: number;
  /** The other party's name as the payment app rendered it. */
  counterparty: string;
  /** Android package that posted the notification, e.g. Google Pay. */
  source_package: string;
  occurred_at: string;
  dedup_key: string;
  created_at: string;
}

export interface PeriodRecord {
  id: string;
  couple_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string | null;
  cycle_length_override: number | null;
  symptoms: string[];
  notes: string | null;
  created_at: string;
}



export interface MedicalRecord {
  id: string;
  user_id: string;
  metric_type: 'height' | 'weight' | 'blood_group' | 'blood_pressure' | 'blood_sugar' | 'hospital_visit';
  value_json: any; // e.g. { systolic: number, diastolic: number }
  record_date: string;
  attachments: string[];
  notes: string | null;
  created_at: string;
}


export interface BucketListItem {
  id: string;
  couple_id: string;
  category: 'traveling' | 'fine_dining' | 'adventure' | 'learning';
  title: string;
  description: string | null;
  created_by: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}
