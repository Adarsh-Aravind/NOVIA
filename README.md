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
- **Detected Payments** — money moving between the two of them, read off the bank's own SMS and logged without anyone entering anything. Android only.
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

## Detected Payments

The old finance module asked two people to bookkeep their own relationship, and
they didn't. This one asks for nothing: it reads what the bank already tells
them and shows it back.

**Two sources, either one sufficient.** Both partners bank with Kotak, which
texts every UPI transfer, so **SMS is the primary signal** — `RECEIVE_SMS` is an
ordinary runtime permission (one dialog), it fires whether or not the messaging
app's notifications are on, and it delivers the whole message rather than
whatever a collapsed notification happened to show. A `NotificationListenerService`
covers the second case, transfers a payment app announces but the bank doesn't
text about; that one needs a trip to Settings → Notification access, because
`BIND_NOTIFICATION_LISTENER_SERVICE` has no permission dialog.

Both live in [`modules/notification-listener`](modules/notification-listener), a
**local Expo module** rather than a dependency. The community packages for this
are functionally abandoned and will not compile against RN 0.81 — no `namespace`
in their `android/build.gradle` (AGP 8 hard-fails) and a `com.facebook.react`
coordinate that RN 0.71 replaced. The service and receiver are declared in the
module's *own* `AndroidManifest.xml` so AGP's merger folds them into the app;
Continuous Native Generation rewrites `android/` on every build, so nothing
hand-written there would survive.

**Parsing lives in JavaScript, deliberately.** The wording of these messages is
not a contract, and a pattern that silently stops matching produces the worst
failure available: a feed that looks fine and is quietly missing payments.
Keeping [`paymentParser.ts`](src/utils/paymentParser.ts) on the JS side means a
fix ships over the air in minutes rather than as a native build. Unmatched
messages from a watched source are logged in development, which is how a new
wording gets captured off a real device.

**Nothing raw is stored or sent.** Kotlin applies one crude filter — the text
must contain an amount — so one-time codes and conversations are never written
to the queue at all. What survives is parsed on the device, and only the parsed
fields (direction, amount, counterparty, time, source) reach Supabase. The
message itself never leaves the phone.

**Deduplication happens in two places, for two different problems.** The same
device can be handed the same notification twice (a payment app updating it in
place), which a `dedup_key` of source + amount + minute collapses. The harder
case is that *both* phones witness one payment from opposite sides — his "Sent
Rs.20 to GAYATHRI UDAYAN" and her "Received Rs.20 from ADARSH ARAVIND" are one
event. That can't be solved by a shared key: the two texts land seconds apart,
routinely straddle a minute boundary, and the phones' clocks need not agree. So
`record_transaction()` does it server-side under a per-couple advisory lock,
merging only a row from the *other* partner, in the *opposite* direction, for
the same amount, within 90 seconds. Two genuine payments of the same amount in
the same direction are never collapsed.

One consequence to know when reading the code: only one of the two observations
survives, so a stored `direction` may be the *partner's* point of view.
`directionFor()` flips it for whoever is reading.

**Reliability is the other half.** Samsung's "put unused apps to sleep" will
deep-sleep the app after a few idle days and stop delivery with no error
surfaced anywhere, so the screen checks for a battery exemption and offers to
request one.

**Names are configurable.** A payment shows whatever name the bank holds —
"GAYATHRI  UDAYAN" against a profile that says "Gayathri" — so matching accepts
any shared token of three or more characters, and the screen lets the user add
the spellings their bank actually uses. The generosity runs one way only:
missing a payment is recoverable, putting a stranger's transfer into a couple's
shared feed is not.

## Project Structure

```text
App.tsx               # every screen and the StyleSheet — the app is one component tree
index.ts              # registerRootComponent
schema.sql            # full database: tables, RLS policies, RPCs, realtime publication
supabase/migrations/  # incremental migrations to run against an existing project
plugins/              # local Expo config plugins (Health Connect permission delegate)
modules/              # local native modules (Android notification + SMS listener)
src/
├── components/common/  # Skeleton, HubSkeleton, GlassCard, StepGraph
├── constants/          # theme (colour, material, type), motion, vocabulary
├── hooks/              # Supabase data + auth hooks, one per feature
├── services/           # notifications, OTA updates, encrypted session storage
├── types/              # database row shapes
└── utils/              # pure helpers — cycle and milestone maths, payment parsing
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

`supabase/migrations/20260911_transactions.sql` adds the detected-payments table
and its `record_transaction()` write path. It is idempotent, so it is safe to
re-run. The old `finances` table is deliberately left in place — it holds real
records, and dropping it is a data decision, not a code cleanup.

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

`runtimeVersion` is pinned to a literal in `app.json`, so **nothing bumps it for you**. Raise it by hand in the same commit as any native change, or an OTA published afterwards will be served to older installs that lack the new module. It is at `2` as of the notification/SMS listener; installs still on `1` keep the last bundle that ran without it.

<3
