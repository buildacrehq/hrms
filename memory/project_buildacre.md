---
name: project-buildacre-workforce
description: Buildacre Workforce – attendance & employee tracking app. Tech stack, architecture decisions, and build progress.
metadata:
  type: project
---

Buildacre Workforce is a multi-site construction workforce attendance system being built from scratch.

**Why:** Buildacre employees work across multiple construction/interior sites; need GPS+photo punch in/out, leave management, and admin approval workflow.

**Architecture (locked):**
- Monorepo: pnpm workspaces + Turborepo, in `/Users/yogesh/Yogs/Aura/hrms/`
- `apps/api` – NestJS + Prisma + PostgreSQL (shared backend)
- `apps/admin` – Next.js 14 + Tailwind + shadcn/ui (web admin dashboard)
- `apps/mobile` – Flutter (employee iOS/Android app)
- `packages/types` – shared TypeScript types between API and admin

**Key decisions:**
- Docker Compose for local PostgreSQL dev
- OTP: stub (console.log) in dev; pluggable provider interface for MSG91/Fast2SMS in prod
- Photo storage: Cloudflare R2 (S3-compatible), private bucket, signed URLs
- GPS: captured as audit trail only, no geofence enforcement
- Photo verification: proof-of-presence only (Option A), no face recognition
- Admin approval: manual with bulk "Approve All Normal" (Option 1)
- Single company-wide shift, all settings Admin-editable from DB Setting table
- Admin: sole approver for all punches and leave (Site Managers: visibility only)

**Build progress (follow Buildacre_Workforce_BUILD_GUIDE.md Phase order):**
- Phase 1 Step 1: Monorepo scaffold + NestJS + Prisma schema — IN PROGRESS

**How to apply:** When continuing this project, resume from the current phase/step. All implementation decisions are documented in `Buildacre_Workforce_BUILD_GUIDE.md` and `Buildacre_Workforce_App_Spec.md` in the workspace.
