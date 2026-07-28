# JT Handyman Solutionz — website

A rebuild of the JT Handyman Solutionz concept site: 7 pages plus a new
**Plaster Repair** service page, with an instant-quote form that creates a
real Client + Job in **ServiceM8** when someone submits it.

## Pages

| Page | File |
|---|---|
| Home | `index.html` |
| Services | `services.html` |
| Our Work (gallery, filterable) | `our-work.html` |
| Recent Jobs (live ServiceM8 feed) | `recent-jobs.html` |
| About | `about.html` |
| Blog | `blog.html` |
| Contact / Instant Quote | `contact.html` |
| **Plaster Repair** (new) | `plaster-repair.html` |

## What's real vs. placeholder

- **Copy, layout, structure** — written fresh for this build, matching the
  flow of the original concept site page by page.
- **Photos** — every image is a labelled placeholder block (`.ph` in
  `css/styles.css`). Swap them for real job photos before going live —
  see "Adding real photos" below.
- **ServiceM8 integration — real, not mocked.** The quote form and the
  recent-jobs ticker both talk to the actual ServiceM8 REST API through a
  small server-side layer (see below).

## Why there's a backend at all

Your ServiceM8 API key must **never** be sent to the browser — anyone who
viewed the page source could lift it and get full read/write access to your
ServiceM8 account (clients, jobs, invoices, everything the key is scoped to).
So the key lives only on the server, in an environment variable, and the
browser talks to two small endpoints instead:

```
Browser                    Your server                    ServiceM8
--------                   -----------                    ---------
POST /api/submit-quote  →  api/submit-quote.js         →  company.json (create/find client)
                                                        →  job.json (create job, status "Quote")
                                                        →  jobcontact.json (attach contact)

GET  /api/recent-jobs   →  api/recent-jobs.js          →  job.json (status=Completed)
                            (strips everything except
                             category, suburb, date)
```

The API key logic lives in `lib/servicem8.js`.

## Running it locally

```bash
npm install
cp .env.example .env        # then paste your real key into .env
npm start                   # serves the site at http://localhost:3000
```

A `.env` file with the key you gave me is already included for convenience —
**treat it as a secret**. It's listed in `.gitignore` so it won't get
committed if you push this to GitHub. Rotate the key in ServiceM8 if it's
ever exposed (e.g. pasted somewhere public).

## Deploying

**Option A — Vercel / Netlify (easiest):**
The `api/` folder is already written in the format both platforms expect
for serverless functions — just push the repo and add `SERVICEM8_API_KEY`
as an environment variable in the project's dashboard. `server.js` isn't
used on these platforms; ignore it.

**Option B — any Node host (VPS, Render, Railway, etc.):**
```bash
npm install
npm start
```
Set `SERVICEM8_API_KEY` as an environment variable on the host (don't rely
on the `.env` file in production — use the host's secrets manager).

## Adding real photos

Every placeholder is a `<div class="ph ...">` — search for `class="ph"` in
any page. Replace the div with an `<img>` tag pointing at your photo, e.g.:

```html
<!-- before -->
<div class="ph ratio-wide"><span>Tiled shower with glass screen — East Melbourne</span></div>

<!-- after -->
<img src="assets/img/tiled-shower-east-melbourne.jpg" alt="Tiled shower with glass screen, East Melbourne" style="border-radius:4px;">
```

Drop image files into `assets/img/`.

## Editing the quote form fields

Fields sent from `contact.html`'s form (`js/quote-form.js`) are:
`name, phone, email, service, address, message`. If you add/remove a field,
update both the `<input name="...">` in `contact.html` and the mapping in
`lib/servicem8.js` (`createJob` / `createJobContact`).

## Notes on the ServiceM8 fields used

- **Client** → ServiceM8 `Company` object (`company.json`)
- **Job** → `job.json`, created with `status: "Quote"` so it lands in your
  Quotes queue for review rather than being auto-scheduled
- **Contact** → `jobcontact.json`, so the enquirer's name/phone/email show
  on the job card

Double-check these against your ServiceM8 setup (e.g. if you use custom
job categories or a specific queue for web enquiries) — you can add
`category_uuid` or `queue_uuid` in `lib/servicem8.js`'s `createJob()` call.
Full field reference: https://developer.servicem8.com/reference/createjobs
