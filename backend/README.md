# Nudge — Email Automation & Reminder System

A beginner-friendly Python backend project for importing contacts, scheduling personalized email reminders, tracking delivery outcomes, and exporting a CSV report. It uses FastAPI, SQLite, APScheduler and Python's standard-library SMTP client. The API runs in **dry-run mode by default**: no email is sent until you explicitly configure SMTP and disable dry-run.

> The Next.js dashboard in the repository is currently an interactive UI prototype with seeded demo data. It does not yet call this API. The Python backend below is independently runnable; see “Current scope” for limitations.

## What it does

- Import example contacts from CSV or create contacts through the API.
- Create a one-time, timezone-aware reminder with a personalized `{{name}}` token.
- Poll due reminders every 15 seconds; record simulated, sent, failed, or skipped outcomes.
- Review reminders and messages, and create a CSV report.
- Keep SMTP credentials in a local `.env`, never in source control.

### Workflow

`contacts.csv or POST /contacts → create a template message → POST /reminders → APScheduler finds due work → dry-run or SMTP → SQLite message status → CSV report`

### Architecture

```text
Next.js demo dashboard (not yet API-connected)
                  │ (future integration)
                  ▼
FastAPI routes ── SQLite (contacts, reminders, messages)
                       ▲                 │
                       │                 ▼
                 APScheduler ── personalized email ── dry-run / SMTP
                                         │
                                         └── logs + CSV report
```

SQLite is appropriate for a local student demo. For a deployed multi-user system, move to PostgreSQL, add authentication/authorization, and run the scheduler as a separate worker process.

## Project structure

```text
backend/
├── data/contacts.csv          # synthetic .test-domain contacts
├── logs/                      # generated runtime logs (ignored by Git)
├── outputs/                   # generated reports (ignored by Git)
├── src/main.py                # API, scheduler, SQLite access, SMTP sender
├── templates/reminder.txt     # example personalized message
├── .env.example               # safe configuration template
├── requirements.txt
└── README.md
```

## Setup (Windows, macOS, Linux)

Python 3.11+ is recommended. From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the environment:

- Windows PowerShell: `.venv\\Scripts\\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

Install dependencies and configure local settings:

```bash
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and keep `.env` private. The defaults intentionally keep sending disabled. Start the API:

```bash
uvicorn src.main:app --reload
```

Open `http://127.0.0.1:8000/docs` for the interactive API reference and `http://127.0.0.1:8000/health` to check its status.

## Run a safe simulation

1. In `/docs`, call `POST /contacts/import`. It imports `data/contacts.csv`; all addresses use the reserved `.test` domain.
2. Call `GET /contacts` and copy a returned contact `id`.
3. Call `POST /reminders` with a timestamp a minute or two in the future and the copied contact ID:

```json
{
  "contact_id": "PASTE_CONTACT_ID",
  "subject": "A note for {{name}}",
  "body": "Hi {{name}}, this is a local scheduling demo.",
  "scheduled_at": "2026-11-24T10:00:00+05:30"
}
```

Use a future timestamp in your own timezone. It must include a timezone offset. Wait for the scheduled time, or call `POST /scheduler/run` after the reminder is due. With `DRY_RUN=true`, the worker records `simulated`; it does not connect to a mail server. Check `GET /messages` and `GET /reports/messages.csv`.

## Optional SMTP configuration

Only use an account and recipients you control. For Gmail, use an app password (not your normal account password) and review the account's current SMTP/app-password requirements. In your ignored local `backend/.env`, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SENDER_EMAIL`, and `SENDER_NAME`, then set `DRY_RUN=false`. Restart the API. **Never commit `.env`, real recipient lists, app passwords, or logs containing personal data.** Start by sending to your own address and keep volumes low. If settings are missing, the worker records a failure; restore `DRY_RUN=true` to return to simulation.

