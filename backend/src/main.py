"""Student-friendly email automation API with safe dry-run defaults."""
from __future__ import annotations

import csv
import logging
import os
import smtplib
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path
from typing import Literal

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
DB_PATH = Path(os.getenv("DATABASE_PATH", str(ROOT / "data" / "automation.db")))
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(level=logging.INFO, handlers=[logging.FileHandler(LOG_DIR / "automation.log"), logging.StreamHandler()], format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("nudge")
scheduler = AsyncIOScheduler(timezone="UTC")

SCHEMA = """
CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, timezone TEXT NOT NULL DEFAULT 'UTC', unsubscribed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, contact_id TEXT NOT NULL REFERENCES contacts(id), subject TEXT NOT NULL, body TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, reminder_id TEXT NOT NULL REFERENCES reminders(id), contact_id TEXT NOT NULL REFERENCES contacts(id), subject TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, error TEXT);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, scheduled_at);
"""

def connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection

def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript(SCHEMA)

def row_dict(row: sqlite3.Row) -> dict:
    return dict(row)

class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    timezone: str = Field(default="UTC", max_length=80)

class ReminderIn(BaseModel):
    contact_id: str
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=12000)
    scheduled_at: datetime

class ImportResult(BaseModel):
    imported: int
    skipped: int

class ReminderView(BaseModel):
    id: str
    contact_id: str
    subject: str
    body: str
    scheduled_at: str
    status: str
    created_at: str


def send_email(to_email: str, to_name: str, subject: str, body: str) -> tuple[str, str | None]:
    """Send SMTP when explicitly enabled; otherwise safely record a simulation."""
    if DRY_RUN:
        logger.info("DRY RUN to=%s subject=%r", to_email, subject)
        return "simulated", None
    host, username, password = os.getenv("SMTP_HOST"), os.getenv("SMTP_USERNAME"), os.getenv("SMTP_PASSWORD")
    if not all((host, username, password)):
        raise RuntimeError("SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD are required when DRY_RUN=false")
    message = EmailMessage()
    message["From"] = formataddr((os.getenv("SENDER_NAME", "Nudge Demo"), os.getenv("SENDER_EMAIL", username)))
    message["To"] = formataddr((to_name, to_email))
    message["Subject"] = subject
    message.set_content(body)
    with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=20) as server:
        server.starttls()
        server.login(username, password)
        server.send_message(message)
    logger.info("Email sent to=%s subject=%r", to_email, subject)
    return "sent", None

async def process_due() -> None:
    now = datetime.now(timezone.utc).isoformat()
    with connect() as db:
        due = db.execute("SELECT r.*, c.name, c.email, c.unsubscribed FROM reminders r JOIN contacts c ON c.id=r.contact_id WHERE r.status='scheduled' AND r.scheduled_at<=? ORDER BY r.scheduled_at LIMIT 50", (now,)).fetchall()
        for item in due:
            message_id = str(uuid.uuid4())
            status, error = "failed", None
            try:
                if item["unsubscribed"]:
                    status, error = "skipped", "Contact is unsubscribed"
                else:
                    personalized = item["body"].replace("{{name}}", item["name"])
                    status, error = send_email(item["email"], item["name"], item["subject"].replace("{{name}}", item["name"]), personalized)
            except Exception as exc:
                error = str(exc)
                logger.exception("Delivery failed for reminder %s", item["id"])
            db.execute("INSERT INTO messages(id,reminder_id,contact_id,subject,status,created_at,error) VALUES(?,?,?,?,?,?,?)", (message_id, item["id"], item["contact_id"], item["subject"], status, now, error))
            db.execute("UPDATE reminders SET status=? WHERE id=?", ("completed" if status in ("sent", "simulated", "skipped") else "failed", item["id"]))

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    scheduler.add_job(process_due, "interval", seconds=15, id="send-due", max_instances=1, coalesce=True)
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)

app = FastAPI(title="Nudge Email Automation API", version="1.0.0", lifespan=lifespan)

@app.get("/health")
def health():
    return {"status": "ok", "dry_run": DRY_RUN}

