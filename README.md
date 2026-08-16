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

The calendar lives in a single SQLite file, so hosting it needs somewhere with a
**persistent disk**. Any small VPS, or Fly.io / Railway / Render, is plenty — this
is a handful of rows, not a workload. Platforms with no persistent disk (Vercel,
Netlify, and similar) will lose the data on every deploy, so they aren't suitable
as-is.

A `Dockerfile` is included:

```bash
docker build -t family-organiser .
docker run -d -p 3000:3000 -v family-data:/data --name family family-organiser
```

The volume at `/data` is where the calendar is kept, so it survives updates.

> Note: the Docker image itself has not been built and run — there was no Docker
> daemon available in the environment this was written in. What *has* been tested
> is the exact build the image runs: the standalone Next.js server, its bundled
> native SQLite binding, static asset serving, and writing the database to an
> absolute `DATABASE_PATH` like `/data`. The full browser test suite passes
> against that build.

Whatever you host it on, **put it behind HTTPS**. Session cookies are marked
`secure` in production and won't be stored over plain HTTP.

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
