# Railway Deployment Guide

## Prerequisites

- [Railway](https://railway.com) account (Professional plan or higher)
- `railway` CLI installed: `npm i -g @railway/cli`
- Git repo with the project pushed (GitHub, GitLab, etc.)

---

## 1. Project Structure on Railway

You need **two services** in a single Railway project:

| Service | Type | Source |
|---|---|---|
| **Backend** (FastAPI) | Python Service | Root (`wens_service/`) |
| **Frontend** (React) | Static Site | `web/` |

---

## 2. Backend — FastAPI Service

### 2a. Create the service

```bash
railway login
railway init
railway link
railway service add --name backend
```

Or via the Railway Dashboard:
1. **New Project** → **Deploy from GitHub** → select your repo
2. Click **New** → **Empty Service** → name it `backend`

### 2b. Railway config file

Create `railway.json` in the project root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 2c. Procfile (optional but recommended)

Create `Procfile` in the project root:

```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

The `$PORT` variable is automatically set by Railway. The existing `main.py` `uvicorn.run` block only applies when running `python main.py` directly, so Railway will use the `Procfile` instead.

Alternatively, ensure the `if __name__ == "__main__"` block in `main.py` uses `$PORT`:

```python
if __name__ == "__main__":
    import os, uvicorn
    port = int(os.environ.get("PORT", 8190))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
```

### 2d. Requirements / Dependencies

The `pyproject.toml` is picked up by Nixpacks automatically. Railway uses Nixpacks to detect a Python project and runs `uv sync` or falls back to `pip`. To ensure it works correctly, also create a `requirements.txt`:

```bash
uv export --no-dev > requirements.txt
```

This is optional — Railway's Nixpacks supports `pyproject.toml` natively. If you want to guarantee compatibility, generate `requirements.txt` and commit it.

### 2e. Environment Variables

Set these in Railway Dashboard → Backend Service → **Variables**:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | *(from Railway Postgres)* | Set automatically if you add a Postgres plugin — see section 3 |
| `JWT_SECRET` | `your-secure-random-secret` | Generate: `openssl rand -hex 32` |
| `LLM_BACKEND` | `ollama` or `claude` | Your LLM backend choice |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Only needed if `LLM_BACKEND=claude` |
| `OLLAMA_BASE_URL` | `http://your-ollama-host:11434/v1` | Only needed if `LLM_BACKEND=ollama` (Point to your own Ollama server — Railway cannot host Ollama natively) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Model name for Ollama |
| `DEBUG` | `false` | Toggle debug mode |

> **Important about Ollama**: Railway does not provide GPU instances in standard plans. To use Ollama, run it on a separate VPS (DigitalOcean, Hetzner, etc.) and set `OLLAMA_BASE_URL` to that server's URL. Alternatively, use Claude (set `LLM_BACKEND=claude`) which works out of the box.

---

## 3. PostgreSQL Database

### 3a. Provision via Railway Dashboard

1. In your Railway project → **New** → **Database** → **Add PostgreSQL**
2. Railway automatically sets the `DATABASE_URL` environment variable on all connected services.

### 3b. Run migrations & seed data

Once the backend deploys, it auto-runs migrations from `migrations.py` on startup (via the `lifespan` handler in `main.py`).

To seed initial financial data:

```bash
railway run python seed.py
```

Or attach to the backend service's shell:

```bash
railway shell
python seed.py
```

---

## 4. Frontend — React Static Site

### 4a. Create the service

From the Railway Dashboard:
1. Click **New** → **Empty Service** → name it `frontend`
2. Set **Root Directory** to `web/`
3. Configure:

| Setting | Value |
|---|---|
| Build Command | `npm install && npm run build` |
| Publish Directory | `web/dist` |

### 4b. Configure the API URL

The frontend's `vite.config.ts` proxies `/api` → `localhost:8190` during development only. In production, the frontend needs to know the backend's public URL.

Railway provides a **Public Domain** for each service (e.g., `backend-production-1234.up.railway.app`).

Option A — **Vite proxy won't work in production**. You have two options:

**Option A (Recommended): Set Railway Public Networking**

1. In Railway Dashboard → **Frontend Service** → **Settings** → **Generate Domain** (this gives `frontend.railway.app`)
2. In Railway Dashboard → **Backend Service** → **Settings** → **Generate Domain** (this gives `backend.railway.app`)
3. In the frontend **Variables**, add: `VITE_API_BASE=https://backend-production-xxxx.up.railway.app`
4. Update `web/src/api/client.ts` to use `import.meta.env.VITE_API_BASE` as the base URL:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE || '/api'
```

**Option B: Nixpacks start command proxy** — Not recommended for production.

### 4c. Frontend Environment Variables

| Variable | Value |
|---|---|
| `VITE_API_BASE` | `https://your-backend.up.railway.app` |

---

## 5. Full Deployment Steps (Quick Reference)

```bash
# 1. Login
railway login

# 2. Create project
railway init
railway service add --name backend
railway service add --name frontend

# 3. Add Postgres
# (via Railway Dashboard → New → Database → PostgreSQL)

# 4. Set backend variables
railway variables set JWT_SECRET="$(openssl rand -hex 32)" --service backend
railway variables set LLM_BACKEND=ollama --service backend
railway variables set OLLAMA_BASE_URL=http://your-ollama-host:11434/v1 --service backend
railway variables set OLLAMA_MODEL=qwen2.5:7b --service backend

# 5. Deploy backend
railway up --service backend

# 6. Set frontend variables
railway variables set VITE_API_BASE=https://backend-production-xxxx.up.railway.app --service frontend

# 7. Deploy frontend (root directory = web/)
railway up --service frontend --root web/

# 8. Seed data
railway run python seed.py
```

---

## 6. Ollama on a VPS (if using Ollama backend)

Since Railway cannot run Ollama natively:

1. Provision a VPS (e.g., Hetzner CX22 at ~€4/mo or DigitalOcean $6 droplet)
2. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
3. Pull your model: `ollama pull qwen2.5:7b`
4. Ensure Ollama listens on `0.0.0.0`:

```bash
sudo systemctl edit ollama.service
# Add: Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama
```

5. Set Railway variable `OLLAMA_BASE_URL=http://your-vps-ip:11434/v1`

> **Security**: Restrict port 11434 to Railway's IP range or use a VPN/tunnel.

---

## 7. CI / Auto-Deploy

Railway auto-deploys from GitHub when you push to the connected branch.

For a monorepo with two services, Railway detects changes to each service's root:

- Changes in `web/` → triggers **frontend** build only
- Changes elsewhere → triggers **backend** build only

---

## 8. Custom Domains (Professional Plan)

Railway Professional includes custom domain support:

1. Backend: Settings → **Custom Domain** → `api.yourdomain.com`
2. Frontend: Settings → **Custom Domain** → `app.yourdomain.com`
3. Update `VITE_API_BASE` to `https://api.yourdomain.com`

---

## 9. Troubleshooting

| Issue | Solution |
|---|---|
| Backend crashes on startup | Check logs: `railway logs --service backend`. Ensure `DATABASE_URL` is set. |
| `relation "users" does not exist` | Migrations run on startup via lifespan. Wait a few seconds, or trigger a manual restart. |
| Frontend shows blank page | Open browser console. Check that `VITE_API_BASE` is correct and the backend is reachable. |
| CORS errors | Ensure the backend has CORS middleware allowing the frontend domain (already configured in `main.py` with `allow_origins=["*"]`). |
| Ollama connection refused | Verify VPS firewall allows port 11434 and Ollama is listening on `0.0.0.0`. |
| `uvicorn` port mismatch | The `$PORT` env var is set by Railway. Ensure `main.py` listens on `$PORT` (see section 2c). |
