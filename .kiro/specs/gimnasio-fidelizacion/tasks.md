# Implementation Tasks

## Task 1: Project Scaffolding & Infrastructure

- [ ] Initialize Turborepo monorepo with `apps/web`, `apps/api`, and `packages/shared` workspaces
- [ ] Configure TypeScript with strict mode and shared `tsconfig.base.json`
- [ ] Set up `apps/api` with Fastify, TypeScript, and Vitest
- [ ] Set up `apps/web` with Vite, React 18, TypeScript, Tailwind CSS, and Shadcn/ui
- [ ] Create `docker-compose.yml` with PostgreSQL 16, Redis 7, and MinIO services
- [ ] Configure Prisma in `apps/api/prisma` with initial schema (Tenant, User, UserTenant models)
- [ ] Set up BullMQ connection and base queue configuration in `apps/api/src/lib/queue.ts`
- [ ] Create `.env.example` with all required environment variables documented
- [ ] Configure ESLint + Prettier for the monorepo with shared rules

**Requirements addressed:** 23 (infrastructure for performance/scalability)

## Task 2: Database Schema & Migrations

- [ ] Define complete Prisma schema with all models: Tenant, User, UserTenant, Member, MemberTag, Plan, Membership, Attendance, Payment, Campaign, Segment, CampaignExecution, Message, ConversationWindow, PointRule, PointMovement, Reward, Redemption, NpsSurvey, NpsResponse, AuditLog, ApiToken
- [ ] Add all enums: Role, RiskLevel, MembershipStatus, AttendanceMethod, PaymentMethod, PaymentStatus, CampaignType, CampaignFrequency, CampaignStatus, MessageDirection, MessageStatus, PointEvent, PointMoveType, NpsFrequency
- [ ] Create composite indexes for multi-tenant queries: `(tenantId, phone)`, `(tenantId, memberId, timestamp)`, `(tenantId, name)`, etc.
- [ ] Add unique constraints: `UserTenant(userId, tenantId)`, `Member(tenantId, phone)`, `Campaign(tenantId, name)`, `PointRule(tenantId, event)`
- [ ] Run initial migration and verify schema against design document
- [ ] Create Prisma seed script with sample tenant, users, and test data

**Requirements addressed:** 1, 3, 6, 7, 8, 9, 13, 16, 17, 24

## Task 3: Multi-Tenant Middleware & Prisma Client

- [ ] Create Prisma client wrapper in `apps/api/src/lib/prisma.ts` with tenant-aware middleware
- [ ] Implement middleware that automatically injects `tenantId` filter on all `findMany`, `findFirst`, `findUnique` queries
- [ ] Implement middleware that automatically sets `tenantId` on all `create` operations from session context
- [ ] Add cross-tenant access detection: reject and log any operation targeting a different tenant
- [ ] Create `TenantContext` type and request decorator for Fastify to carry tenant info per request
- [ ] Write integration tests verifying tenant isolation (create in Tenant A, query from Tenant B returns empty)

**Requirements addressed:** 1.1, 1.2, 1.3, 1.4, 1.5

## Task 4: Authentication Service

- [ ] Create `apps/api/src/modules/auth/` module with routes, handlers, and services
- [ ] Implement `POST /api/auth/login`: validate email (RFC 5322) + password (10-128 chars, complexity rules), hash comparison with Argon2id
- [ ] Implement failed login counter with sliding window (5 attempts / 15 min) using Redis, account lockout for 15 min
- [ ] Implement generic error response that does not reveal which field (email or password) is incorrect
- [ ] Implement JWT access token generation (RS256, 15 min expiry) with claims: userId, tenantId, role
- [ ] Implement refresh token generation (7 days, rotation on use) stored hashed in Redis
- [ ] Implement `POST /api/auth/refresh`: validate refresh token, rotate, issue new access token
- [ ] Implement `POST /api/auth/logout`: invalidate refresh token in Redis
- [ ] Implement session inactivity timeout (60 min) via Redis TTL on session key
- [ ] Implement `GET /api/auth/tenants`: return list of tenants accessible by authenticated user
- [ ] Implement `POST /api/auth/select-tenant`: set active tenant in session, clear previous tenant cache

**Requirements addressed:** 2.1, 2.4, 2.5, 2.6, 1.5

## Task 5: Two-Factor Authentication (2FA)

- [ ] Implement TOTP secret generation and storage (encrypted) when owner enables 2FA for tenant
- [ ] Implement `POST /api/auth/verify-2fa`: validate 6-digit TOTP code with 60-second window
- [ ] Implement 2FA enforcement: after successful password validation, require 2FA before issuing JWT
- [ ] Implement 2FA failed attempt counter (5 attempts / 15 min → lockout) with same rules as login
- [ ] Add 2FA setup endpoint for users to scan QR code and confirm activation
- [ ] Write tests for TOTP validation, expiry, and lockout scenarios

**Requirements addressed:** 2.7, 2.8

## Task 6: Role-Based Access Control (RBAC)

- [ ] Define permissions matrix as constant in `packages/shared/src/constants/permissions.ts` mapping Role → Module → Actions (read/write/none)
- [ ] Create `@Roles()` decorator/plugin for Fastify routes that checks user role against required permissions
- [ ] Implement RBAC middleware in `apps/api/src/middleware/rbac.ts` that denies access and returns 403 with "permiso insuficiente" message
- [ ] Log denied access attempts to audit log (userId, tenantId, attempted action, timestamp)
- [ ] Write tests: Receptionist cannot access campaigns, reports, or config; Admin cannot access billing; Owner has full access

**Requirements addressed:** 2.2, 2.3

## Task 7: Audit Log Module

- [ ] Create `apps/api/src/modules/audit/` module with service and routes
- [ ] Implement audit log middleware in `apps/api/src/middleware/audit.ts` that automatically logs: auth events, member CRUD, campaign sends, redemptions, financial report access
- [ ] Each log entry includes: userId, tenantId, action, entityType, entityId, details (JSON), ipAddress, timestamp (UTC, second precision)
- [ ] Implement `GET /api/audit-logs` (Owner only): paginated (100/page), filterable by date range, userId, action type, response < 5s
- [ ] Enforce immutability: no UPDATE/DELETE on audit_logs table (DB-level REVOKE)
- [ ] Implement retry logic: 3 retries with 2s interval on write failure, alert to Owner via Bandeja_Alertas if all fail
- [ ] Deny Admins and Receptionists from querying audit logs (403 + log the attempt)

**Requirements addressed:** 24.1, 24.2, 24.3, 24.4, 24.5, 24.6

