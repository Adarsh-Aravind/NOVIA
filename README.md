# NOVIA

<p align="center">
  <a href="https://github.com/Adarsh-Aravind/NOVIA">
    <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=400&size=24&pause=1000&color=FF6A00&center=true&vCenter=true&width=500&lines=The+Ultimate+App+for+Couples;Stay+Connected;Track+Milestones;Grow+Together" alt="Typing SVG" />
  </a>
</p>

NOVIA (Noviris) is a React Native application built for two people — a shared surface for staying connected, organised and a little bit competitive.

## System Architecture

- **Frontend:** React Native 0.81 on Expo SDK 54, New Architecture enabled.
- **Backend:** Supabase — PostgreSQL for relational data, Row Level Security for access control, and Realtime for cross-device sync.
- **Deployment:** EAS builds the native binaries; JavaScript-only changes ship over the air without a reinstall.

**Platform note:** the app runs on both platforms, but the Step Duel depends on Health Connect, which is Android-only. On iOS that card degrades to an "unavailable" state and everything else works. Native modules are loaded through guarded `require`s specifically so a build that lacks them fails soft instead of white-screening.

## Core Features

- **Step Duel** — a daily step competition sourced from Health Connect, with a seven-day comparison graph, a quarterly season tally, win streaks, and a shared forfeit the season's loser owes.
- **Relationship Milestones** — anniversaries and one-off dates, with day-of and day-before local notifications on both devices.
- **Daily Check-ins** — a shared mood and gratitude log with streaks visible to both partners.
- **Complaint Threads** — a structured, realtime channel for working through disagreements.
- **Shared Notes** — a realtime note grid with emoji reactions and a live typing indicator.
- **Shared Tasks** — a synchronised todo list with recurrence and reminders on both phones.
- **Finance Tracking** — dual-party expense tracking for subscriptions and borrowings.
- **Cycle Tracking** — predictive period and ovulation modelling with phase-aware guidance.
- **Ideas & Chat** — a Groq-backed assistant. A free-form chat tab, plus an idea generator reachable from the notes composer whose suggestions save straight to a shared note. It sends only what you type: no moods, check-ins, cycle data or step history ever leave the device through it.
- **Vocabulary Builder** — a word a day, delivered by notification.

## Design System

The visual language lives in [`src/constants/theme.ts`](src/constants/theme.ts) and [`src/constants/motion.ts`](src/constants/motion.ts). Both are documented inline; the short version:

**One accent, on black.** Neon orange `#FF6A00` is the only chromatic colour in the app — everything else is a warm neutral drawn from the eight-step `INK` ramp. The discipline is the point: orange always means "this is the thing that matters".

The consequence to design around is that **hue can no longer carry meaning**. Success, warning and danger are not green/amber/red. States are separated by *intensity* instead, backed by icons and explicit wording wherever the distinction matters. Intensity also survives greyscale and colour-vision deficiency, which a five-hue scale does not.

**Materials are dark scrims, not light tints.** `THEME.material.*` composes fill, rim and graded shadow into one spread across four tiers (`thin` / `regular` / `thick` / `chrome`, plus `well` for carved surfaces). They *dim* what sits behind them rather than lightening it — a light tint over the backdrop's orange corner burn turns the card orange and drops accent text to 1.92:1.

**The assistant needs a key.** `EXPO_PUBLIC_GROQ_API_KEY` in `.env` — see [console.groq.com](https://console.groq.com). Note that `EXPO_PUBLIC_*` values are compiled into the JS bundle and readable by anyone who unzips the APK, so this is fine for a free-tier key (the exposure is rate-limit abuse) and not fine for a paid one. Put a server-side proxy in front before spending real money through it. Env vars are read when the bundler **starts**, so adding one means restarting Metro, not just reloading the app.

**Motion is springs, not durations.** `SPRING.*` encodes Apple's two-parameter model (damping ratio + response) converted to React Native's `stiffness`/`damping`/`mass`. Springs animate from wherever a value currently *is*, so they can be re-targeted mid-flight; a fixed-duration curve restarts from the head of its easing and visibly stutters. Bounce is reserved for motion a gesture actually threw.

Reduced motion is honoured throughout via [`useReducedMotion`](src/hooks/useReducedMotion.ts).

## Project Structure

```text
App.tsx               # every screen and the StyleSheet — the app is one component tree
index.ts              # registerRootComponent
schema.sql            # full database: tables, RLS policies, RPCs, realtime publication
supabase/migrations/  # incremental migrations to run against an existing project
plugins/              # local Expo config plugins (Health Connect permission delegate)
src/
├── components/common/  # Skeleton, HubSkeleton, GlassCard, StepGraph
├── constants/          # theme (colour, material, type), motion, vocabulary
├── hooks/              # Supabase data + auth hooks, one per feature
├── services/           # notifications, OTA updates, encrypted session storage
├── types/              # database row shapes
└── utils/              # pure helpers — cycle, finance and milestone maths
```

## Local Development

### Prerequisites

- Node.js 18+
- A configured Supabase project
- An EAS account (`npx eas-cli login`)

### Setup

```bash
git clone https://github.com/Adarsh-Aravind/NOVIA.git
cd NOVIA
npm install
cp .env.example .env      # then fill in your Supabase URL + publishable key
cp eas.example.json eas.json
```

Use the **publishable** (or legacy `anon`) key — never the `service_role` key, which bypasses Row Level Security and would give anyone holding the APK full access to the database.

### Database

Run [`schema.sql`](schema.sql) against a fresh project, or apply the files in `supabase/migrations/` to an existing one.

**Don't skip the realtime publication.** Every `postgres_changes` subscription requires its table to be a member of `supabase_realtime`. Without membership the client subscribes *successfully* and then receives nothing — a dead feed that is indistinguishable from a working one. `schema.sql` publishes every subscribed table; `supabase/migrations/20260910_step_realtime.sql` repairs an existing project.

### Running it

Expo Go will not work — the app links native modules it doesn't ship. You need a development build:

```bash
npx eas-cli build --platform android --profile development
adb install -r <the downloaded apk>
adb reverse tcp:8081 tcp:8081        # so the device can reach Metro over USB
npx expo start --dev-client
```

The dev build shares its package name with production, so it replaces the release app on that device.

## Deployment & Updates

### Over-the-air

JavaScript, styling and business-logic changes ship straight to installed clients:

```bash
eas update --channel production --message "Describe changes here"
```

### Native builds

Anything touching native code — a new native dependency, an `app.json` plugin, a build-properties change — needs a fresh binary:

```bash
eas build --platform android --profile production
```

`runtimeVersion` is pinned to a literal in `app.json`, so **nothing bumps it for you**. Raise it by hand in the same commit as any native change, or an OTA published afterwards will be served to older installs that lack the new module.

<3
