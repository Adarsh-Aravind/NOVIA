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

export interface Reminder {
  id: string;
  couple_id: string;
  title: string;
  category: 'face_care' | 'shaving' | 'birthday' | 'habit' | 'document_renewal';
  due_date: string;
  is_completed: boolean;
  recurrence: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none';
  metadata: {
    document_type?: string;
    days_warning?: number[];
    has_alarm?: boolean;
    alarm_time?: string;
  };
  created_by: string;
  created_at: string;
}

export interface Alarm {
  id: string;
  couple_id: string;
  purpose: string | null;
  alarm_time: string; // "HH:MM:SS"
  days_active: number[]; // 0-6
  is_enabled: boolean;
  sync_mode: 'simultaneous' | 'coordinated';
  last_fired: string | null;
  user_1_status: 'idle' | 'ringing' | 'snoozed' | 'dismissed' | 'failed';
  user_2_status: 'idle' | 'ringing' | 'snoozed' | 'dismissed' | 'failed';
  snooze_count_1: number;
  snooze_count_2: number;
  updated_at: string;
}

export interface Punishment {
  id: string;
  couple_id: string;
  offender_id: string;
  source: 'alarm_skip' | 'repayment_missed';
  penalty_type: 'visual_restriction' | 'penalty_status' | 'forfeit';
  description: string;
  is_active: boolean;
  created_at: string;
  resolved_at: string | null;
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
  created_by: string | null;
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
