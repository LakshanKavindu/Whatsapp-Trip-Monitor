# Trip Monitor

Watches your tourism WhatsApp groups for hire messages that match routes
you set, and pops a Windows desktop notification when one does. Built to
be **source-agnostic**: right now it reads Windows notifications (zero
WhatsApp ban risk), and can switch to reading WhatsApp directly via
Baileys later — with no changes to the UI, parsing, or matching logic.

## How it's structured

```
shared/
  normalize.js   — cleans up stylized/decorative Unicode text
  locations.js   — place-name alias table (spelling variants, Sinhala)
  vehicles.js    — vehicle-type alias table
  parser.js      — extracts pickup/drop/date/time/vehicle/price/contact
  matcher.js     — checks a parsed message against your saved filters
server.js         — local web server: UI + filter storage + /api/ingest
public/           — the condition-setting UI (open in your browser)
notification-listener/
  Listener.cs     — reads Windows toast notifications, forwards to server
index.js, config.js — the earlier Baileys-based approach (not active
                       right now, kept for the later migration)
```

Everything funnels through **one endpoint**: `POST /api/ingest`. The
Windows notification listener calls it today; a Baileys connector would
call the exact same endpoint later. The parser, matcher, filters, UI, and
notifications never need to change.

## 1. Run the main app (server + UI)

```
npm install
npm start
```

Open **http://localhost:4173** in your browser. From there you can:

- Add route filters (Pickup / Drop / Vehicle — leave any blank to mean
  "anywhere" / "any vehicle"). Add as many as you want; each one is
  checked independently, so you can watch several routes at once.
- Turn filters on/off or delete them.
- **Test parsing right now** — paste any sample message into the "Test a
  message" box and hit send. You'll see exactly what got extracted and
  whether it matched, and get a real desktop notification if it does.
  This works immediately, with no notification listener needed — use it
  to sanity-check the system before setting up step 2.
- Watch the live feed of everything that's come in.

The optional mobile PWA can also receive background alerts through Firebase
Cloud Messaging. Follow [supabase/README.md](supabase/README.md) for the
Supabase, Firebase, and phone setup steps.

## 2. Set up the Windows notification listener

This is the piece that watches WhatsApp Desktop's real notifications and
feeds them to the server above.

**Requirements:** [.NET 10 SDK](https://dotnet.microsoft.com/download)
(Windows), WhatsApp Desktop installed with **message previews enabled**
in its notification settings (Settings → Notifications).

```
cd notification-listener
dotnet run
```

On first run, Windows will ask you to grant this app "Notification
access" — accept it (Settings → Privacy & security → Notifications if
you need to find it manually afterward). Leave the window open; it polls
for new WhatsApp notifications and forwards matching ones to your running
server.

**Important honest caveat:** Windows' notification-reading API
(`UserNotificationListener`) is normally designed for apps with a
packaged app identity (MSIX), and unpackaged console apps like this one
can sometimes be denied access even after you approve the prompt. I
wasn't able to test this piece myself (I don't have a Windows machine to
run it on). If `dotnet run` reports access was denied:

- Try running the built `.exe` directly from
  `bin/Debug/net10.0-windows10.0.19041.0/` instead of via `dotnet run`.
- If it still fails, the practical fallback is a small MSIX packaging
  step (`dotnet publish` with packaging enabled) — tell me if you hit
  this and I'll walk you through it.
- Either way, **step 1 above already works standalone** — you can build
  out and refine your filters and matching using the "Test a message" box
  while we sort out the listener.

## Notification requirements on the WhatsApp Desktop side

- Message previews must be **on** (not just "New message" — you need the
  actual text visible in the notification).
- The group must be **unmuted**, or WhatsApp won't generate a
  notification for it at all.
- Very bursty groups may get notifications collapsed into a summary
  ("3 new messages") with no readable text — those will be missed. This
  is a known trade-off of the notification-based approach (see below).

## Improving the parser

The parser handles a wide range of real formats already (labeled fields
in many spelling variants, glued multi-field lines, unlabeled "X to Y"
routes, stylized/bold Unicode text, Sinhala place names). Test it
directly against sample messages:

```
npm run test:parser
```

If you spot a message format that doesn't extract correctly:
1. Add it to `test-parser.js` as a new sample.
2. Add any new place-name spelling to `shared/locations.js`.
3. Add any new vehicle term to `shared/vehicles.js`.
4. Add any new label wording (e.g. a new way people write "pickup") to
   `FIELD_LABELS` in `shared/parser.js`.

## Moving to Baileys later

When you're ready, the Baileys code from earlier (`index.js`,
`config.js`) is still here. The migration is: instead of the Windows
listener POSTing to `/api/ingest`, the Baileys `messages.upsert` handler
posts to the same endpoint with `source: "baileys"`. Nothing else in this
project changes.
