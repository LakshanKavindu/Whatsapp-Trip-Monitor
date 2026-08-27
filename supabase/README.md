# Supabase + Mobile PWA setup

This connects your local trip-monitor to a phone app your brother can
use while driving. Architecture: your PC pushes every message to
Supabase (hosted Postgres); the phone app reads only the matched ones,
live, via Supabase Realtime.

## 1. Create a Supabase project

1. Go to https://supabase.com, sign up (free tier is enough for this).
2. Create a new project. Pick any region close to Sri Lanka (e.g.
   Singapore) for lower latency.
3. Wait for it to finish provisioning (a couple of minutes).

## 2. Set up the database

1. In your project, go to **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` and run it.
3. Go to **Database** → **Replication**, find the `messages` table, and
   make sure it's toggled ON for realtime (the SQL script also tries to
   enable this — if it already shows enabled, you're set).

The script also creates the shared `trip_filters` table. Filters added from
the phone are used by the local Node server for future messages, so rerun
the complete script after updating this project.

## 3. Get your keys

Go to **Project Settings** → **API**. You need three things:

- **Project URL** — used by both the server and the phone app.
- **service_role key** — SECRET. Only goes in the local server's `.env`
  file. Never put this in the phone app or share it.
- **anon / public key** — used by the phone app only. Safe to expose;
  row-level security limits it to reading matched rows.

Firebase Cloud Messaging is also required for alerts when the phone app is
backgrounded. Create a Firebase project, add a Web app, enable Cloud
Messaging, and copy the Web Push certificate key from **Project Settings** →
**Cloud Messaging** into `mobile-pwa/firebase-config.js`. Download a Firebase
Admin service-account key from **Project Settings** → **Service accounts**;
keep it on the server only.

## 4. Connect the local server

In the main project folder:

```
cp .env.example .env
```

Edit `.env` and fill in:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-firebase-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
```

The server key must be the secret `sb_secret_...` key (or the legacy
`service_role` key) from **Project Settings** → **API**. Do not use the
`sb_publishable_...` / anon key here; that key is intentionally blocked from
inserting rows by the `messages` table's row-level security policy.

If the server still reports `permission denied for table messages`, rerun the
entire `supabase/schema.sql` script in the Supabase SQL Editor. The script
explicitly restores the `service_role` schema and table grants as well as the
server-only insert policy.

Run `npm install` again (picks up the new `@supabase/supabase-js`, `dotenv`,
and `firebase-admin` dependencies), then `npm start` as usual. Every message you
ingest — matched or not — now also gets written to Supabase. If `.env`
isn't set up yet, the app just skips this step silently and keeps
working locally exactly as before.

## 5. Connect and host the phone app

Edit `mobile-pwa/config.js` and fill in your **Project URL** and
**anon key** (not the service role key).

The PWA is static files (HTML/CSS/JS) that talk directly to Supabase —
it doesn't need your PC running or reachable from the internet at all.
Host the `mobile-pwa/` folder anywhere that serves static files, e.g.:

- **Netlify** (drag-and-drop the folder at app.netlify.com/drop — free,
  easiest) or
- **Vercel**, **GitHub Pages**, or any static host

The PWA has two views: **Latest 15** and **Filters**. The Filters view can
add, enable/disable, and delete shared filters. The main trip view is
intentionally limited to the fifteen newest matched trips.

Once hosted, open the URL on your brother's phone, then:
- **Android (Chrome):** tap the menu → "Add to Home Screen" (or you'll
  get an install prompt automatically).
- **iPhone (Safari):** tap Share → "Add to Home Screen".

He should also **tap the "Tap once to enable alert sound" banner** the
first time — mobile browsers block audio until you interact with the
page once.

## What works now vs. what's next

**Works today:** while the app is open on his phone (screen on), new
matched trips appear instantly, play a sound, vibrate, and show a
tappable "Open WhatsApp" button that jumps straight to a chat with that
number (Sri Lankan local numbers like `077...` are auto-converted to
the international format WhatsApp needs).

**Background alerts:** after Firebase is configured, tap **Enable sound and
background alerts** once in the PWA and allow notifications. The browser
registers its FCM token in Supabase, and the local server sends a push for
each matched trip. On iPhone, the PWA must be installed to the Home Screen
and notification permission must be allowed; iOS Web Push is not available
from an ordinary browser tab.

**One honest note on the WhatsApp button:** tapping it opens a WhatsApp
chat with that number ready to go — there's no official link that
starts a *call* directly with one tap (WhatsApp doesn't expose that).
It's one extra tap (the call icon inside the chat) to actually ring
them.

## Data you're now collecting

Every message (matched or not) is stored in the `messages` table with a
timestamp, so once you've got a few weeks of data, an analytics
dashboard (busiest routes, busiest times, price trends) is a
straightforward next build — the hard part (structured, clean data) is
already being collected from day one.
