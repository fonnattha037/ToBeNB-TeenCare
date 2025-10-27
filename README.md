# ToBeNB-TeenCare

This package is a starter Node.js webhook and chat flow for a LINE Official Account
designed to provide basic mental health screening (9Q) and routing to school counselors.

## What's included
- server.js : Node.js + Express webhook (local/demo ready)
- package.json
- .env.example
- sql/schema.sql
- flex/admin_forward_flex.json
- docs/consent_template.md
- docs/admin_checklist.md
- README.md (this file)

## Quick deploy (Render)
1. Create a new GitHub repo and push these files.
2. Sign up / log in to https://render.com
3. Create a new Web Service -> Connect to your GitHub repo.
4. Set Environment Variables on Render (LINE_CHANNEL_SECRET, LINE_CHANNEL_ACCESS_TOKEN, DATABASE_URL, ADMIN_LINE_IDS).
5. Deploy. After deploy, Render provides an HTTPS URL: e.g. https://your-service.onrender.com
6. Set LINE Messaging API webhook URL to: `https://your-service.onrender.com/webhook` and enable webhook in LINE Developers Console.

## Security notes
- Do NOT commit secrets to GitHub. Use Render environment variables.
- Replace the in-memory session store with Redis for production.
- Follow PDPA and school policies for consent and data retention.

