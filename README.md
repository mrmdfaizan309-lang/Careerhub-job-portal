# CareerHub

CareerHub is a Next.js job board with candidate applications, private status tracking, and a recruiter workspace. It uses PostgreSQL when `DATABASE_URL` is set and a JSON file in `.data/` for local development otherwise.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The development recruiter key is `careerhub-demo-key`.

## PostgreSQL

Set `DATABASE_URL` to a PostgreSQL connection string before starting the app. Tables are created automatically on the first API request. For hosted databases that require TLS, set `DATABASE_SSL=true`.

## Production configuration

Set `DATABASE_URL` and a strong `RECRUITER_API_KEY` in the deployment environment. The local JSON store is intended only for a single-process development setup. Recruiter access here uses a shared key for this MVP; replace it with authenticated recruiter accounts and role-based access before handling real candidate data. Resume links are accepted as URLs; file uploads and cloud storage are not configured.

## API

- `GET /api/jobs?q=` — search roles by title, company, location, or skill.
- `GET /api/jobs/:id` — get a role.
- `POST /api/jobs` — publish a role; requires the `x-recruiter-key` header.
- `POST /api/applications` — submit an application. The response includes a private reference ID.
- `GET /api/applications/:id?tracking=:id` — read only the status tied to that reference.
- `GET /api/recruiter/applications` — list candidates; requires the `x-recruiter-key` header.
- `PATCH /api/applications/:id` — update a candidate status; requires the `x-recruiter-key` header.