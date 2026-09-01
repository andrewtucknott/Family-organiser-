# Family Organiser

One shared calendar for the whole family — the kind of thing Cozi does. Everyone
in the house sees the same calendar on their own phone or laptop, colour-coded so
you can tell at a glance whose week is whose.

Getting in is a single family PIN. There are no individual accounts and no email
addresses: you type the PIN, say which of you it is, and the device remembers.

## What it does

- **Month, week and day views.** Month for the shape of the week ahead, week for
  the time grid, day for the detail. On a phone the month view switches to a dot
  per event, because seven columns of text on a 390px screen is unreadable.
- **A colour per person.** Events can be for one person, several, or nobody —
  and an event with nobody assigned belongs to the whole family, so it stays
  visible however you filter.
- **Filtering.** Tap a name to see just their events. The filter is in the URL,
  so "the children's week" is a link you can bookmark.
- **Repeating events**, covering the patterns families actually use: every day,
  every week (on any set of weekdays), every month (on the same date or the same
  weekday, e.g. the second Tuesday), every year — each with an interval and an
  end of never, on a date, or after N times.
- **Sensible edits to repeating events.** Changing or deleting one asks whether
  you mean just that one, this and everything after it, or the whole series, and
  each does the right thing. Moving one swimming lesson doesn't disturb the rest;
  renaming the series still reaches the instances you haven't touched.
- **All-day and multi-day events**, for half term and holidays.

## Running it

