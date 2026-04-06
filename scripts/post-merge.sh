#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push-force

# Seed demo user (idempotent — ON CONFLICT DO NOTHING)
# Password: demo1234 (bcrypt hash)
psql "$DATABASE_URL" -c "
INSERT INTO auth_users (id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@fincacolombia.com',
  '\$2b\$10\$I2wmuK1bwbG1JjRWWDlUTO/g9F7Pbg3iAMFfwJ1QlfUxyzvA59vDC'
) ON CONFLICT (id) DO NOTHING;
" || true
