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

export interface SharedNote {
  id: string;
  couple_id: string;
  content: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface Brainstorm {
  id: string;
  couple_id: string;
  category: 'todo' | 'study' | 'date_ideas';
  title: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface FinanceItem {
  id: string;
  couple_id: string;
  type: 'subscription' | 'borrowing';
  item_name: string;
  amount: number;
  lender_id: string | null;
  borrower_id: string | null;
  due_date: string;
  renewal_cycle: 'monthly' | 'yearly' | 'none';
  status: 'pending' | 'paid' | 'overdue';
  /** Personal debt — owned by created_by, excluded from shared/settlement math. */
  is_self_liability: boolean;
  last_paid_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
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

export interface DietLog {
  id: string;
  user_id: string;
  log_date: string;
  calories: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_description: string | null;
  created_at: string;
}

export interface SleepLog {
  id: string;
  user_id: string;
  log_date: string;
  sleep_time: string;
  wake_time: string;
  duration_minutes: number;
  quality_rating: number;
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

export interface PartnerLocation {
  user_id: string;
  couple_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  place_label: string | null;
  updated_at: string;
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
