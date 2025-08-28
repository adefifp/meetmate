# MeetMate

MeetMate is a lightweight meeting planner: create a plan, invite people, collect availability, get **smart slot suggestions**, then **finalize** and export to **.ics** or open in **Google Calendar**.

## Overview

- **Magic-link sign-in** (email only)
- **Shareable plan page** at `/p/[token]`
- **Participants add busy intervals**
- **Suggestion engine** (time-zone aware, prefers mid-window, favors higher attendance)
- **Finalize a slot** → show Add to Google Calendar + download `.ics`

## Tech

- **Next.js (App Router)** + **TypeScript**
- **Prisma** + **PostgreSQL**
- **NextAuth** (Email provider)
- **Nodemailer** (SMTP)
- **Zod** for server-side validation

---

## Getting Started (Local)

### 1) Prerequisites
- Node 18+ (or 20+)
- A PostgreSQL database (e.g., Supabase)
- An SMTP account (Gmail works with an **App Password**)

### 2) Install dependencies
```bash
npm i
