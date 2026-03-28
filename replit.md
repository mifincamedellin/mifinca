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

Tables: `profiles`, `farms`, `farm_members`, `zones`, `animals`, `weight_records`, `medical_records`, `inventory_items`, `inventory_logs`, `activity_log`, `conversations`, `messages`, `finance_transactions`, `contacts`

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
- `/land` — Coming soon stub
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
- `GET/POST /api/farms/:id/zones`
- `GET /api/search?farmId=&q=`
- `GET/POST /api/farms/:id/finances` — list / create finance transactions
- `PUT/DELETE /api/farms/:id/finances/:txId` — update / delete a transaction
- `GET/POST /api/farms/:id/contacts` — list / create contacts
- `PUT/DELETE /api/farms/:id/contacts/:contactId` — update / delete a contact
- `POST /api/chat/conversations` — create a new AI conversation
- `POST /api/chat/conversations/:id/messages` — send message, stream SSE AI response
- `GET /api/chat/conversations/:id/messages` — get conversation history

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
