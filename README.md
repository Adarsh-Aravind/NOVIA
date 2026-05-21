# 💖 NOVIA - High-Fidelity Couple's Hub

[![Expo](https://img.shields.io/badge/Expo-v54.0.0-000000?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-v0.81.5-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_Sync-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**NOVIA** is a premium, real-time synchronized couple's hub application built with **Expo**, **React Native**, and **Supabase**. It is designed with a striking, atmospheric space-inspired theme (neon orange glows and tactical visual grain filters) to deliver an engaging, smooth, and hyper-personalized co-presence experience.

Whether it's syncing your wake-up alarms, tracking menstrual health cycles, sharing notes and brainstorms, managing mutual finances, logging medical metrics, or checking off bucket list adventures, **NOVIA** keeps you and your partner perfectly aligned.

---

## ✨ Features walkthrough

### ⏰ 1. Synchronized Alarms & Coordinated Discipline
*   **Dual-User Real-time Sync**: Schedule joint wake-up alarms for both partners.
*   **Coordinated or Simultaneous Wakeups**: Select `simultaneous` (both ring at once) or `coordinated` (timed offsets or sequences) waking structures.
*   **Discipline & Punishment System**: If a partner ignores, skips, or over-snoozes their alarm, the system automatically penalizes the offender in the shared database, triggering **visual restrictions** or **fun forfeits** visible to both users!
*   **Bypasses Android DND**: Configures a high-priority Notification Channel (`alarm-channel`) on Android which, with permission, plays high-importance alerts and bypasses silent/Do-Not-Disturb configurations to guarantee synchronization.

### 📅 2. Predictive Cycle & Menstrual Tracker
*   **Smart Cycle Mathematics**: Uses historical start and end dates to calculate a running average of cycle length (sanitized for realistic 15-45 day ranges) and predict the next period, fertile window, and peak ovulation days.
*   **Dynamic Visual Phases**: Real-time indication of current menstrual phase: *Menstruation, Follicular, Ovulation,* or *Luteal*.
*   **Intimate Questionnaire**: An intimate GF Menstrual Prediction questionnaire assessing bleeding levels, physical changes (cramps, bloating), fluids, and emotional/energy patterns.
*   **Automated Partner Warnings**: Schedules silent reminders one day in advance for both partners to foster mutual support and care.

### 💬 3. Real-Time Co-Presence & Shared Notes
*   **Partner Typing Indicators**: Real-time channel integration shows when your partner is active and typing a note.
*   **Live Markdown Notes**: Shared whiteboard style digital note cards, updating instantly across devices as soon as anyone saves changes.

### 📊 4. Joint Finance Manager
*   **Subscriptions, Borrowings, & Self-Liabilities**: Categorized ledger showing who owes whom, amount, due date, and renewal cycle.
*   **Overdue & Alert System**: Flags overdue payments instantly and schedules system notifications for both partners 24 hours prior to due dates.

### 🩺 5. Medical Record Vault
*   **Blood Pressure & Blood Sugar Monitors**: Specialized validation algorithms (`validateBloodPressure`, `validateBloodSugar`) warning users of out-of-range systolic/diastolic or glucose readings.
*   **Hospital Visit Tracker**: Historical record of visits, reasons, medical outcomes, and attachments securely referenced via Supabase.

### ✈️ 6. Shared Couple's Bucket List
*   **Categorized Dreams**: Travel, fine dining, adventure, and learning tabs.
*   **Interactive Micro-Animations**: Features custom animated rows with blinking visual feedback when items are marked completed.

### 🚨 7. Offline First-Aid Guide
*   **Quick Search**: Fully offline search engine with a curated list of emergency medical guidelines (e.g., choking, burns, fractures, CPR).

---

## 🛠️ Technology Stack

*   **Framework**: Expo (SDK 54) & React Native CLI (TypeScript based)
*   **Database & Sync**: Supabase (PostgreSQL with Realtime WebSockets, row-level security, and triggers)
*   **Styling & UI**: Vanilla React Native StyleSheet with high-fidelity `react-native-svg` atmospheric shaders and a custom fractal grain noise filter overlay
*   **Local Storage**: `@react-native-async-storage/async-storage`
*   **Icons**: `lucide-react-native`
*   **Notification Engine**: `expo-notifications` (running background fetch routines via `expo-task-manager` and `expo-background-fetch`)

---

## 🗄️ Database Architecture

The backend database runs on **Supabase (Postgres)**. Below is a visual representation of how the tables interact under Row Level Security (RLS) policies:

```mermaid
erDiagram
    COUPLES {
        uuid id PK
        uuid user_1_id FK
        uuid user_2_id FK
        timestamptz created_at
    }
    PROFILES {
        uuid id PK
        uuid couple_id FK
        text display_name
        text avatar_url
        uuid partner_id FK
        text current_mood
        timestamptz mood_updated_at
    }
    REMINDERS {
        uuid id PK
        uuid couple_id FK
        text title
        text category
        timestamptz due_date
        boolean is_completed
        text recurrence
        jsonb metadata
        uuid created_by FK
    }
    ALARMS {
        uuid id PK
        uuid couple_id FK
        text purpose
        time alarm_time
        int_array days_active
        boolean is_enabled
        text sync_mode
        text user_1_status
        text user_2_status
        int snooze_count_1
        int snooze_count_2
    }
    PUNISHMENTS {
        uuid id PK
        uuid couple_id FK
        uuid offender_id FK
        text source
        text penalty_type
        text description
        boolean is_active
    }
    NOTES {
        uuid id PK
        uuid couple_id FK
        text content
        uuid created_by FK
        uuid updated_by FK
    }
    FINANCES {
        uuid id PK
        uuid couple_id FK
        text type
        text item_name
        numeric amount
        uuid lender_id FK
        uuid borrower_id FK
        timestamptz due_date
        text status
    }
    PERIODS {
        uuid id PK
        uuid couple_id FK
        date start_date
        date end_date
        text_array symptoms
        text notes
    }
    BUCKET_LIST {
        uuid id PK
        uuid couple_id FK
        text category
        text title
        text description
        boolean is_completed
        uuid completed_by FK
    }

    COUPLES ||--o{ PROFILES : "links"
    COUPLES ||--o{ REMINDERS : "belongs_to"
    COUPLES ||--o{ ALARMS : "belongs_to"
    COUPLES ||--o{ PUNISHMENTS : "belongs_to"
    COUPLES ||--o{ NOTES : "belongs_to"
    COUPLES ||--o{ FINANCES : "belongs_to"
    COUPLES ||--o{ PERIODS : "belongs_to"
    COUPLES ||--o{ BUCKET_LIST : "belongs_to"
    PROFILES ||--o{ PUNISHMENTS : "commits"
```

### 🔒 Row-Level Security (RLS) & Multi-Tenancy
All data is secured at the database layer using Postgres RLS policies. 

1.  **Couple-scoped security**: The database provides a secure helper function `public.get_couple_id()` that extracts the current active couple partition:
    ```sql
    CREATE OR REPLACE FUNCTION public.get_couple_id()
    RETURNS UUID AS $$
        SELECT couple_id FROM public.profiles WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER;
    ```
2.  **Access Policies**: The shared tables (Notes, Alarms, Finances, Periods, Bucket List, Reminders) restrict read/write access to only users matching the partner couple ID:
    ```sql
    CREATE POLICY "Allow access to couple data"
        ON public.reminders FOR ALL
        USING (couple_id = public.get_couple_id());
    ```
3.  **Automatic Profile Creation Trigger**: An auth trigger is installed so that whenever a user signs up through Supabase Auth, a corresponding row in the public `profiles` table is automatically provisioned:
    ```sql
    CREATE OR REPLACE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    ```

---

## 🚀 Setup & Installation

### 📋 Prerequisites
*   [Node.js](https://nodejs.org/) (v18+ recommended)
*   [Git](https://git-scm.com/)
*   A [Supabase](https://supabase.com/) account and project.

### 📦 1. Clone & Install Dependencies
```bash
git clone https://github.com/Adarsh-Aravind/NOVIA.git
cd NOVIA
npm install
```

### ⚙️ 2. Environment Configuration
Create a `.env` file in the root directory and add your Supabase credentials. Use `.env.example` as a reference:
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anonymous-key
```

### 🗃️ 3. Database Migration (Supabase)
1.  Go to your **Supabase Dashboard** -> **SQL Editor**.
2.  Paste the contents of the `schema.sql` file located in the root of this project.
3.  Click **Run** to execute and initialize all tables, RLS policies, custom helper functions, auth triggers, and database performance indexes.

### 📱 4. Run Locally
Start the Expo development server:
```bash
npm run start
```
*   Press `a` to run on an Android emulator or connected device.
*   Press `i` to run on an iOS simulator.
*   Scan the QR code with the **Expo Go** app (Android) or Camera app (iOS) to test on a physical device.

---

## 📁 Codebase Directory Structure

```
├── .expo/               # Expo cache and system configuration
├── assets/              # Static media resources and adaptive icons
├── src/
│   ├── constants/       # App themes, styling variables, and offline first aid database
│   ├── hooks/           # Custom React hooks (real-time notes, alarms, period cycle math)
│   ├── services/        # Background tasks, Expo push notifications, and Supabase client
│   ├── types/           # Core TypeScript type definitions and interfaces
│   └── utils/           # Helper calculations, blood pressure/sugar validators, and debouncers
├── App.tsx              # Core app component housing all navigations, states, and tab views
├── app.json             # Expo native app manifestation configurations
├── eas.json             # Expo Application Services configuration for cloud builds
├── schema.sql           # Complete SQL script for database setup on Supabase
└── tsconfig.json        # TypeScript compiler configurations
```

---

## 🤝 Contributing & Authors

*   **Developer/Author**: Adarsh Aravind
*   **GitHub**: [@Adarsh-Aravind](https://github.com/Adarsh-Aravind)

Feel free to fork this project, submit issue reports, or open pull requests to expand NOVIA's features!
