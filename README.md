# Tiffany Weekly Agenda

HR fills in one form for the weekly operations meeting. The agenda builds itself in the 12-item order, is saved to Supabase, and is emailed to the participants' group address.

Stack: Next.js 14 (App Router) on Vercel, Supabase (Postgres), Resend (email).

## 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. Copy **Project URL** and the **service_role** key from Project Settings > API.

## 2. Resend (email)
1. Create an account at resend.com and add your sending domain (DNS records).
2. Create an API key.
3. Choose a sender on that domain, for example `Tiffany Diamond Hotels <agenda@yourdomain.com>`.

## 3. GitHub
```bash
cd tiffany-agenda
git init && git add . && git commit -m "Weekly agenda app"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/tiffany-agenda.git
git push -u origin main
```

## 4. Vercel
1. Import the GitHub repository in Vercel (framework: Next.js, no extra settings).
2. Add these environment variables (see `.env.example`):

| Variable | Value |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Verified sender address |
| `HR_ACCESS_CODE` | Long random code HR types on the form |
| `NEXT_PUBLIC_DEFAULT_PARTICIPANTS_EMAIL` | Optional. Pre-fills the group email |

3. Deploy.

## Local run
```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
```

## How it works
- `components/AgendaForm.js`: the form and live agenda. Draft is kept in the browser until sent.
- `app/api/send/route.js`: checks the access code, email and 60-minute total, saves to `meeting_agendas` (status `pending`), sends via Resend, then marks it `sent` or `failed`.
- `lib/agenda.js`: the 12 agenda items, time slots, and the email text and HTML.
- `lib/pdf.js` and `app/api/pdf/route.js`: the A4 PDF report in the logo's colours (download button on the form; also attached to the email). The logo is embedded from `lib/logoData.js`.
- The service role key stays on the server. The table has Row Level Security on with no public policies.

## Next steps worth considering
- Replace the shared access code with Supabase Auth so each sender is identified.
- Add a history page reading `meeting_agendas`.
- Schedule a reminder on Monday and Thursday using Vercel Cron.