## API overview

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status and dry-run mode |
| POST | `/contacts` | Create a contact; duplicate email returns 409 |
| GET | `/contacts` | List contacts |
| POST | `/contacts/import` | Import `data/contacts.csv`; duplicate rows are skipped |
| POST | `/reminders` | Schedule a timezone-aware one-off reminder |
| GET | `/reminders` | List reminders; optional `?status=scheduled` filter |
| GET | `/messages` | Latest delivery/simulation records |
| POST | `/scheduler/run` | Process due reminders immediately |
| GET | `/reports/messages.csv` | Write a CSV report under `outputs/` |

## Implementation phases and expected proof

1. **Setup:** create a virtualenv and install requirements. Proof: `uvicorn` starts and `/health` returns `ok`.
2. **Contacts:** import the sample CSV and inspect `/contacts`. Proof: three synthetic `.test` contacts.
3. **Personalization:** schedule a message containing `{{name}}`. Proof: logs show the rendered recipient and subject.
4. **Scheduling:** create a future reminder and let APScheduler poll it. Proof: the reminder transitions out of `scheduled`.
5. **Tracking and reports:** inspect `/messages` and export the report. Proof: CSV includes status and error columns.
6. **Portfolio:** add screenshots and documentation, review ignored files, then push to GitHub.

Common beginner mistakes: running commands from the wrong directory; forgetting to activate the venv; creating timestamps without a timezone; using real credentials in code; expecting a future reminder to send immediately; and assuming the dashboard prototype is already wired to this API.

## GitHub portfolio checklist

Suggested repository name: `email-automation-reminder-system`. Suggested description: “A Python FastAPI + SQLite reminder scheduler with safe SMTP dry-run, delivery tracking, and CSV reports.” Suggested topics: `python`, `fastapi`, `sqlite`, `automation`, `scheduler`, `email`.

Before publishing, confirm `.env`, virtualenvs, database files, logs, and real contact data are ignored. Commit synthetic examples only. A practical commit sequence:

1. `feat: add FastAPI reminder API and SQLite schema`
2. `feat: add contact CSV import and safe mail simulation`
3. `feat: add reminder scheduler and CSV reporting`
4. `docs: add setup guide and project screenshots`

Capture screenshots of the folder tree, sample CSV, API docs, `/health`, dry-run terminal log, reminder and message lists, generated report, and GitHub repository page. Save screenshots under an `images/` directory only after checking that they do not expose private data or credentials.

## Interview preparation

1. **Explain your project.** “I built a Python email reminder API that imports contacts, schedules timezone-aware messages, personalizes templates, and tracks outcomes in SQLite. It defaults to a dry run, so I can demonstrate the scheduling workflow without contacting real people.”
2. **Why FastAPI?** It provides typed request validation, generated OpenAPI docs, and a lightweight API surface.
3. **Why SQLite?** It is easy to run locally without infrastructure; a production multi-worker deployment should use PostgreSQL.
4. **How do you protect SMTP credentials?** Read them from environment configuration, exclude `.env` from Git, and use a secret manager in production.
5. **How is a reminder scheduled?** APScheduler periodically queries indexed scheduled rows whose UTC timestamp is due, then the worker processes them.
6. **Why store timestamps in UTC?** UTC avoids ambiguous local times; the API requires an offset and normalizes it before storage.
7. **How are emails personalized?** The worker replaces the supported `{{name}}` token using the contact record.
8. **How are failures tracked?** Each attempt creates a message row with status and an error string, and the application logger records exceptions.
9. **What would you improve for production?** Add auth and tenant isolation, a durable queue, retry/backoff and idempotency, unsubscribe enforcement, provider webhooks, monitoring, migrations, and separate worker deployment.
10. **How would the dashboard connect?** Add typed API calls for contacts, reminders and messages, configure a server-side API base URL, and handle loading/error states; never expose SMTP secrets in browser code.

## Current scope and production caveats

This is a learning/demo foundation, not a production bulk-mail service. It supports one-off reminders only; recurrence rules, bounded retries, delivery-provider callbacks, authentication, user/tenant isolation, and a live Next.js-to-FastAPI connection are not implemented. The dashboard currently uses seeded demo data and client state. The scheduler runs inside the API process, so run only one instance against this SQLite database. Add those safeguards before real operational use.