Needs [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The first visit walks you through naming the
family, adding everyone and choosing a PIN.

For a real (non-development) run:

```bash
npm run build
npm start
```

## Putting it online for the family

The calendar is a single SQLite file, so it needs to run somewhere with a
**persistent disk** — a disk that survives restarts and re-deploys. That rules
out Vercel and Netlify, which throw away everything written to disk on each
deploy. It does not need anything big: this is a few thousand rows, and the
smallest instance any host sells is more than enough.

Whichever you pick, two rules matter:

1. **Run exactly one instance.** SQLite has a single writer. Two instances means
   two half-calendars, or a corrupted one.
2. **Serve it over HTTPS.** Session cookies are marked `secure` in production and
   simply won't be stored over plain `http://`. Every option below gives you
   HTTPS.

### What it costs to run

Roughly, per year, at the time of writing:

| Where | Cost | Notes |
| ----- | ---- | ----- |
| A machine you already have | £0 | Plus ~£10/year for a domain, if you want one |
| Fly.io, sleeping when idle | a few £ | What `fly.toml` is set to |
| Fly.io, always awake | ~£30 | Never any wait on first load |
| Railway / Render | ~£50+ | Browser-only setup, no terminal |

Check the current rates before committing — hosting prices move, and this table
will not.

### Option A — A machine you already have (free)

The cheapest by a distance, because the running cost is the electricity. An old
laptop, a Raspberry Pi, a NAS, or a server you already pay for will all run this
comfortably.

```bash
docker build -t family-organiser .
docker run -d --name family \
  -p 3000:3000 \
  -v family-data:/data \
  --restart unless-stopped \
  family-organiser
```

The named volume `family-data` holds the calendar and survives `docker rm` and
rebuilds.

**To reach it from outside the house**, don't open a port on your router. Use a
[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/):
a small `cloudflared` daemon makes an *outbound* connection to Cloudflare, so
there's no inbound firewall rule and your home IP is never exposed. It's free for
personal use, and Cloudflare terminates TLS, so you get a valid HTTPS certificate
without running Let's Encrypt yourself. You need a domain pointed at Cloudflare
(about £10/year), after which the calendar lives at something like
`calendar.yourname.co.uk`.

If you'd rather not involve Cloudflare, [Tailscale](https://tailscale.com) is the
other good answer: the calendar becomes reachable only from devices you've added
to your own private network.

Already have a server with a public address? [Caddy](https://caddyserver.com)
gets you HTTPS in two lines:

```
calendar.example.com {
    reverse_proxy localhost:3000
}
```

> The trade-off here isn't money, it's that the machine has to stay switched on
> for the family to reach the calendar.

### Option B — Fly.io (a few pounds a year)

Volumes are a first-class thing on Fly, and `fly.toml` in this repo is already
set up: one machine, a 1 GB volume mounted at `/data`, London region, HTTPS
forced, and the machine **sleeps when nobody is using it**. You're billed for the
time it's awake, and a family calendar is idle almost all day, so that's the
difference between a few pounds a year and a few pounds a month.

Sleeping uses `suspend`, which freezes the machine's memory rather than shutting
it down, so the first load after a quiet spell is quick rather than a full cold
start. To never wait at all, set `auto_stop_machines = "off"` and
`min_machines_running = 1`, and pay for it to stay awake.

1. Install the CLI and sign in (a card is required):

   ```bash
   curl -L https://fly.io/install.sh | sh
   fly auth signup      # or: fly auth login
   ```

2. Pick a name. App names are unique across the whole of Fly, so edit the first
   line of `fly.toml` to something like `tucknott-family-calendar`.

3. From the project folder:

   ```bash
   fly launch --no-deploy --copy-config
   fly volumes create family_data --size 1 --region lhr
   fly deploy
   ```

4. `fly open` opens the app. The first visit walks you through setup.

To update later: `git pull && fly deploy`. To check on it: `fly logs`,
`fly status`. Current rates are at
[fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/).

### Option C — Railway (no terminal needed, ~$5/month)

The easiest route if you'd rather not touch a command line — everything is done
in the browser.

1. Sign in to [railway.app](https://railway.app) with GitHub.
2. **New Project → Deploy from GitHub repo**, and choose this repository and
   branch. Railway finds the `Dockerfile` on its own.
3. Open the service → **Settings → Volumes → Add volume**, mount path `/data`.
   This is the step that matters; skip it and the calendar resets on every deploy.
4. **Settings → Networking → Generate Domain** for an HTTPS address.
5. Redeploy, then open the address and set up your family.

Leave the replica count at 1 (Settings → Deploy). Railway supplies `PORT` itself,
and the `Dockerfile` already points `DATABASE_PATH` at `/data`.

### What's been tested, and what hasn't

Honest accounting, because deployment is where confident-sounding instructions
usually come unstuck:

- **Tested.** The exact server the container runs: the standalone Next.js build,
  its bundled native SQLite binding, static assets, and the database being
  written to an absolute path like `/data`. The full browser suite passes against
  that build. The container entrypoint was also tested on the case that actually
  breaks — starting as root against a **root-owned, freshly-mounted** `/data`,
  taking ownership of it, dropping to the unprivileged `node` user, and then
  serving requests and writing the database as that user.
- **Not tested.** `docker build` itself, `fly deploy`, and the Railway flow —
  there was no Docker daemon or hosting account available where this was written.
  The `Dockerfile` and `fly.toml` are conventional and `fly.toml` is at least
  verified to parse and to be internally consistent, but the first real deploy
  may still want a nudge. If it does, `fly logs` or Railway's deploy log will
  say why — send it over.

### Settings

| Variable         | Default                     | What it's for |
| ---------------- | --------------------------- | ------------- |
| `DATABASE_PATH`  | `data/family-organiser.db`  | Where the calendar is stored. Relative paths are resolved from the working directory; use an absolute path for a mounted volume. |
| `SESSION_SECRET` | generated on first run      | Signs the session cookie. If unset, one is generated and stored in the database, which is fine for a single server. Set it explicitly if you ever run more than one. |
| `PORT`           | `3000`                      | Port to listen on. |

### Backups

Stop the app and copy the database file — that's the whole backup. While it's
running, use SQLite's own backup so you don't catch it mid-write:

```bash
sqlite3 data/family-organiser.db ".backup '/somewhere/safe/family-$(date +%F).db'"
```

## A few things worth knowing

**Times are wall-clock, not timezones.** A 16:30 swimming lesson is at 16:30,
including the week the clocks change. The whole app works in one household
timezone (`Europe/London` by default, in the `households.time_zone` column). If
someone opens the calendar from abroad they'll still see home time — which is
almost always what you want from a family calendar.

**The 31st skips short months.** A monthly event on the 31st appears in January,
March, May… and not at all in February. This is what the iCalendar standard does,
and it beats silently moving the event to the 28th. Pick "the same weekday each
month" if you want something that lands every month.

**Removing a family member archives them.** Their name stays readable on events
already in the calendar, so nothing in your history quietly disappears.

**Changing the PIN signs everyone out**, on every device, by design.

**The PIN is the security boundary**, not the "who are you?" screen — anyone with
the PIN can act as anyone in the family. It's a household calendar, not a bank.
There's a lockout after 8 wrong PINs from the same address within 15 minutes.

## How it's put together

Next.js (App Router) with server components and server actions, SQLite via
`better-sqlite3`, and Tailwind. No client-side data fetching and no API layer —
pages read the database directly and mutations are server actions.

```
src/
  lib/
    dates.ts          Civil date/time helpers — no UTC, no DST traps
    recurrence.ts     Expanding a repeat rule into occurrences
    day-layout.ts     Packing clashing events into columns
    event-input.ts    Form validation, shared by create and edit
    events.ts         Reading and writing events
    members.ts        Family members
    auth.ts           PIN hashing, signed sessions, lockout
    db.ts             Connection and schema migrations
  app/                setup · login · who · calendar · settings
  components/         Calendar views, event dialog, shared UI
```

Repeating events are stored once, as a rule, and expanded when read. Editing a
single instance writes a small override row keyed by that instance's original
date, so cancelling one Tuesday costs one row rather than rewriting the series.
Occurrences are generated in blocks that can be jumped to directly, so opening a
month two years out costs a handful of iterations rather than thousands.

### Tests

```bash
npm test          # unit tests
npm run typecheck
```

113 tests cover the parts where being wrong is expensive and invisible:
recurrence expansion (interval phase across long gaps, the 31st, fifth Tuesdays,
29 February, counting rules, single-instance overrides), date arithmetic across
DST and month boundaries, form validation, the day-column packing algorithm, and
the event repository including household isolation.

## Ideas for later

The obvious next additions, in roughly the order a family would miss them:
shared shopping and to-do lists, a meal planner with a recipe box that can push
ingredients onto a shopping list, reminders by email or push, and a read-only
subscription feed so the calendar can also appear in Google or Apple Calendar.

## Also in this repository

`diary/` holds a separate, self-contained app: the **Food & Exercise Diary**, an
installable PWA that stores everything in IndexedDB on the phone, with no
account and no server. It has its own README, its own dependencies and its own
Netlify config (`netlify.toml` in this root points at it). The two apps share
nothing but the repository.