@app.post("/contacts", status_code=201)
def create_contact(payload: ContactIn):
    contact_id = str(uuid.uuid4())
    try:
        with connect() as db:
            db.execute("INSERT INTO contacts(id,name,email,timezone) VALUES(?,?,?,?)", (contact_id, payload.name, str(payload.email), payload.timezone))
    except sqlite3.IntegrityError as exc:
        raise HTTPException(409, "A contact with this email already exists") from exc
    return {"id": contact_id, **payload.model_dump(mode="json")}

@app.get("/contacts")
def list_contacts():
    with connect() as db:
        return [row_dict(row) for row in db.execute("SELECT id,name,email,timezone,unsubscribed FROM contacts ORDER BY name")]

@app.post("/contacts/import", response_model=ImportResult)
def import_contacts():
    path = ROOT / "data" / "contacts.csv"
    if not path.exists():
        raise HTTPException(404, "data/contacts.csv was not found")
    imported = skipped = 0
    with path.open(newline="", encoding="utf-8-sig") as file, connect() as db:
        for row in csv.DictReader(file):
            try:
                db.execute("INSERT INTO contacts(id,name,email,timezone) VALUES(?,?,?,?)", (str(uuid.uuid4()), row["name"].strip(), row["email"].strip().lower(), row.get("timezone", "UTC").strip() or "UTC"))
                imported += 1
            except (sqlite3.IntegrityError, KeyError):
                skipped += 1
    return {"imported": imported, "skipped": skipped}

@app.post("/reminders", status_code=201, response_model=ReminderView)
def create_reminder(payload: ReminderIn):
    scheduled = payload.scheduled_at
    if scheduled.tzinfo is None:
        raise HTTPException(422, "scheduled_at must include a timezone, e.g. 2026-11-24T10:00:00+05:30")
    reminder_id = str(uuid.uuid4())
    with connect() as db:
        if not db.execute("SELECT 1 FROM contacts WHERE id=?", (payload.contact_id,)).fetchone():
            raise HTTPException(404, "Contact not found")
        db.execute("INSERT INTO reminders(id,contact_id,subject,body,scheduled_at,created_at) VALUES(?,?,?,?,?,?)", (reminder_id, payload.contact_id, payload.subject, payload.body, scheduled.astimezone(timezone.utc).isoformat(), datetime.now(timezone.utc).isoformat()))
        row = db.execute("SELECT * FROM reminders WHERE id=?", (reminder_id,)).fetchone()
    return row_dict(row)

@app.get("/reminders")
def list_reminders(status: Literal["scheduled", "completed", "failed"] | None = None):
    with connect() as db:
        if status:
            rows = db.execute("SELECT r.*, c.name AS contact_name, c.email FROM reminders r JOIN contacts c ON c.id=r.contact_id WHERE r.status=? ORDER BY r.scheduled_at", (status,))
        else:
            rows = db.execute("SELECT r.*, c.name AS contact_name, c.email FROM reminders r JOIN contacts c ON c.id=r.contact_id ORDER BY r.scheduled_at")
        return [row_dict(row) for row in rows]

@app.get("/messages")
def list_messages():
    with connect() as db:
        return [row_dict(row) for row in db.execute("SELECT m.*, c.name AS contact_name, c.email FROM messages m JOIN contacts c ON c.id=m.contact_id ORDER BY m.created_at DESC LIMIT 500")]

@app.post("/scheduler/run")
async def run_scheduler_now():
    await process_due()
    return {"processed": True, "dry_run": DRY_RUN}

@app.get("/reports/messages.csv")
def export_messages():
    with connect() as db:
        rows = db.execute("SELECT m.id,c.name,c.email,m.subject,m.status,m.created_at,m.error FROM messages m JOIN contacts c ON c.id=m.contact_id ORDER BY m.created_at DESC").fetchall()
    output = ROOT / "outputs" / "message-report.csv"
    output.parent.mkdir(exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["message_id", "name", "email", "subject", "status", "created_at", "error"])
        writer.writerows([tuple(row) for row in rows])
    return {"file": str(output.relative_to(ROOT)), "rows": len(rows)}
