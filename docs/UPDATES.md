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
