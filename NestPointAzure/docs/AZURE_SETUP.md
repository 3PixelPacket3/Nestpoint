# Azure Setup Guide (NestPoint)

## A) Create the Storage Account
1. Azure Portal → **Storage accounts** → **Create**
2. Resource group: your choice
3. Redundancy: LRS is fine for a family app
4. Create

Then:
- Storage account → **Access keys** → copy **Connection string** (Key1)

## B) Create the Static Web App
1. Azure Portal → **Static Web Apps** → **Create**
2. Deployment: GitHub
3. Connect the repo that contains this project
4. Build details:
   - App location: `app`
   - API location: `api`
   - Output location: `dist`
5. Create

## C) Configure Application settings
Static Web App → **Configuration** → **Application settings**:
- `AZURE_STORAGE_CONNECTION_STRING` = (your storage connection string)
- `ADMIN_BOOTSTRAP_CODE` = something you choose (default is Admin)
- `MEDIA_CONTAINER` = `media` (optional)

Save.

## D) Turn on Authentication (Microsoft)
Static Web App → **Authentication**:
- Add provider **Azure Active Directory**
- Follow the portal prompts to create the app registration

After that, these routes work:
- `/.auth/login/aad`
- `/.auth/logout`

## E) First run
1. Open the SWA URL
2. Sign in
3. Go to Welcome (auto-redirect if no space selected)
4. Create your first space using the admin code

## F) Invite family
1. Go to Space Settings
2. Copy the invite code
3. Family signs in and uses the “Redeem invite” endpoint (Phase 2 UI) — or you can temporarily redeem by calling:

```bash
curl -X POST <yourapp>/api/spaces/redeem \
  -H "Content-Type: application/json" \
  -d '{"spaceId":"<spaceId>","code":"<inviteCode>"}'
```

(Phase 2: I’ll add a redeem form to Welcome so you don’t need curl.)
