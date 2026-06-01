# JEC School Management System — cPanel Deployment Guide

## Architecture

- **Frontend**: React SPA built with Vite + TanStack Router (client-side routing)
- **Backend / Database**: Supabase (hosted — no server required on your cPanel)
- **Hosting**: cPanel shared hosting (Apache) — upload static files only

---

## 1. Database Setup (Supabase)

1. Go to [supabase.com](https://supabase.com) → your project → **SQL Editor**
2. Open `database/schema.sql` and run the entire file
3. Copy your **Project URL** and **anon/public key** from Project Settings → API

---

## 2. Configure Environment

Edit `.env` (never commit this file):

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

---

## 3. Build

```bash
npm install
npm run build
```

The output is in the `dist/` folder.

---

## 4. Deploy to cPanel

1. Log into cPanel → **File Manager** → navigate to `public_html` (or a subdomain folder)
2. Upload **all contents** of the `dist/` folder (including the `.htaccess` file)
3. The `.htaccess` is included in `dist/` automatically (it is copied from `public/`)

### If deploying to a subdirectory (e.g. `public_html/jec/`)

Edit `vite.config.ts` before building — add `base`:

```ts
export default defineConfig({
  base: "/jec/",
  // ...
});
```

Then update `public/.htaccess`:
```apache
RewriteBase /jec/
```

---

## 5. First Login

After deploy, go to `https://yourdomain.com/auth` and sign up.
The first account will be assigned the `parent` role by default.

To make yourself admin, run this in Supabase SQL Editor:
```sql
UPDATE public.user_roles
SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
```

---

## 6. Supabase Auth Redirect URLs

In Supabase → Authentication → URL Configuration, add your domain:
```
https://yourdomain.com
https://yourdomain.com/**
```

---

## Roles

| Role | Access |
|------|--------|
| `admin` | Full system — all modules |
| `head_teacher` | Dashboard, students, staff, exams, timetable |
| `finance` | Finance, fees, payroll |
| `teacher` | Teacher portal — own classes, marks, attendance |
| `parent` | My children, my fees, bus tracking |
| `driver` | Bus/transport module |
