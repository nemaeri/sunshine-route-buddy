
# JEC School Management System — Build Plan

A full-stack SMS for Jayden Educational Centre with admin, teacher, parent, and driver portals — including live GPS bus tracking for parents.

## Heads-up on hosting

Your spec targets cPanel + Node.js + JSON files. Lovable's runtime is **TanStack Start (React 19) on Cloudflare Workers + Supabase Postgres**. A few options:

1. **Recommended:** Build on Lovable's stack and publish to a `*.lovable.app` URL (or a custom domain via Cloudflare). cPanel becomes irrelevant.
2. **Self-host:** Lovable supports self-hosting, but the runtime is Cloudflare Workers — cPanel Node.js will not run this codebase as-is. Porting to Next.js + JSON files would mean rewriting outside Lovable.
3. **Hybrid:** Use Lovable Cloud for DB/auth/realtime, embed/iframe the app from your cPanel-hosted marketing site.

I'll assume **Option 1** for the plan. Confirm or pick another and I'll adjust.

---

## Roles & portals

- **Admin** — full school operations
- **Teacher** — classes, attendance, marks, messages
- **Parent** — children, attendance, fees, report cards, messages, **live bus tracking**
- **Driver** — assigned route, share live GPS, mark pickups/drop-offs
- **Finance** — fees, invoices, payroll
- **Student** (optional later) — own report cards, timetable

Role table (`user_roles`) is separate from profiles, with `has_role()` security-definer function. RLS on every table.

---

## Phased delivery

### Phase 0 — Foundation (1 build)
- Enable Lovable Cloud (Supabase)
- Design system: dark + amber (`#0f1117 / #f5a623`) per spec, in `oklch` tokens
- Pick 1 of 3 design directions (next step after plan approval)
- Auth (email/password), role-based routing, profiles + `user_roles` + `has_role()`
- Shell: sidebar nav, top bar, role-aware menu

### Phase 1 — Academic core
- **Students:** profile, admission no, class, parent links, photo
- **Classes & streams:** Grade 1–6 (CBC), class teacher, subjects
- **Staff:** teaching + non-teaching, KRA PIN, NHIF/NSSF nos
- **Subjects & timetable:** weekly grid per class
- **Attendance:** daily per class (present/absent/late), parent SMS-style notification (in-app)

### Phase 2 — Parent app (web, mobile-first)
- Children dashboard (multi-child)
- Attendance history & today's status
- Fee balance + payment history + invoice download (PDF)
- Report cards (term-by-term)
- Messages from class teacher / admin
- Announcements feed
- **Bus tracking entry point** (Phase 5)

### Phase 3 — Exams & report cards
- CBC strands & sub-strands per subject
- Assessment entry (Exceeding/Meeting/Approaching/Below)
- Termly report card generator (PDF, school branding)
- Class & subject performance analytics (Recharts)

### Phase 4 — Finance & payroll
- Fee structures per class/term
- Invoicing, payments (manual entry + M-Pesa STK push later)
- Receipts (PDF)
- **Payroll:** Kenya KRA 2024 — PAYE, NHIF, NSSF (2023 Act), housing levy, NITA
- Payslips (PDF), monthly payroll register

### Phase 5 — Bus tracking (live GPS)
**Driver app** (mobile web, installable PWA):
- Login → see today's route + stops
- "Start trip" → browser Geolocation API streams lat/lng every 5–10s
- Tap stop → mark "arrived/picked up" → parents of kids at that stop get notified
- "End trip"

**Parent app:**
- "Track bus" tab → Google Maps with bus marker, route polyline, stops, ETA
- Status: Not started / En route / Arrived at stop X / Trip complete
- Push-style in-app notifications on stop events

**Tech:**
- Google Maps connector (you'll connect it; map + routes APIs)
- Supabase Realtime channel `bus:{route_id}` for live position broadcast
- Tables: `routes`, `stops`, `route_assignments` (driver+vehicle+route+date), `bus_positions` (rolling), `stop_events`
- Position stored short-term, purged nightly

### Phase 6 — Communications & polish
- Bulk announcements (class / grade / whole school)
- Direct messages (teacher ↔ parent)
- Email digests (Lovable Email / Resend connector)
- SMS via Twilio connector (optional, paid)
- Admin reports & exports (CSV)
- Audit log

---

## Data model (high level)

```text
profiles ── user_roles ── auth.users
   │
   ├── students ── student_parents ── (parent profiles)
   │      ├── enrollments (class, year)
   │      ├── attendance
   │      ├── assessments ── subjects
   │      ├── report_cards
   │      └── invoices ── payments
   │
   ├── staff ── payroll_runs ── payslips
   │
   ├── classes ── timetable_slots
   │
   └── bus
        ├── vehicles
        ├── routes ── stops
        ├── route_assignments (driver, vehicle, route, date)
        ├── bus_positions (lat,lng,heading,speed,ts)
        ├── stop_events (arrived, picked_up, dropped_off)
        └── student_stop_assignments
```

All tables: RLS on. Parents only see their children's rows; teachers only their classes; drivers only their assignment; admin sees all via `has_role('admin')`.

---

## Technical notes (for the curious)

- **Realtime bus position:** Supabase Realtime broadcast channel (no DB write per tick — only periodic snapshot every 30s for history). Keeps writes cheap.
- **Maps:** Google Maps connector — browser key for the map render, gateway for Directions/Geocoding. You'll get a "Connect Google Maps" prompt at Phase 5.
- **PDFs:** Report cards, invoices, payslips generated client-side with `@react-pdf/renderer` so they work on Workers.
- **Payroll math:** Pure TS module, unit-tested against KRA 2024 brackets.
- **No JSON file DB:** Supabase Postgres replaces `lib/data/*.json` — same data shapes, real auth, real concurrency.

---

## What I need from you to start

1. **Confirm hosting:** OK with publishing on Lovable / custom domain instead of cPanel?
2. **Confirm phases:** Build in the order above, or reshuffle?
3. After approval I'll generate **3 design directions** for the dark-amber JEC theme — you pick one, then I build Phase 0 + Phase 1.

Phase 5 (bus tracking) will trigger the Google Maps connector setup when we get there.
