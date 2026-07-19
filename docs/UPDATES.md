# Publishing an app update (What's New)

NOVIA shows an in-app changelog under **Settings → What's New**. Both partners see
the same list because it lives in the global `public.app_updates` table. When a new
row appears, each running app fires an "update available" notification with the title
as the reasoning, and shows a small dot on the Settings menu until it's opened.

There is no admin screen — you add entries by hand in the **Supabase SQL editor**.

## Add an entry

Open your project in Supabase → **SQL Editor** → **New query**, then run:

```sql
insert into public.app_updates (version, title, body) values
  ('2.1.1', 'Bug fixes', 'Fixed the todo time picker and tidied the complaint threads.');
```

Fields:
- `version` — the release label, e.g. `2.1.1` (free text; shown as `v2.1.1`).
- `title` — short summary; this is what the push notification says ("NOVIA update available — <title>").
- `body` — the details / list of fixes. Use `\n` for line breaks, and double any single quotes (`''`).

Multi-line example:

```sql
insert into public.app_updates (version, title, body) values
  ('2.2.0', 'Vocabulary boost',
   e'What''s new:\n- 40 more daily words\n- Faster complaint sync\n- Small UI polish');
```

(The `e'...'` prefix lets `\n` become real line breaks in Postgres.)

## When does the partner see it?

- **In-app list:** immediately — the app subscribes to `app_updates` in realtime, and
  also refreshes each time it's brought to the foreground.
- **Notification:** the next time each device's app is open/foregrounded and connected.
  There is no push server, so a fully-killed app won't get the notification until it's
  next opened. (This is the same model the rest of NOVIA uses.)

## Deleting or editing an entry

```sql
-- fix a typo
update public.app_updates set body = 'Corrected text.' where version = '2.1.1';

-- remove an entry
delete from public.app_updates where version = '2.1.1';
```

## Ordering

Entries are shown newest first, by `created_at`. You don't need to set `created_at`;
it defaults to now.

---

# Shipping actual code changes (OTA)

The changelog above is just text. To ship real JS/asset changes without anyone
reinstalling the APK:

```bash
eas update --channel production --message "Fix finance totals"
```

Installed apps pick this up at the next cold start, and now also when the app is
brought back to the foreground (it downloads quietly and offers a "Restart now"
banner rather than reloading under you).

## runtimeVersion — the thing that decides whether OTA reaches anyone

`app.json` sets `"runtimeVersion": "1"`, deliberately **decoupled from
`version`**.

An update is only delivered to builds whose `runtimeVersion` matches exactly.
Previously this was pinned to `"2.1.0"` — the same value as `version` — so every
time the app version was bumped, every already-installed build was orphaned from
its update channel and the only way to ship anything was a reinstall.

The rules now:

- **JS / styles / layout / business logic only** → just `eas update`. Leave
  `runtimeVersion` alone. Bump `version` as much as you like.
- **Native change** (new native dependency, changed `plugins`, changed
  `expo-build-properties`, SDK upgrade) → bump `runtimeVersion` to `"2"`, run
  `eas build`, and install the new APK. OTA cannot carry native code.

We use a hand-managed string rather than the `fingerprint` policy on purpose:
`android/` and `ios/` are listed in `.easignore` (EAS regenerates them via
prebuild), but they exist locally from `expo run:android`. A fingerprint computed
on this machine at publish time can therefore disagree with the one computed on
EAS at build time, which silently sends updates to a runtime nobody is running.
A fixed string has no such failure mode.

## One-time migration

The build currently on your phones was made with `runtimeVersion: "2.1.0"`. It
will **not** receive updates published under `"1"`. You need one final
`eas build` + install; after that, `eas update` works across version bumps and
the reinstall treadmill is over.
