# NOVIA

<p align="center">
  <a href="https://github.com/Adarsh-Aravind/NOVIA">
    <img src="https://readme-typing-svg.herokuapp.com?font=Inter&weight=400&size=24&pause=1000&color=FF8A3D&center=true&vCenter=true&width=500&lines=Two+lights%2C+one+sky;Stay+Connected;Hold+Together;Grow+Together" alt="Typing SVG" />
  </a>
</p>

NOVIA is a private Android app for two people. Each of you is a light in a shared night sky: your mood changes how your light glows, you can reach out and hold each other's light in real time, and every note, plan and date you share becomes a star. Around that sky sit the practical parts of a life together: notes, plans, anniversaries, the cycle, health records, walking and money.

Everything one partner does shows up on the other's phone within a moment, and reminders fire on both phones.

> **Version 3.0** is a full redesign. It replaces the earlier hub-and-tabs app. The no-backend demo build still uses the earlier app; see [Demo Build](#demo-build).

## Contents

- [Features at a Glance](#features-at-a-glance)
- [Feature Guide](#feature-guide): [Sky](#sky) · [Us](#us) · [Care](#care) · [You](#you) · [Widgets](#widgets)
- [Pairing](#pairing) · [Notifications](#notifications)
- [Privacy & Security](#privacy--security)
- [System Architecture](#system-architecture) · [Realtime](#realtime)
- [Design System](#design-system)
- [Detected Payments](#detected-payments) · [Profile Pictures](#profile-pictures)
- [Project Structure](#project-structure) · [Local Development](#local-development)
- [Demo Build](#demo-build) · [Deployment & Updates](#deployment--updates)
- [License](#license)

## Features at a Glance

| Feature | What it does | Where |
| --- | --- | --- |
| **Two lights** | You and your partner as glowing lights; mood sets how each one glows | Sky |
| **Hold** | Press and hold your light; if your partner holds theirs at the same time, the lights meet and both phones beat a shared heartbeat | Sky |
| **Nudge** | Tap your partner's light to let them know you're thinking of them | Sky, widget |
| **Your sky** | Every shared moment becomes a star, laid out in time order, oldest at the centre | Sky |
| **Together streak** | Days in a row you've both opened NOVIA, drawn as a comet | Sky |
| **Notes** | Shared notes with reactions and a typing indicator | Us |
| **Ideas** | Date, gift and conversation ideas from an assistant, plus free chat | Us |
| **Plans** | Shared to-dos with reminders on both phones, one-off or repeating | Us |
| **Someday** | A bucket list of things to do together | Us |
| **Dates** | Anniversaries and firsts, with reminders | Us |
| **Repair Room** | Talk something through and mark it repaired together | Us |
| **Weather of us** | Both moods, day by day, as weather | Care |
| **Walk Together** | Combined steps carry you along a route on a 3D globe | Care |
| **Cycle** | Period logging, predictions and a symptom check-in, read as care for the partner | Care |
| **Hospital visits** | A shared record of visits, reasons and results | Care |
| **Step duel** | Today's steps, the week, the season and its stakes | Sky, Care |
| **Money between you** | Payments you send each other, read from bank texts | You |
| **Month in stars** | A short story of your month, shareable as an image | You |
| **Widgets** | Both lights and a days-together count on the home or lock screen | Home screen |

## Feature Guide

The app has four places, in a floating dock at the bottom: **Sky**, **Us**, **Care** and **You**.

### Sky

The home screen is a night sky whose colour follows the real time of day. It turns slowly, and tilting the phone shifts the stars at different depths.

- **Two lights.** You are Ember (orange) and your partner is Moonlight (lavender). Each light's brightness, pace and flicker follow that person's mood: *Happy* glows quick and bright, *Overwhelmed* flickers, *Exhausted* dims and slows. When your partner has NOVIA open, the lights drift closer.
- **Hold.** Press and hold your light. It starts swelling the moment your finger lands. If your partner holds theirs at the same time, wherever they are, the lights meet in the middle and both phones beat the same heartbeat until one of you lets go.
- **Nudge.** Tap your partner's light. Their phone taps twice, and a ring spreads from your light on their screen.
- **Your sky.** Notes, finished plans, someday-list items you did, dates, repairs, step-duel days and finished journeys each become a star. Milestones are the brightest and are joined by a dotted line: your story. Tap any star to see what it was.
- **Together streak.** A day counts when you both open NOVIA. The streak is a comet whose tail grows with each day; tap it for the count and your best run.
- **The panel.** Your partner's mood with a suggestion for what to do about it, your own mood, and today's step duel. Pull it up for the week's walking, the streak and quick actions.
- **On this day.** Anniversaries landing today, or the next one coming up.

### Us

Everything you keep together, as six views of one page. Colour shows who wrote what. Press and hold anything to act on it.

- **Notes.** Live on both phones, with a typing indicator. Press and hold to react (❤️ 😂 👍 🥺 🔥) or delete your own.
- **Ideas.** *Get ideas*: describe what you're after and get a few specific, affordable suggestions; save any of them as a note. *Ask anything*: a free chat. Only what you type is sent, never moods, cycle data, steps or payments.
- **Plans.** Shared to-dos. Add one quickly, or with a date, time, repeat (once, weekly, monthly, yearly) and notes. Both phones get the reminder.
- **Someday.** Things you want to do together. Tick one off when you've done it.
- **Dates.** Anniversaries and firsts, repeating yearly or monthly, with an emoji. Both of you get a reminder on the day, and the day before for yearly and one-off dates.
- **Repair Room.** When something hurt: name it, pick what you feel and need, make one small ask, optionally cool down first, and talk it through. It's repaired only when you've both tapped *We're good*.

### Care

- **Weather of us.** Both moods as weather (sunny, cloudy, stormy and so on), two weeks at a time, paging back through your history. Every mood change is recorded, including from older app versions.
- **Walk Together.** Pick a start and a destination and how long the journey should take. Your combined steps since that day carry one light along the route on a 3D globe, which you can spin with a finger. Arriving adds a star.
- **Cycle.** Current phase and cycle day, what the phase usually means for the partner, the next period, the fertile window and the average cycle. Log a period with an optional end date and a symptom check-in (flow, body, discharge, mood, energy). Predictions ignore implausible gaps and roll forward to the cycle you're actually in.
- **Hospital visits.** Both partners' visits, newest first, with the reason and any results or doctor's notes.
- **This week's walking.** The seven-day comparison, the season tally and its stakes: what the loser of the season owes, which either of you can set.

Steps come from Health Connect. Access is asked for only when you tap to connect, never at launch.

### You

- **Profile.** Your photo (tap to change or remove it) and your name.
- **Word of the day.** A new word each morning, also as a notification.
- **Money between you.** See [Detected Payments](#detected-payments).
- **Your month in stars.** Five short story cards for last month or this month so far: new stars, the walk-off, your best day, what you made. Swipe down to close; the last card can be shared as an image.
- **Reminders.** One switch for plans, dates, the cycle heads-up and the word of the day. Nudges always come through.
- **What's new.** Release notes published in the app, with an unseen count.
- **Pairing.** Your sync key, and unpairing (it asks first).

### Widgets

- **NOVIA lights** (4×2): both lights and your partner's mood. Tap their light to send a nudge.
- **Days together** (2×2): days since your earliest yearly date, and the days to the next anniversary.

Both can go on the lock screen where Android allows third-party lock-screen widgets (Android 16 QPR2 and later, depending on the phone). They draw from a cache the app keeps, so they work with the app closed. Signing out or unpairing blanks them.

## Pairing

1. Each partner registers with an email, a password and a name. A forgotten password can be reset from the sign-in screen.
2. Until you're paired, the app shows your **sync key** (your user id). Send it to your partner.
3. Your partner pastes it and sends a **pairing request**. You see it with their name and accept or decline. If you had already asked them, their request pairs you straight away.
4. After that, everything is shared between the two accounts. **Unpair** separates them again.

Nobody can pair with you without your accepting. A request reveals nothing about the account it was sent to (not its name, and not whether it exists or is already paired), so it can't be used to probe keys. Requests expire after seven days.

## Notifications

All reminders are local notifications, scheduled on each phone from the shared data, so both partners get them without a push server. They sit in their own channels, each as loud as its content deserves, and use the system's sound and vibration.

| Channel | What | Importance |
| --- | --- | --- |
| **Plans** | Your plans, at the time you chose, then weekly, monthly or yearly if they repeat | High |
| **From your partner** | A nudge, or a repair your partner starts, while NOVIA is in the background | High |
| **Dates and anniversaries** | On the day, plus the day before for yearly and one-off dates | Default |
| **Cycle** | The morning before the predicted period, or that morning | Default |
| **Word of the day** | Each morning, scheduled 14 days ahead | Low |
| **What's new** | Once, when a new release note is published | Low |

Titles say what or who in sentence case, with one useful line underneath. Upgrading from an older version cancels the old app's scheduled reminders and removes its old channels, so nothing fires twice.

## Privacy & Security

- **Row Level Security** on every table: each partner can read and write only their own couple's data.
- **Server-side functions for anything sensitive.** Pairing and its consent step, unpairing, recording payments and confirming a repair all go through database functions that identify the caller from their session, not from anything the app sends.
- **Pairing needs consent.** See [Pairing](#pairing).
- **Realtime DELETE events don't leak ids.** Realtime can't apply RLS to DELETE events, and with RLS on they carry only the primary key. Every published table uses a random surrogate key, so a delete reveals nothing about who it belonged to.
- **Sessions are encrypted at rest** in the device keystore through `expo-secure-store`.
- **Payment texts are parsed on the device.** Only the amount, direction, name, time and source are uploaded.
- **The assistant receives only what you type.** No moods, cycle data, steps or payments.
- **Profile pictures** are resized to 256px and stored in the profile row, so there's no public storage bucket.

## System Architecture

- **Frontend:** React Native 0.81 on Expo SDK 54, New Architecture.
  - **Skia** for the sky, the lights, the globe and the recap, all as GPU shaders.
  - **Reanimated 4** and **Gesture Handler** for motion and gestures on the UI thread.
  - **react-native-android-widget** for the home- and lock-screen widgets.
- **Backend:** Supabase. PostgreSQL holds the data, Row Level Security controls access, and Realtime syncs changes between phones.
- **AI:** Groq's chat completions API (`openai/gpt-oss-120b`).
- **Native:** Health Connect for steps, a local Expo module for SMS and notification capture, `expo-notifications` for reminders.
- **Deployment:** local or EAS builds for native changes; JavaScript-only changes ship over the air.

The app is built for Android. Native modules are loaded through guarded `require`s, so a build without one disables a feature instead of crashing.

### Realtime

Holding, nudges and "here" run on Supabase Realtime **Broadcast** over one channel per couple, opened once at the app's root:

| Message | When | Effect on the other phone |
| --- | --- | --- |
| `hello` | joining, coming to the foreground | partner is here; answers `here` if open |
| `here` | every 10 s while in the foreground | partner is here |
| `away` | leaving the foreground | partner is away, and their hold ends |
| `hold` `{on}` | press, release, and every 1.5 s while held | partner holding or not |
| `nudge` | tapping their light (at most once per 0.8 s) | two taps, a ring, and a notification if backgrounded |

Anything not heard from times out on its own: a hold after 4.5 s, a partner after 25 s. Supabase Presence was tried first and ruled out: it rate-limits per client (three quick updates close the channel), lags about 1.4 s, and leaves phantom entries behind. `node scripts/together-check.mjs` runs two simulated phones through 25 checks against the live server on a throwaway topic.

Database-change channels get a per-instance name (`src/services/realtime.ts`), because `supabase.channel()` hands back an existing channel with the same topic and adding a listener to it after it has subscribed throws.

## Design System

The visual language lives in [`src/next/theme.ts`](src/next/theme.ts), with motion tokens in [`src/constants/motion.ts`](src/constants/motion.ts).

- **Colour says who.** Ember (`#FF8A3D`) is you, Moonlight (`#B9A8FF`) is your partner, and Starlight (`#FFF3E0`) is what you made together. Everything sits on a night sky whose colour follows the time of day.
- **Solid panels.** Cards are solid deep-indigo panels with a fine border, chosen for legibility over translucency.
- **Type.** Bricolage Grotesque for display, Manrope for everything else.
- **Motion is springs, not durations.** Springs use Apple's damping-ratio and response model. They animate from wherever a value currently is, so they can be re-targeted mid-flight. Bounce is reserved for motion a gesture actually threw. Every control reacts on touch-down. The Sky panel, the globe and the recap follow the finger 1:1, rubber-band at their limits, and carry a flick's momentum.
- **Reduced motion** is honoured: tilt parallax switches off, and transitions drop to cross-fades.

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
index.ts              # boots src/next (or App.tsx for the demo build) and registers the widget task
App.tsx               # the earlier single-file app, kept for the no-backend demo build
schema.sql            # full database: tables, RLS policies, RPCs, realtime publication
supabase/migrations/  # incremental migrations to run against an existing project
app.json              # Expo config: package, permissions, plugins, runtimeVersion
app.config.js         # adds widgets and the notification icon; demo and side-by-side variants
plugins/              # local Expo config plugins (Health Connect delegate, manifest stripping)
modules/              # local native modules (Android notification + SMS listener)
scripts/              # together-check.mjs: two simulated phones against Realtime
src/
├── next/               # the app
│   ├── NextApp.tsx       # root: sign-in, pairing, providers, the four places
│   ├── screens/          # Sky, Us, Care, You and their parts
│   ├── sky/              # the sky and light shaders
│   ├── walk/             # Walk Together and the globe
│   ├── weather/          # Weather of us
│   ├── recap/            # Month in stars
│   ├── widgets/          # home- and lock-screen widgets
│   ├── notify/           # channels and reminder scheduling
│   ├── hooks/            # presence (useTogether), streak, money, constellation, tilt
│   └── components/       # dock, cards, sheets, press feedback
├── hooks/              # Supabase data hooks shared with the demo app
├── services/           # Supabase client, realtime naming, Groq, notifications, OTA, photo pipeline
├── constants/          # motion tokens, vocabulary, the earlier theme
├── demo/               # demo build: in-memory backend, fictional seed data, scripted assistant
├── types/              # database row shapes
└── utils/              # pure helpers: cycle and milestone maths, payment parsing
```

## Local Development

### Prerequisites

- Node.js 18+
- A configured Supabase project
- A Groq API key for Ideas (optional; everything else works without it)
- For local native builds: JDK 17 and the Android SDK

### Setup

```bash
git clone https://github.com/Adarsh-Aravind/NOVIA.git
cd NOVIA
npm install
cp .env.example .env      # then fill in your Supabase URL + publishable key, and a Groq key
```

Use the **publishable** (or legacy `anon`) key, never the `service_role` key, which bypasses Row Level Security and would give anyone holding the APK full access to the database.

`EXPO_PUBLIC_*` values are compiled into the JS bundle and readable by anyone who unzips the APK. That is fine for a free-tier Groq key (the exposure is rate-limit abuse) and not fine for a paid one; put a server-side proxy in front before spending real money through it. Env vars are read when the bundler starts, so adding one means restarting Metro.

### Database

Run [`schema.sql`](schema.sql) against a fresh project, then the files in `supabase/migrations/` in order. On an existing project, run only the migrations you haven't applied. They are idempotent.

**Don't skip the realtime publication.** Every `postgres_changes` subscription requires its table to be a member of `supabase_realtime`. Without it the client subscribes successfully and then receives nothing.

### Building

Expo Go won't work; the app links native modules it doesn't ship. Build an APK locally:

```bash
npx expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

`NOVIA_SIDE_BY_SIDE=1` (set for both commands) builds a test copy that installs beside the real app (`com.iitznova.novia.next`, OTA off, payment capture stripped), so you can try a build on a phone without replacing NOVIA.

## Demo Build

A demo APK is attached to the [GitHub releases](https://github.com/Adarsh-Aravind/NOVIA/releases). It needs no account, no backend and no API keys, and it shows the **earlier** version of the app (`App.tsx`), whose in-memory backend it was written against:

- **Backend:** an in-memory stand-in for Supabase (`src/demo/demoSupabase.ts`) seeded with fictional data (`src/demo/seed.ts`).
- **Assistant:** scripted replies instead of Groq (`src/demo/demoAssistant.ts`).
- **Installs alongside the real app** as `com.iitznova.novia.demo`, with OTA updates switched off.

```bash
EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=1 npx expo prebuild --platform android --clean
cd android && EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=1 ./gradlew assembleRelease
```

## Deployment & Updates

### Over-the-air

JavaScript, styling and logic changes ship straight to installed apps, which check on launch:

```bash
eas update --channel production --message "Describe changes here"
```

### Native builds

Anything touching native code (a new native dependency, an `app.json` plugin, a build-properties change) needs a new APK.

`runtimeVersion` is pinned to a literal in `app.json`, so **nothing bumps it for you**. Raise it by hand in the same commit as any native change, or an OTA update published afterwards will be served to older installs that lack the new module. It is currently `4` (version 3.0); installs built against an older value keep the last bundle published for that value.

## License

NOVIA is **fair source**, released under the [Functional Source License, Version 1.1, ALv2 Future License](LICENSE.md) (`FSL-1.1-ALv2`).

**In plain terms.** This summary is not the licence. [LICENSE.md](LICENSE.md) is what applies.

- ✅ **You can** read, run, copy and change the code for any purpose that doesn't compete with NOVIA. For example:
  - for yourself, or inside your own organisation;
  - for non-commercial education and research;
  - when doing professional services for someone who uses NOVIA under these terms.
- ✅ **You can** share your changes, as long as you include the licence and keep the copyright notice.
- ❌ **You can't** make NOVIA, or anything with the same or substantially similar features, available as a **commercial product or service that competes with it**. For example, you can't sell or monetise a copy or a rebrand of the app on an app store.
- ❌ **You can't** use the NOVIA name, logo or other trademarks, except to credit where the code came from.
- ⏳ **Every version becomes fully open source two years after it's released.** From that date it's also available under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), with no competing-use restriction.

**Commercial use.** Want to build a product on NOVIA, license it, or partner on it? Get in touch through [adarsharavind.com](https://www.adarsharavind.com) and we can agree separate terms.
