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
│   ├── components/      # UI components
│   ├── context/         # Global state
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Route views
│   ├── routes/          # Express API handlers
│   ├── services/        # Stripe, Gemini, and Supabase logic
│   └── utils/           # Web workers and helper functions
├── supabase/            # Schema, RLS policies, and migrations
├── scripts/             # Internal security and build scripts
├── server.js            # Node.js entry point
└── vercel.json          # Deployment routing
