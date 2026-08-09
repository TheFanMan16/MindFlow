MindFlow

MindFlow is a full-stack study app that automatically turns uploaded PDFs into active recall tools like flashcards and Feynman Technique sessions using the Gemini API. 

I built this to solve my own study bottlenecks, but I architected it to be a production-ready application with proper state management, background processing, and secure monetization.

Technical Highlights

* **Web Worker Timers:** Offloaded the study session timers to Web Workers to prevent the main thread from blocking and ensure the UI stays responsive during heavy interactions.
* **Payment Integration:** Implemented Stripe checkout sessions and webhooks to handle tiered subscriptions securely. 
* **Auth & Data Security:** Set up a PostgreSQL database via Supabase, utilizing JWT-based authentication and Row Level Security (RLS) policies.
* **CI/CD Pipeline:** Configured automated deployments via GitHub to Vercel (frontend) and Render (backend), with custom rewrite rules and strict environment variable management.

Tech Stack

* **Frontend:** React (Vite), Tailwind CSS, React Context API
* **Backend:** Node.js, Express
* **Database & Auth:** Supabase (PostgreSQL)
* **Integrations:** Google Gemini AI, Stripe API
* **Hosting:** Vercel, Render

Repository Structure

The codebase is split to keep UI components isolated from API and business logic:

├── src/
│   ├── components/      # Study modes and app shell
│   ├── config/          # Client env validation and API endpoints
│   ├── context/         # Global state (auth, profile, timer)
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Supabase browser client
│   ├── pages/           # Route views (auth, legal, panic mode, 404)
│   ├── test/            # Vitest setup and cross-cutting guards
│   └── utils/           # Spaced repetition, AI fetch, helpers
├── services/            # Server-side flashcard generation
├── utils/               # Server-side auth middleware and shared limits
├── supabase/
│   ├── migrations/      # Schema and RLS policies
│   └── functions/       # Deno Edge Functions (Stripe, Gemini)
├── public/              # Static assets and the timer Web Worker
├── scripts/             # Internal security and build scripts
├── server.js            # Express API entry point
├── main.js              # Electron main process
└── vercel.json          # Deployment routing

Environment variables are documented in `.env.example`; copy it to `.env` and
fill in real values. Both the Vite build and the Express server fail hard on
startup when a required variable is missing.

Operations: Render cold starts

The backend runs on Render's free tier, which spins the instance down after
~15 minutes of inactivity. The first request after a spin-down can take
30-60 seconds while the instance boots ("cold start").

Mitigations in place:

* `GET /api/health` — a cheap, unauthenticated health endpoint (registered
  before the rate limiters so pings never consume quota).
* Every AI request in the frontend goes through `src/utils/aiFetch.js`: a
  60-second hard timeout with an AbortController, a Cancel button, rotating
  status copy, and an honest "we're waking the AI up" notice after 8 seconds.
  Timeouts surface a Try Again button instead of a frozen page.

To keep the instance warm, point a free uptime monitor (e.g. UptimeRobot) at
`https://mindflow-backend-1mag.onrender.com/api/health` on a 10-minute
interval. Note: Vercel Cron cannot be used for this — it only invokes paths on
the Vercel deployment itself, and the frontend is a static SPA.

The real fix is upgrading the Render service to a paid always-on instance
(Starter tier), which removes spin-downs entirely. Do this before charging
customers; keep-warm pings are a best-effort workaround, not a guarantee.

Operations: email digest (not yet wired)

Browser "cards due" reminders are built in (Settings → Notifications; one
notification per day, gated on the user's toggle + browser permission). The
email digest requires two external pieces before it can ship:

1. A transactional email provider (e.g. Resend) and its API key.
2. A scheduled Supabase Edge Function (supabase functions deploy + a cron
   schedule) that queries each opted-in user's due-card count and mastery
   slippage, then sends the digest through the provider.

Neither secret exists in this repo, so the function is intentionally not
scaffolded - wire it when the Resend account exists.
