# Food & Exercise Diary

A private daily log of what you ate, whether you trained and how you felt.
One user, one device, no account, no server, no cloud.

It is a PWA: add it to your phone's home screen and it opens like an app, works
with no signal, and keeps everything in IndexedDB on the phone itself. Nothing
is ever uploaded — there is no backend to upload it to.

**No calorie counting.** No macros, no food database, no scoring, no nudging
about whether a day was good or bad. Just the record.

## What is in it

| Tab | What it does |
| --- | --- |
| **Today** | Breakfast, lunch, dinner, snacks, drinks, water, slips, the two exercise sessions, a swim, how you felt, a photo and notes. Autosaves as you type — there is no Save button. Arrows step back to earlier days. |
| **History** | Every day, newest first, with a one-line summary and markers for AM / PM / swim / photo / slips. Tap a row to edit it. |
| **Progress** | Week-by-week table, streaks, a bar chart of sessions per week, and a photo timeline with a side-by-side compare. |
| **Plan** | The seven-day exercise programme, phase notes and ground rules. Read-only. |
| **Settings** | Start date, programme length, session times, the avoid list, exports, backup / restore, erase. |

## Running it locally

Requires Node 20 or newer.

```bash
cd diary
npm install
npm run dev      # http://localhost:5173
```

For the real thing — service worker, offline, installability — build and preview:

```bash
npm run build
npm run preview  # http://localhost:4173
```

The service worker is only active in a production build, so offline behaviour
must be checked against `npm run preview`, not `npm run dev`.

Other scripts:

- `npm run typecheck` — TypeScript, no emit.
- `npm run icons` — regenerates the app icons in `public/icons/` (navy square,
  white tick). Only needed if you change the icon design.

## Deploying to Netlify

`netlify.toml` sits in the repository root and already points at this folder.

**From the Netlify UI:** connect the repository and accept the settings it reads
from `netlify.toml` — base directory `diary`, build command `npm run build`,
publish directory `diary/dist`.

**From the CLI:**

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

Netlify serves it over HTTPS, which the service worker requires. Any other
static host works too — the build output in `dist/` is plain files.

### If the deploy fails in `@netlify/plugin-nextjs`

This repository also contains a Next.js app at its root. When you link the
repository, Netlify inspects the **root** — not the base directory — decides the
project is Next.js, and auto-installs the Next.js Runtime plugin. That plugin
then fails, because the thing actually being built here is a static Vite site
with no Next.js output for it to find.

The build itself is fine; the plugin is the problem. Remove it:

**Project configuration → Build & deploy → Build settings → Runtime → Remove**,
then retry the deploy.

Setting the base directory to `diary` in the Netlify UI stops the same
misdetection happening if you ever re-link the repository.

## Adding it to an iPhone home screen

1. Open the site in **Safari** (it must be Safari — Chrome on iOS cannot
   install web apps).
2. Tap the **Share** button (the square with the arrow out of the top).
3. Scroll down and tap **Add to Home Screen**.
4. Name it (it will suggest "Diary") and tap **Add**.
5. Open it from the home screen icon. It runs full-screen with no browser bar,
   and works with no signal.

On Android Chrome: open the site, tap the **⋮** menu, then **Add to Home
screen** or **Install app**.

### One warning about iOS

The data lives in the phone's storage for that app. It survives restarts and
updates, but iOS can clear the storage of a home-screen web app that has not
been opened for a long stretch, and "Clear History and Website Data" in Safari
settings will take it with everything else. **Take a backup from Settings now
and then** — it is the only safety net, and it is one tap.

## Reminders — read this before relying on them

Settings can turn on notifications at the two session times, and where the
browser supports it, they fire. Where it does not, nothing happens and nothing
pretends otherwise.

Be clear about the limit: **a web app added to the iPhone home screen cannot be
trusted to deliver scheduled notifications.** The app can only fire a reminder
while it is actually running. There is no push server here and there is not
going to be one.

Set two repeating alarms on your phone — 06:00 and 19:20 — and treat anything
this app manages as a bonus.

## Your data

Everything is in IndexedDB in the browser, under `food-exercise-diary`: one
record per calendar day keyed by ISO date, photos as JPEG blobs, and settings.
Photos are shrunk to 900px on the long edge and compressed to JPEG at 0.7
quality before they are stored, so a year of daily photos stays small.

From Settings you can:

- **Export CSV** — one row per day, every field, opens straight in Excel.
- **Export photos** — a zip of the JPEGs, named by date.
- **Backup everything** — a single JSON file with the days, the settings and the
  photos inline. **Restore from backup** reads it back.
- **Erase all data** — behind a confirm.

## Editing the exercise programme

The whole programme is in `src/lib/plan.ts` — seven days, each with a morning
and an evening session, plus the phase notes and ground rules. Edit that one
file; the Plan tab and the session cards on Today both read from it. The session
times shown come from Settings, not from the file.

## Built with

Vite, React, TypeScript, Tailwind CSS, `idb` for IndexedDB, `fflate` for the
photo zip, and `vite-plugin-pwa` for the manifest and service worker.
