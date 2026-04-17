# Finca — Farm Management Web App

## Overview

Finca is a farm management web app for small and mid-size farm owners in Colombia. It lets them track animals, manage inventory, and view a dashboard — all from one clean, modern interface. Spanish-first UI with English toggle.

Built as a pnpm workspace monorepo with a React + Vite frontend and an Express API backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React + Vite + TypeScript (artifacts/finca-web)
- **Styling**: Tailwind CSS with Finca earthy custom theme
- **Fonts**: Fraunces (serif headings), DM Sans (body)
- **State**: Zustand (auth + farm context), TanStack React Query
- **Routing**: Wouter (frontend), Express (API)
- **i18n**: react-i18next — Spanish default, English toggle
- **Charts**: Recharts
- **Forms**: react-hook-form + zod
- **Animations**: framer-motion
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod
- **Auth**: JWT (bcryptjs) stored in localStorage
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| earth | #2C1810 | Primary dark — headers, nav, buttons |
| sage | #4A6741 | Primary accent — success, animal module |
| sage-light | #6B8F61 | Hover states, secondary green |
| sand | #F5F0E8 | Card backgrounds |
| cream | #FDFAF5 | Page background |
| clay | #C4956A | Warm accent — land module, highlights |
| clay-light | #E8D5BF | Tags, badges, soft accents |
| ink | #1A1A1A | Primary text |
| muted | #6B6560 | Secondary text |
| border | #E0D8CE | Borders, dividers |

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (auth, farms, animals, inventory, etc.)
│   └── finca-web/          # React + Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── ...
```

## Database Schema

Tables: `profiles`, `farms`, `farm_members`, `zones`, `animals`, `weight_records`, `medical_records`, `inventory_items`, `inventory_logs`, `activity_log`, `conversations`, `messages`, `finance_transactions`, `contacts`, `employees`, `employee_attachments`, `animal_lifecycle_events`

### Activity Log
The `activity_log` table is the canonical audit/activity feed table (the feature is sometimes called "farm_activity" in task descriptions but the table keeps its original name for backward compatibility). It records CRUD actions on farm resources with: `farmId`, `userId`, `actionType`, `entityType`, `entityId`, `description`, `metadata` (jsonb, nullable), `createdAt`.

DB migrations are incremental SQL files in `artifacts/api-server/migrations/` (see `0002_*`, `0003_*`, `0004_*`). The `metadata` column was added in migration `0004_activity_log_metadata.sql`.

Activity is logged server-side in route handlers for animals, inventory, finances, contacts, and employees. The feed is surfaced via `GET /api/farms/:id/activity?limit=N&offset=N` and displayed in:
- Dashboard: recent 5 entries
- `/activity` page: full paginated view with load-more

### Animal Lifecycle System
Female livestock (cattle, goat, sheep, horse, pig) have a 5-stage reproductive lifecycle:
`growing → can_breed → in_heat → pregnant → nursing → can_breed`

Key lifecycle columns on `animals` table: `lifecycle_stage`, `lifecycle_stage_started_at`, `lifecycle_stage_ends_at`, `heat_started_at`, `heat_ends_at`, `pregnancy_started_at`, `expected_delivery_at`, `pregnancy_check_due_at`, `pregnancy_check_completed_at`, `nursing_started_at`, `nursing_ends_at`, `weaning_due_at`, `current_weight_kg`

`animal_lifecycle_events` logs all stage transitions with `from_stage`, `to_stage`, `event_type`, `event_at`.

Frontend helpers: `artifacts/finca-web/src/lib/lifecycle.ts` (config, derived stage logic, alerts, display formatters).
Components: `LifecycleSummaryChips`, `LifecycleBar`, `LifecycleActionCard` in `src/components/lifecycle/`.

Auth: Custom `auth_users` table created on first registration (id, email, password_hash).

## Pages

- `/` → `/login` (auth redirect)
- `/login` — Email/password login
- `/register` — Sign up + create first farm
- `/dashboard` — Stats, charts, activity feed, upcoming tasks
- `/animals` — Animal list with filters + search
- `/animals/:id` — Animal detail (tabs: overview, weight history, medical, lineage)
- `/inventory` — Inventory by category
- `/finances` — Income/expense tracking with monthly charts and transaction table
- `/contacts` — Contact directory (suppliers, buyers, vets, transport, other)
- `/employees` — Employee management with CRUD, salary in COP, bank account, payroll summary cards; expandable rows with inline notes editing and file attachment upload (drag-drop, GCS-backed, image lightbox)
- `/land` — Interactive satellite map (Esri World Imagery) with polygon zone drawing, color-coded zones, labels, notes
- `/settings` — Farm, team, account settings

## API Routes

All under `/api`:
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/profile`
- `GET/POST /api/farms`, `GET/PUT /api/farms/:id`
- `GET/POST /api/farms/:id/members`, `DELETE /api/farms/:id/members/:userId`
- `GET /api/farms/:id/stats`
- `GET/POST /api/farms/:id/animals`, `GET/PUT /api/farms/:id/animals/:animalId`
- `GET/POST /api/farms/:id/animals/:animalId/weights`
- `GET/POST /api/farms/:id/animals/:animalId/medical`
- `GET/POST /api/farms/:id/inventory`, `GET/PUT /api/farms/:id/inventory/:itemId`
- `POST /api/farms/:id/inventory/:itemId/log`
- `GET /api/farms/:id/activity`
- `GET/POST /api/farms/:id/zones`, `PATCH/DELETE /api/farms/:id/zones/:zoneId`
- `PATCH /api/farms/:id/location` — save farm map center (lat/lng/zoom)
- `GET/POST /api/farms/:id/employees`, `PUT/DELETE /api/farms/:id/employees/:empId`
- `PATCH /api/farms/:id/pay-day`
- `GET/POST /api/farms/:id/employees/:empId/attachments` — list (confirmed only) / create attachment row + presigned URL
- `PATCH /api/farms/:id/employees/:empId/attachments/:attachmentId/confirm` — mark upload complete
- `DELETE /api/farms/:id/employees/:empId/attachments/:attachmentId` — delete attachment (DB + GCS)
- `GET /api/farms/:id/employees/:empId/attachments/:attId/file` — serve attachment (farm-scoped auth, forced download headers)
- `GET /api/search?farmId=&q=`
- `GET/POST /api/farms/:id/finances` — list / create finance transactions
- `PUT/DELETE /api/farms/:id/finances/:txId` — update / delete a transaction
- `GET/POST /api/farms/:id/contacts` — list / create contacts
- `PUT/DELETE /api/farms/:id/contacts/:contactId` — update / delete a contact
- `POST /api/chat/conversations` — create a new AI conversation
- `POST /api/chat/conversations/:id/messages` — send message, stream SSE AI response
- `GET /api/chat/conversations/:id/messages` — get conversation history
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/mark-in-heat` — start heat cycle
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/end-heat` — end heat cycle
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/mark-pregnant` — mark pregnant
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/record-check` — record pregnancy check
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/mark-delivered` — record delivery, start nursing
- `PATCH /api/farms/:id/animals/:animalId/lifecycle/wean` — wean calf, return to can_breed
- `GET /api/farms/:id/animals/:animalId/lifecycle-history` — lifecycle event audit log

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/finca-web run dev

# Push DB schema
pnpm --filter @workspace/db run push

# Run codegen (after OpenAPI spec changes)
pnpm --filter @workspace/api-spec run codegen
```

## Future: React Native Mobile App

All business logic lives in the API server. The mobile app can connect to the same backend by hitting the same API endpoints with Bearer token auth. The `lib/api-client-react` generated hooks can be adapted for React Native with minimal changes.
