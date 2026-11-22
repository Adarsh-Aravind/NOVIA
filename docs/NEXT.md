# NOVIA Next

The redesign, built beside the current app. `EXPO_PUBLIC_NEXT=1` boots
[`src/next`](../src/next) instead of `App.tsx`, and installs as its own app
(`com.iitznova.novia.next`, "NOVIA Next") talking to the same Supabase project,
with OTA updates off and payment capture stripped.

## Why it changed

The current app had stopped being opened. It felt like admin (a hub of
trackers and lists), nothing on it was new from one day to the next, one
partner using it alone made the shared parts go quiet, and the look had gone
stale. Each part of the redesign answers one of those.

## The idea: two lights, one sky

The home screen is a night sky, not a dashboard.

- **Two lights.** You are Ember (orange), your partner is Moonlight (lavender).
  Each light is a GPU-shaded sphere whose brightness, pace and flicker follow
  that person's mood: Happy glows quick and bright, Overwhelmed flickers,
  Exhausted dims and slows. Colour now says *who*, which is what a couples app
  most needs to say.
- **Presence.** When your partner has the app open, the lights drift closer.
  When they don't, theirs drifts away and dims a little.
- **Tap their light** to send a nudge. Their phone taps twice and a ring
  spreads from your light on their screen.
- **Hold.** Press and hold your light. If your partner holds theirs at the
  same time, wherever they are, the lights meet in the middle, the sky blooms,
  and both phones beat the same heartbeat until one of you lets go.
- **Your Sky.** Every note, finished plan, someday-list item you did, milestone
  and complaint you talked through is a star. They are laid out in time order
  as a sunflower spiral, oldest at the heart where the lights are, newest at
  the rim, so the sky is a picture of your actual history and grows a little
  each time you do something together. Milestones are the brightest stars and
  are joined by a dotted line: your story. Tap any star to see what it was.
- **It moves with you.** The sky colour follows the real time of day, it turns
  once every 20 minutes, and tilting the phone shifts the star layers at
  different depths.

Nothing new is stored for any of this. Presence, nudges and holds ride a
Realtime channel; stars are read from existing tables.

## Places

Four, in a floating dock, instead of five tabs and a side menu.

| Place | What's in it |
| --- | --- |
| **Sky** | The lights, your sky, your partner's mood and what to do about it, your own mood, today's step duel |
| **Us** | Notes, plans (todos), someday (bucket list) and dates (milestones) as four views of one page |
| **Care** | The cycle read as care for the partner, and the week's walking |
| **You** | Profile, what's still only in the current app, sign out |

## Stack

Expo SDK 54 / React Native 0.81, unchanged backend. Added:
`@shopify/react-native-skia` (sky and light shaders), `react-native-reanimated`
4 (motion on the UI thread), `react-native-gesture-handler`, `expo-sensors`
(tilt), `expo-haptics`, `react-native-safe-area-context`, Bricolage Grotesque.

## Built since

- **Widgets** ([`src/next/widgets`](../src/next/widgets)). *NOVIA lights* (4×2)
  shows both lights and your partner's mood; tapping their light sends a nudge.
  *Days together* (2×2) counts the days since your earliest yearly milestone and
  the days to the next anniversary. Both declare `home_screen|keyguard`, so
  they can go on the lock screen where Android allows third-party lock-screen
  widgets (Android 16 QPR2 and later; it depends on the phone maker). They
  draw from a cache the app writes, so they work with the app closed. A widget
  nudge only reaches a partner who has the app open, since there is no push.
- **Repair Room** (Us → Repair), replacing the complaint box. Name what
  happened, pick what you feel and need, make one small ask, optionally cool
  down first, talk it through, and it's repaired when *both* of you tap "We're
  good" (`confirm_repair()`, atomic). Repairs are written to the same
  `complaints` table with a readable body, so the current app still shows them.
- **Walk Together** (Care). Pick a start and a destination (an offline list of
  places, then OpenStreetMap search) and a pace. Your combined steps since the
  start day move one light along the great circle on a 3D globe. The target is
  sized from your own last 30 days of walking. Arriving adds a star.
- **Monthly recap** (You). Five story cards for a month: new stars, the
  walk-off, your best day, what you made, and a closing card you can share as
  an image.
- **Step-duel days as stars**, coloured by who won the day.

The schema change is
[`20261122_next_repair_journeys.sql`](../supabase/migrations/20261122_next_repair_journeys.sql).
It is additive only.

## Next passes

1. **Nudges and holds when the app is closed**, which needs push (FCM) and a
   small server function.
2. **Daily question with a blind reveal**: both answer, and neither sees the
   other's answer until both have.
3. **Time capsule letters** that unlock on a chosen date.
4. Moving payments, the assistant, period logging and hospital visits across.
