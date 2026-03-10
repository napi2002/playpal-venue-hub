# PlayPal Venue Hub

PlayPal Venue Hub is the web portal for venue operations and internal platform management.

It supports three user types:

- `user`: mobile app users only
- `admin`: venue portal admins
- `internal`: PlayPal internal operations users

The frontend is a Vite + React app. Production API traffic goes to Supabase Edge Functions. There is also a local Express server for local development fallback.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query
- Supabase Auth
- Supabase Edge Functions
- PostgreSQL

## Main App Areas

Venue admin portal:

- `/dashboard`
- `/venue`
- `/availability`
- `/bookings`
- `/payments`
- `/membership`
- `/settings`

Internal operations console:

- `/dashboard`
- `/users`
- `/users/:venueId`
- `/bookings`
- `/payments`
- `/plans`
- `/support`

Notes:

- `internal` users are redirected into the internal console
- `admin` users access the venue portal
- login accepts either email or username

## Project Structure

```text
src/                        Frontend app
supabase/functions/api/     Main Supabase Edge API
supabase/functions/login-identifier/
                            Public login helper for username -> email lookup
supabase/migrations/        Database schema and feature migrations
server/                     Optional local Express API
public/                     Static assets
```

## Local Development

Requirements:

- Node.js 18+
- npm
- Supabase CLI if you are pushing migrations or deploying functions

Install:

```bash
npm install
```

Run the frontend:

```bash
npm run dev
```

Optional: run the local Express server:

```bash
npm run dev:server
```

## Environment Variables

### Frontend `.env`

The frontend normally points to Supabase Functions:

```env
VITE_SUPABASE_PROJECT_ID=cpfosrovcqsfwwoekrdw
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://cpfosrovcqsfwwoekrdw.supabase.co
VITE_API_URL=https://cpfosrovcqsfwwoekrdw.supabase.co/functions/v1
```

If you want the frontend to talk to the local Express server instead:

```env
VITE_API_URL=http://localhost:3001
```

### Local server `server/.env`

The local server expects the Supabase project and database connection details. Keep service-role and database secrets out of client-side `VITE_*` variables.

### Supabase Function Secrets

The Edge API requires:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
PORTAL_PASSWORD_SETUP_URL=https://your-vercel-domain.vercel.app
```

`PORTAL_PASSWORD_SETUP_URL` is used in password setup / reset emails for portal users.

## Authentication and Roles

Login flow:

1. User enters email or username
2. Frontend resolves usernames through `login-identifier`
3. Supabase Auth signs the user in
4. `/api/me` returns the portal context
5. The app routes the user based on role

Portal context is built from:

- `public.users`
- `public.venues`
- `public.court_portal_accounts`

Current role model:

- `user`: not allowed into the portal
- `admin`: venue portal access
- `internal`: platform-wide operations access

## Internal Operations Features

Internal users can:

- view the operational dashboard
- manage venues and venue admin accounts
- manage plans, commission, and monthly fees
- see bookings and revenue
- view package expiry warnings

The Users page includes:

- managed venue admin accounts
- legacy existing venue owners linked through `venues.owner_id`

The Plans page uses only managed portal accounts.

## Subscription and Plan Tracking

Managed venue admin accounts in `court_portal_accounts` store:

- `plan`
- `monthly_fee_thb`
- `commission_percent`
- `months_paid`
- `created_at`

Expiry is derived from:

```text
created_at + months_paid months
```

The app currently shows in-app expiry warnings to:

- internal users
- venue admins

This is not yet an automated email reminder system.

## Database Migrations

Recent important migrations:

- `20260310100000_add_court_portal_accounts.sql`
- `20260310113000_expand_court_plan_settings.sql`
- `20260310123000_venue_admin_plan_contracts.sql`

Apply migrations:

```bash
export SUPABASE_DB_PASSWORD='YOUR_DB_PASSWORD'
supabase db push
```

## Deploying Supabase

This repo is linked to the Supabase project configured in:

- [supabase/config.toml](supabase/config.toml)

Deploy the public login helper:

```bash
supabase functions deploy login-identifier --no-verify-jwt
```

Deploy the main API:

```bash
supabase functions deploy api
```

Typical order:

```bash
export SUPABASE_DB_PASSWORD='YOUR_DB_PASSWORD'
supabase db push
supabase functions deploy login-identifier --no-verify-jwt
supabase functions deploy api
```

## Deploying Frontend

Production frontend is intended for Vercel.

Required Vercel environment variables:

```env
VITE_SUPABASE_PROJECT_ID=cpfosrovcqsfwwoekrdw
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_URL=https://cpfosrovcqsfwwoekrdw.supabase.co
VITE_API_URL=https://cpfosrovcqsfwwoekrdw.supabase.co/functions/v1
```

After updating env vars or frontend code, redeploy Vercel.

## Scripts

```bash
npm run dev         # Start Vite dev server
npm run dev:server  # Start local Express server
npm run build       # Production build
npm run lint        # ESLint
npm run test        # Currently runs lint
npm run preview     # Preview production build locally
```

## Verification

Basic checks used in this repo:

```bash
npm run lint
npm run build
```

## Notes

- The main runtime path is Supabase Functions, not the local Express server
- Some legacy naming still uses `court_portal_accounts`, even though managed accounts are now venue-level in practice
- If function deploy returns `403 Forbidden resource`, the Supabase CLI account likely does not have access to the linked project
