# NestPoint (Azure-first)

Joshua — this is a **working starter** for NestPoint designed to stay **Microsoft/Azure-only** and **cheap/free-friendly**:

- **Hosting:** Azure Static Web Apps
- **Auth:** SWA built-in auth (Microsoft sign-in)
- **API:** Azure Functions (Node)
- **Data:** Azure Table Storage (via Storage Account)
- **Media:** Azure Blob Storage (same Storage Account)

> ✅ Includes: family “spaces”, role-based membership, calendar (MVP list), work orders (MVP), grocery list (shared), and a private feed (posts + photo/video upload via SAS).

---

## Folder structure

- `app/` — React + Vite frontend
- `api/` — Azure Functions backend
- `staticwebapp.config.json` — route protection + SPA fallback

---

## 1) Azure prerequisites

1. Create a **Storage Account** in Azure.
2. In that storage account, you do **not** need to manually create tables/containers — the app creates them on first run.
3. Deploy with **Azure Static Web Apps** connected to a GitHub repo.

---

## 2) Environment variables (Azure App Settings)

Set these in **Static Web App → Configuration → Application settings**:

- `AZURE_STORAGE_CONNECTION_STRING` (required)
- `ADMIN_BOOTSTRAP_CODE` (recommended) — default is `Admin`
- `MEDIA_CONTAINER` (optional) — default `media`

See `.env.example` for reference.

---

## 3) Auth setup (Microsoft-only)

In your Static Web App:
- Enable authentication provider **Azure Active Directory (Microsoft)**.
- That enables the in-app links:
  - `/.auth/login/aad`
  - `/.auth/logout`

---

## 4) First-time “Admin” bootstrap

To create the first household space:
1. Sign in.
2. Go to **Welcome**.
3. Create a space using the admin code.

**Default code:** `Admin` (change it via `ADMIN_BOOTSTRAP_CODE`).

---

## 5) Local development (optional)

### Frontend only
```bash
cd app
npm install
npm run dev
```

### Full stack (recommended)
Use the Static Web Apps CLI so auth + API routing match Azure:

```bash
npm install -g @azure/static-web-apps-cli

cd app
npm install
cd ../api
npm install

# from repo root:
swa start http://localhost:5173 --api-location api --run "npm --prefix app run dev"
```

---

## Notes / Roadmap

This starter is intentionally lean but structured for the “sophisticated” version:
- Month/week calendar views + recurrence rules
- Work order comments, assignments, photos per task
- Seasonal reminder templates that auto-generate work orders
- Multiple grocery lists + favorites/pantry
- Feed moderation tools + albums

---

If you want the next iteration, tell me which module you want upgraded first (Calendar UI, Work Order comments/attachments, or Reminders).
