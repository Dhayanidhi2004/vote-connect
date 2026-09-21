# Running the demo locally

The prototype has three parts: **local Supabase (Postgres)**, the **FastAPI backend**, and the
**Next.js frontend**.

## Prerequisites
- Docker Desktop running (for local Supabase)
- Python 3.11+ and Node 18+

## 1. Start local Supabase (Postgres + Studio)
```bash
cd constituency-youth-platform
npx supabase start        # first run pulls Docker images (a few minutes)
```
This exposes Postgres at `127.0.0.1:54322` and Supabase Studio at `http://127.0.0.1:54323`.
The backend reads `backend/.env` → `DATABASE_URL=postgresql+pg8000://postgres:postgres@127.0.0.1:54322/postgres`.

> To run WITHOUT Supabase/Docker, delete (or blank) `DATABASE_URL` in `backend/.env` and the
> backend falls back to a local SQLite file. Everything else is identical.

## 2. Backend (FastAPI) — port 8001
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # loads Velachery / Tamil Nadu demo data
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
API docs: http://127.0.0.1:8001/docs

> Port 8001 is used because local Supabase already occupies :8000.

## 3. Frontend (Next.js) — port 3000
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:3000  (`frontend/.env.local` points it at the API on :8001).

> Frontend artifact safety: `npm run dev` now writes to `frontend/.next-dev`
> while production `npm run build` and `npm run start` use
> `frontend/.next-prod`. This prevents mixed Next.js artifacts from breaking
> routes after switching between dev and production commands. To clear cached
> frontend output manually, run `npm run clean`.

## Demo logins (phone → OTP is shown on screen)
| Role        | Phone       |
|-------------|-------------|
| Youth (Karthik R)      | `9000000003` |
| Recruiter (Zoho)       | `9000000002` |
| Training provider      | `9000000007` |
| MLA / Admin            | `9000000001` |

You can also register a brand-new Youth or Recruiter from the login screen.
