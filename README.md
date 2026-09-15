# NOVIA

<p align="center">
  <a href="https://github.com/Adarsh-Aravind/NOVIA">
    <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=400&size=24&pause=1000&color=FF6A00&center=true&vCenter=true&width=500&lines=The+Ultimate+App+for+Couples;Stay+Connected;Track+Milestones;Grow+Together" alt="Typing SVG" />
  </a>
</p>

NOVIA (Noviris) is a private Android app for two people. It's one shared space where a couple keeps notes, plans, dates, health and money in sync, and competes a little along the way.

Everything one partner does shows up on the other's phone within a second or two, and reminders fire on both phones.

> **Try it without an account.** A demo APK with made-up data, no backend and no API keys is on the [releases page](https://github.com/Adarsh-Aravind/NOVIA/releases/latest). See [Demo Build](#demo-build).

## Contents

- [Features at a Glance](#features-at-a-glance)
- [Feature Guide](#feature-guide)
- [Notifications](#notifications)
- [Privacy & Security](#privacy--security)
- [System Architecture](#system-architecture)
- [Design System](#design-system)
- [Detected Payments](#detected-payments) · [Profile Pictures](#profile-pictures)
- [Project Structure](#project-structure) · [Local Development](#local-development)
- [Demo Build](#demo-build) · [Deployment & Updates](#deployment--updates)

## Features at a Glance

| Feature | What it does | Where |
| --- | --- | --- |
| **Right Now** | Share how you feel, see your partner's mood, and get advice on how to respond | Hub |
| **Step Duel** | A daily step race from Health Connect, with a 7-day graph, quarterly season, win streaks and a forfeit | Hub |
| **On This Day** | Anniversaries and milestones landing today, plus what's coming up | Hub |
| **Shared Notes** | A live note grid with emoji reactions and a typing indicator | Notes tab |
| **Detected Payments** | Money sent between you, read from bank texts. Nothing to enter by hand | Payments tab |
| **Chat & Ideas** | An AI assistant for questions, plus a date and gift idea generator | AI tab |
| **Cycle Tracking** | Period, fertile window and ovulation predictions with a symptom check-in | Health tab |
| **Hospital Visit Log** | A shared record of visits, reasons and test results | Health tab |
| **Shared Todos** | One list with reminders on both phones, one-off or repeating | Hub → Todo List |
| **Milestones** | Anniversaries and dates, repeating yearly or monthly, with reminders | Hub → Milestones |
| **Complaint Box** | Raise an issue, talk it through in replies, and mark it resolved | Hub → Complaint Box |
| **Bucket List** | Experiences you want to share, ticked off together | Hub → Bucket List |
| **Word of the Day** | A new word each morning, by notification and on the hub | Hub |
| **Profile & Pairing** | Profile picture, display name, sync-key pairing and an in-app changelog | Menu |

## Feature Guide

### Hub

The home screen. It opens with a time-of-day greeting and your profile picture. Tap the picture to change or remove it. The cards below it are:

- **Right Now.** Your partner's current mood, with a short suggestion for what to do about it. For example, when they're *Overwhelmed* it suggests taking over the pending chores and saving serious conversations for later. Below it you set your own mood: *Happy*, *Overwhelmed*, *Exhausted* or *Low Energy*. The change reaches your partner instantly. When they're writing a note, a *"Companion is active in shared notes..."* line appears here too.
- **Step Duel.** Your steps against theirs for today, with a seven-day comparison graph. It also shows:
  - **Streak:** who has won the most days in a row.
  - **Season:** a tally of daily wins for the calendar quarter, with the days left.
  - **Stakes:** a forfeit the season's loser owes, such as "loser cooks dinner for a week". Either partner can set or edit it.

  Your own steps come from Health Connect. Access is requested only when you tap, never automatically at launch. The duel refreshes when the app comes to the front and every minute while it's open.
- **On This Day.** Milestones that fall today, with how long ago they started (for example "3 years"), then the next month's upcoming ones. There's a link to manage them.
- **Cycle.** A summary showing the current phase, cycle day, days until the next period, average cycle length and a progress bar. It links to the full tracker.
- **Shortcuts** to Todo List, Complaint Box, Bucket List, Milestones, and Health & Cycle.
- **Word of the Day.** Today's word and its meaning, on one line.

### Shared Notes

A grid of notes both partners can write in and read.

- **Live.** A new note appears on the other phone without refreshing.
- **Reactions.** Each partner can put one reaction on a note: ❤️ 😂 👍 🥺 🔥. Tapping the same one again removes it.
- **Typing indicator.** While you write, your partner's hub shows that you're active.
- The composer menu opens **Get ideas from AI**. Any idea it gives can be saved as a note with one tap.

### Detected Payments

A feed of money moving between the two of you, grouped by day, with direction (sent or received), amount, the other person's name and the source (Bank SMS, Google Pay, PhonePe, Paytm, PayPal or SBI). Nobody types anything in.

- **Setup is one tap.** *Allow payment texts* grants SMS access. There's also an option to watch payment-app notifications instead, through Settings → Notification access.
- **Match names.** Banks often show a longer or differently spelled name than the profile ("PRIYA SHARMA" instead of "Priya"). *Match names* on the Payments screen lets you add the spellings your bank uses.
- **Battery warning.** If battery saving could put the app to sleep and stop detection, a banner offers to exempt it.
- **Only the parsed details are stored:** amount, direction, name, time and source. The text itself never leaves the phone.

Android only. The full design is in [Detected Payments](#detected-payments) below.

### Chat & Ideas

- **Chat.** Ask the assistant anything: relationship questions, plans or something unrelated. The conversation is sent each turn, capped to the most recent 20 messages.
- **Ideas.** Describe what you're after, like "dates", "gifts" or "what to say after an argument", and get three to five specific, affordable suggestions. Tap one to save it to Shared Notes.

The assistant only ever receives what you type. Moods, cycle data, steps and payments are never sent to it.

### Health & Cycle

**Cycle Tracker**

- **Logging.** Record a period start and an optional end date, plus a short symptom check-in: flow, physical symptoms, fluid, emotional state and energy.
- **Predictions.**
  - The average cycle length comes from your recent logged cycles. Implausible gaps, like a duplicate log or a months-long break, are ignored. Without history it assumes 28 days.
  - The average period length comes from logged end dates.
  - The model rolls forward to the cycle you're actually in today, so a missed log doesn't leave a stale prediction.
- **What it shows.** Current phase (Menstruation, Follicular, Ovulation or Luteal), cycle day, next period date, fertile window and ovulation day.
- **Symptoms can correct the phase, but only when they're plausibly current.** Bleeding counts only around the expected period, and egg-white fluid only inside the fertile window.
- **Guidance.** A "what's happening" summary and practical tips for the partner, based on the phase and what was logged.
- **Reminder.** A heads-up the morning before the predicted start, or that morning if the day before has already passed.

**Hospital Visit Log**

Record a visit's date, reason and test results or doctor's notes. Both partners see both partners' visits, newest first, and can open one to read the details.

### Shared Todos

- Add a task with optional notes, a first reminder date and time, and whether it repeats: once, weekly, monthly or yearly.
- **Both phones get the reminder**, because each phone schedules it from the same shared list.
- Tick tasks off or delete them. Completed tasks stop reminding.

### Milestones

- Add a date with a title, an emoji and whether it repeats: yearly, monthly or once.
- On the day you both get *"Today: Anniversary — 3 years today."* Yearly and one-off milestones also get a reminder the day before, so there's time to plan.
- Milestones feed the *On This Day* card on the hub.

### Complaint Box

A structured place to raise an issue, so it isn't lost in chat.

- File one with a title and an optional description. Your partner gets a notification straight away.
- Open it to discuss it in **threaded replies**.
- **Mark resolved** when it's settled, or **Reopen** it if it isn't. Whoever filed a complaint can delete it.

### Bucket List

Experiences you want to share, each with a title and an optional description. Tick one off when you've done it. The app records who completed it and when. Changes show up live on both phones.

### Menu

The full-screen side menu, opened from the tab bar:

- **Cycle Tracker** shortcut.
- **Changelog.** Release notes published in-app. New entries also send a notification.
- **Settings:**
  - **My Profile:** your display name and profile picture.
  - **Sync Key.**
  - **Unpair Partner**, under *Danger Zone*.
- **Sign Out.**

### Accounts & Pairing

1. Each partner registers with an email, a password and a display name.
2. Until you're paired, the app shows your **sync key**, which is your user ID. Send it to your partner.
3. One of you pastes the other's key. Pairing runs through a server-side function (`pair_with_partner`), not direct table writes. Treat the key like a private invite, because anyone who has it can pair with you.
4. After that, every feature is shared between the two accounts. **Unpair** separates them again.

## Notifications

All reminders are local notifications, scheduled on each phone from the shared data, so both partners get them without a push server.

| Notification | When |
| --- | --- |
| **Todo reminder** | At the time you chose, then weekly, monthly or yearly if it repeats |
| **Milestone** | On the day, plus the day before for yearly and one-off milestones |
| **Cycle reminder** | The morning before the predicted period, or that morning |
| **New complaint** | As soon as your partner files one. Uses the priority channel |
| **Word of the Day** | Daily, scheduled 14 days ahead and topped up each time the app opens |
| **App update** | When a new changelog entry is published |

Tapping a notification opens the matching screen. Reminders are rescheduled by key whenever the data changes, and one-off alerts such as new complaints and app updates are claimed once per device. Reopening the app doesn't repeat them.

## Privacy & Security

- **Row Level Security** on every table. Each partner can read and write only their own couple's data.
- **Sessions are encrypted at rest** in the device keystore through `expo-secure-store`, not stored as plaintext in AsyncStorage.
- **Pairing and payment writes go through server-side functions** (`pair_with_partner`, `unpair`, `record_transaction`). They identify the caller from their session, not from anything the app sends.
- **Payment texts are parsed on the device.** Only the amount, direction, name, time and source are uploaded.
- **The AI assistant receives only what you type.** No moods, cycle data, steps or payments.
- **Profile pictures** are resized to 256px and stored in the profile row, so there's no public storage bucket.

## System Architecture

- **Frontend:** React Native 0.81 on Expo SDK 54, with the New Architecture enabled.
- **Backend:** Supabase. PostgreSQL holds the data, Row Level Security controls access, and Realtime syncs changes between devices. Realtime uses `postgres_changes` plus broadcast messages for instant updates.
- **AI:** Groq's chat completions API (`openai/gpt-oss-120b`).
- **Native:**
  - Health Connect for steps.
  - A local Expo module for SMS and notification capture.
  - `expo-notifications` for local reminders.
- **Deployment:** EAS builds the native apps. JavaScript-only changes ship over the air, with no reinstall.

**Platform note:** the app is built for Android.
- On iOS, the Step Duel shows as unavailable because Health Connect is Android-only.
- Payment detection is also unavailable on iOS.
- Everything else works on both platforms.

Native modules are loaded through guarded `require`s. That way a build without a module disables one feature instead of crashing to a white screen.

## Design System

The visual language lives in [`src/constants/theme.ts`](src/constants/theme.ts) and [`src/constants/motion.ts`](src/constants/motion.ts). Both are documented inline; the short version:

**One accent, on black.** Neon orange `#FF6A00` is the only chromatic colour in the app — everything else is a warm neutral drawn from the eight-step `INK` ramp. The discipline is the point: orange always means "this is the thing that matters".

The consequence to design around is that **hue can no longer carry meaning**. Success, warning and danger are not green/amber/red. States are separated by *intensity* instead, backed by icons and explicit wording wherever the distinction matters. Intensity also survives greyscale and colour-vision deficiency, which a five-hue scale does not.

**Materials are dark scrims, not light tints.** `THEME.material.*` composes fill, rim and graded shadow into one spread across four tiers (`thin` / `regular` / `thick` / `chrome`, plus `well` for carved surfaces). They *dim* what sits behind them rather than lightening it — a light tint over the backdrop's orange corner burn turns the card orange and drops accent text to 1.92:1.

**Motion is springs, not durations.** `SPRING.*` encodes Apple's two-parameter model (damping ratio + response) converted to React Native's `stiffness`/`damping`/`mass`. Springs animate from wherever a value currently *is*, so they can be re-targeted mid-flight; a fixed-duration curve restarts from the head of its easing and visibly stutters. Bounce is reserved for motion a gesture actually threw.

Reduced motion is honoured throughout via [`useReducedMotion`](src/hooks/useReducedMotion.ts).

## Detected Payments

The old finance module asked two people to bookkeep their own relationship, and
they didn't. This one asks for nothing: it reads what the bank already tells
them and shows it back.

**Two sources, either one sufficient.** Indian banks text every UPI transfer,
so **SMS is the primary signal** — `RECEIVE_SMS` is an
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
Rs.20 to PRIYA SHARMA" and her "Received Rs.20 from RAHUL VERMA" are one
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
"PRIYA  SHARMA" against a profile that says "Priya" — so matching accepts
any shared token of three or more characters, and the screen lets the user add
the spellings their bank actually uses. The generosity runs one way only:
missing a payment is recoverable, putting a stranger's transfer into a couple's
shared feed is not.

## Profile Pictures

The picture is stored **in the database, not in a bucket**:
`profiles.avatar_url` holds a `data:image/jpeg;base64,...` string.

That is a deliberate trade, not a shortcut. A Supabase Storage bucket would mean
creating the bucket, writing `storage.objects` policies, building an upload path
(React Native has no working `Blob` route, so it needs an `ArrayBuffer` and a
base64 decoder this project doesn't carry), and then choosing between a public
bucket whose URLs are guessable and signed URLs with an expiry to refresh. The
column, by contrast, already exists, is already couple-scoped by the profiles
RLS policy, and is already pushed to the device by the `profile-self` realtime
channel. `<Image>` takes a `data:` URI without caring.

The whole trade rests on the image being small, so
[`profilePhoto.ts`](src/services/profilePhoto.ts) crops to a square in the
system picker, resizes to **256px** and saves at **JPEG quality 0.6** — about
20KB — and refuses anything that still encodes over 300KB. That cap is not
expected to fire; it is there because the failure it guards against is silent. A
multi-megabyte row would not announce itself, it would just make every profile
fetch and every realtime payload slower, permanently.

## Project Structure

```text
App.tsx               # every screen and the StyleSheet — the app is one component tree
index.ts              # registerRootComponent
schema.sql            # full database: tables, RLS policies, RPCs, realtime publication
supabase/migrations/  # incremental migrations to run against an existing project
app.json              # Expo config: package, permissions, plugins, runtimeVersion
app.config.js         # layers the demo build over app.json when EXPO_PUBLIC_DEMO_MODE=1
plugins/              # local Expo config plugins (Health Connect delegate, demo manifest)
modules/              # local native modules (Android notification + SMS listener)
src/
├── components/common/  # Skeleton, HubSkeleton, GlassCard, StepGraph, Avatar
├── constants/          # theme (colour, material, type), motion, vocabulary
├── demo/               # demo build: in-memory backend, fictional seed data, scripted assistant
├── hooks/              # Supabase data + auth hooks, one per feature
├── services/           # notifications, OTA updates, encrypted session storage, photo pipeline
├── types/              # database row shapes
└── utils/              # pure helpers — cycle and milestone maths, payment parsing
```

## Local Development

### Prerequisites

- Node.js 18+
- A configured Supabase project
- An EAS account (`npx eas-cli login`)
- A Groq API key for Chat & Ideas (optional; everything else works without it)
- For local native builds only: JDK 17 and the Android SDK

### Setup

```bash
git clone https://github.com/Adarsh-Aravind/NOVIA.git
cd NOVIA
npm install
cp .env.example .env      # then fill in your Supabase URL + publishable key
cp eas.example.json eas.json
```

Use the **publishable** (or legacy `anon`) key — never the `service_role` key, which bypasses Row Level Security and would give anyone holding the APK full access to the database.

**The assistant needs a key.** `EXPO_PUBLIC_GROQ_API_KEY` in `.env` — see [console.groq.com](https://console.groq.com). Note that `EXPO_PUBLIC_*` values are compiled into the JS bundle and readable by anyone who unzips the APK, so this is fine for a free-tier key (the exposure is rate-limit abuse) and not fine for a paid one. Put a server-side proxy in front before spending real money through it. Env vars are read when the bundler **starts**, so adding one means restarting Metro, not just reloading the app.

### Database

Run [`schema.sql`](schema.sql) against a fresh project, or apply the files in `supabase/migrations/` to an existing one.

**Don't skip the realtime publication.** Every `postgres_changes` subscription requires its table to be a member of `supabase_realtime`. Without membership the client subscribes *successfully* and then receives nothing — a dead feed that is indistinguishable from a working one. `schema.sql` publishes every subscribed table; `supabase/migrations/20260910_step_realtime.sql` repairs an existing project.

**Two tables outlive their features.** `finances` and `check_ins` are no longer
read or written by any code — the hand-entered ledger became detected payments,
and the daily check-in was dropped because "Right Now" already answered the same
question in one tap. Both tables, their policies and their migrations are left
in place on purpose: they hold real records, and dropping them is a data
decision for the owner rather than a code cleanup. A fresh project created from
`schema.sql` still gets them.

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

## Demo Build

A demo APK is attached to the [GitHub releases](https://github.com/Adarsh-Aravind/NOVIA/releases). It needs no account, no backend and no API keys:

- **Backend** — an in-memory stand-in for Supabase (`src/demo/demoSupabase.ts`) seeded with fictional data (`src/demo/seed.ts`). Everything you add works, and it all resets when the app restarts.
- **Assistant** — scripted replies instead of Groq (`src/demo/demoAssistant.ts`).
- **Steps and payments** — shown from seed data. The demo never reads Health Connect, texts or notifications, and the APK doesn't request those permissions.
- **Installs alongside the real app** as `com.iitznova.novia.demo`, with OTA updates switched off so it can never pull a production bundle.

All of it hangs off one build-time flag, `EXPO_PUBLIC_DEMO_MODE=1` (read by `src/demo/config.ts` and `app.config.js`). To build it yourself, from a clean checkout so no `.env` is bundled:

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=1 npx expo prebuild --platform android --clean
cd android && EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=1 ./gradlew assembleRelease
```

The release variant is signed with the debug keystore — fine for sideloading a demo, not for a store.

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

`runtimeVersion` is pinned to a literal in `app.json`, so **nothing bumps it for you**. Raise it by hand in the same commit as any native change, or an OTA published afterwards will be served to older installs that lack the new module. It is currently `3`; installs built against an older value keep the last bundle published for that value.

<3
