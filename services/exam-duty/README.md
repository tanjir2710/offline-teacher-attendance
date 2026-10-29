# DIU Exam Duty

A full-stack teacher portal for the Department of CSE, Daffodil International University. Imported from the Midterm Fall 2026 invigilation roster: **175 teachers, 1,286 duties, seven examination dates**. Electric-green source cells are **ANX1 (Annex 1)**. Includes personal username/password login, activation and recovery codes, whole-day roster-free search, mutually accepted exchanges, and calendar alerts.

## Using the app

1. Browse the faculty directory and open any teacher's roster. Anonymous browsing cannot change duties.
2. The administrator activates the **TAA** profile once, with the private setup code supplied separately. Choose your own username and a password of at least ten characters. Never commit the setup code.
3. In **Administration**, create a one-time code for a verified teacher. Give it to that teacher privately. They select **Activate / reset**, choose their roster profile, and create their own username and password. Codes expire after seven days. Issuing another code replaces the previous one.
4. A signed-in teacher opens **Find a swap**, chooses their duty date and one slot or all duties that day, then searches colleagues with no rostered duty for those slots or the whole day.
5. Choose a colleague with an activated account. Propose one or more return duties, or request coverage with no duty in return. The recipient can accept or decline; the sender can cancel. Accepting checks current ownership, duty versions, slot clashes, unresolved imports and start times in a database transaction. Both schedules update together. Repeated or stale acceptance cannot change the roster again.
6. Set preferred off days in **My profile**. They highlight conflicts with personal preferences; they do not constitute authorized leave. The original roster states that there is no official day off during examinations.

“Roster-free” means only that this sheet shows no duty. It does not establish that a colleague is available. Faculty marked `*` also have exams or duties outside this roster.

## Times and reminders

All displayed exam times use **Asia/Dhaka (UTC+6)**.

| Slot | Examination | 40-minute reminder | Arrive at Exam Control |
| --- | --- | --- | --- |
| A | 9:00–10:30 AM | 8:20 AM | 8:30 AM |
| B | 11:30 AM–1:00 PM | 10:50 AM | 11:00 AM |
| C | 2:00–3:30 PM | 1:20 PM | 1:30 PM |

The updated arrival instruction is **30 minutes before examination start**, superseding the PDF's older 20-minute notice.

- **In-app reminders:** permission-based browser notifications while this page is open. They are best effort if the tab or device sleeps. This is not a background web-push service.
- **Calendar alerts:** download `.ics` and import into a calendar app that supports `VALARM`. Every unambiguous duty carries `TRIGGER:-PT40M`. Confirm notification permissions and the imported alarm in your calendar app. These alerts can operate when this web app is closed.
- **After an accepted swap:** both teachers must delete their previous imported exam calendar and import a fresh download. Do not retain both copies. The downloaded calendar is not a live subscription.
- **Swap requests:** appear in the app and refresh every 30 seconds while signed in. No email, SMS or off-app push provider has been configured.

## Source provenance and review

- Dates: 28, 29 and 31 October; 1, 2, 3 and 4 November 2026.
- ANX1: **380** assignments detected from electric-green cell fills. Other cells use the roster's Knowledge Tower center, **KT-204, Level 2**.
- Individual exam-room numbers and the Annex control-room number are not in the source. Confirm deployment with Exam Control.
- One source inconsistency: **RNA, 1 November**, contains “B” in column C. It is visibly flagged and blocked from swapping and calendar export until an administrator records the committee-confirmed slot. If B clashes with an existing B duty, the database rejects the correction; obtain a corrected roster from the committee.
- Five teachers have no listed initials. Their initials remain missing; suggested login aliases are `ft11`, `ct28`, `ot1`, `ot2`, and `ot3`. Six part-time teachers' initials are taken from parentheses in their names.
- The JSON keeps each teacher's source page, faculty group, designation, and external-duty marker; every duty retains source page, original printed slot, and building.
- The original PDF is not modified. `scripts/roster/extract_roster.py` reproduces the import from an explicitly supplied local PDF. It requires PyMuPDF (`fitz`).

## Development

Node >=22.13, pnpm, Git. Dependencies are locked in `pnpm-lock.yaml`.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
```

A Cloudflare D1 binding named **DB** is required. `.openai/hosting.json` declares it for Sites. Schema migrations and Drizzle metadata are committed under `drizzle/`. Seed records live in `data/roster.json`, outside migrations, and are inserted idempotently into an empty database. Do not clear a production database to reimport; that would erase agreed exchanges.

For local D1 setup after building:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_round_true_believers.sql
pnpm dev
```

Set `ADMIN_ACTIVATION_HASH` as a runtime secret containing the SHA-256 hex digest of a randomly generated private activation code. The plain code is given only to the administrator; no default password or live secret belongs in this repository. For local development, use an ignored `.dev.vars` file if your local runtime supports it. Existing activated accounts never rely on the bootstrap secret again.

The independent integration test bundles the real API and runs it in a temporary Miniflare/D1 runtime with test-only credentials. It never contacts production or uses live credentials:

```sh
node scripts/test-integration.mjs
```

Validated: 40 integration checks including activation, password verification, secure cookies, access controls, cross-origin protection, atomic acceptance, double acceptance, stale-request protection, calendar UTC conversion, preferences, recovery-code consumption, session revocation and logout.

## Hosting and GitHub

This app requires a server runtime and database. **GitHub Pages alone cannot run authentication or shared swaps.** Store source in GitHub and deploy the full app to a compatible Cloudflare Worker / Sites runtime with D1. Preserve the included Sites build integration when using Sites. A new Sites preview starts owner-private; additional teachers need an appropriate audience policy or their own reachable deployment, plus their individual app accounts.

To put this source into a new empty repository after GitHub sign-in is available, add a separate Git remote and push the source branch. Keep the existing Sites source remote intact. Do not commit `node_modules`, `dist`, `.wrangler`, `.sites-runtime`, local databases, environment files, secrets or deployment archives.

## Important limits

This portal records teachers' mutual agreement. It does not notify the examination committee or replace any required committee approval. Browser notifications are not guaranteed when the page is closed. Calendar changes require reimport after swaps. Missing outside commitments cannot be inferred from blank roster cells.


The existing ClassRoll GitHub Pages app is supported by the API through an allowlisted origin and bearer sessions. The server audience remains private until the owner explicitly changes teacher access. Cross-origin API support does not bypass the Sites audience policy.
