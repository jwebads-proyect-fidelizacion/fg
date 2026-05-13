# Technical Design Document

## Overview

Este documento describe el diseño técnico de la plataforma SaaS de fidelización para gimnasios. La arquitectura sigue un enfoque modular basado en microservicios ligeros (servicios internos dentro de un monolito modular desplegable como unidad o como servicios independientes según la escala), con separación clara entre frontend, backend API, motor de campañas, motor de riesgo y gestor de WhatsApp.

## Tech Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Frontend | React 18 + TypeScript + Vite | SPA responsive, ecosistema maduro, tipado estático |
| UI Components | Shadcn/ui + Tailwind CSS | Accesibilidad WCAG 2.1 AA, responsive, personalizable |
| State Management | TanStack Query + Zustand | Cache de servidor + estado local ligero |
| Backend API | Node.js 20 + TypeScript + Fastify | Alto rendimiento, tipado compartido con frontend, JSON nativo |
| ORM | Prisma | Type-safe, migraciones, soporte multi-tenant |
| Base de Datos | PostgreSQL 16 | ACID, JSON, full-text search, row-level security |
| Cache | Redis 7 | Sesiones, rate limiting, colas, cache de métricas |
| Cola de Mensajes | BullMQ (sobre Redis) | Programación de campañas, reintentos, prioridades |
| Autenticación | JWT (access) + Refresh tokens + TOTP (2FA) | Stateless, rotación segura |
| WhatsApp | Meta Cloud API (oficial) | Cumplimiento de políticas, confiabilidad |
| Almacenamiento | S3-compatible (MinIO/AWS S3) | Archivos de importación, exports, backups |
| Monitoreo | Prometheus + Grafana | Métricas de rendimiento, alertas de SLA |
| CI/CD | GitHub Actions + Docker | Despliegue reproducible, testing automatizado |
| Hosting | Docker Compose (dev) / Kubernetes (prod) | Escalabilidad horizontal |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (Browser)                            │
│  React SPA + TanStack Query + Zustand + Shadcn/ui + Tailwind        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (TLS 1.2+)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / REVERSE PROXY                      │
│                    (Nginx / Traefik + Rate Limiting)                  │
└───────┬──────────────┬──────────────┬───────────────┬───────────────┘
        │              │              │               │
        ▼              ▼              ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Auth Service│ │  Core API    │ │  Campaign    │ │  WhatsApp        │
│              │ │  (CRUD,      │ │  Engine      │ │  Manager         │
│  - Login     │ │   Socios,    │ │  (Motor      │ │  (Gestor         │
│  - JWT/2FA   │ │   Planes,    │ │   Campañas)  │ │   WhatsApp)      │
│  - RBAC      │ │   Membresías,│ │              │ │                  │
│  - Sessions  │ │   Pagos,     │ │  - Scheduler │ │  - Send/Receive  │
│              │ │   Asistencia)│ │  - Segments  │ │  - Templates     │
│              │ │              │ │  - NPS       │ │  - Status Track  │
│              │ │  - Import    │ │  - Referidos │ │  - Inbox         │
│              │ │  - Export    │ │  - Puntos    │ │  - Opt-out       │
│              │ │  - API Ext.  │ │              │ │                  │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘
       │                │                │                   │
       └────────────────┴────────┬───────┴───────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌───────▼───────┐
              │ PostgreSQL │           │    Redis      │
              │            │           │               │
              │ - Tenants  │           │ - Sessions    │
              │ - Users    │           │ - Rate Limit  │
              │ - Socios   │           │ - BullMQ Jobs │
              │ - Campaigns│           │ - Cache       │
              │ - Audit Log│           │               │
              └────────────┘           └───────────────┘
                    │
              ┌─────▼─────┐
              │ Risk Engine│
              │ (Motor     │
              │  Riesgo)   │
              │            │
              │ - Daily Job│
              │ - Scoring  │
              └────────────┘
```

## Data Models

### Tenant & Users

```prisma
model Tenant {
  id            String   @id @default(uuid())
  name          String
  timezone      String   @default("America/Mexico_City")
  whatsappPhoneId String?
  whatsappToken   String?  // encrypted at rest
  attendanceWindowMinutes Int @default(30)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  users         UserTenant[]
  members       Member[]
  plans         Plan[]
  campaigns     Campaign[]
  segments      Segment[]
  rewards       Reward[]
  pointRules    PointRule[]
  auditLogs     AuditLog[]
  apiTokens     ApiToken[]
}

model User {
  id            String   @id @default(uuid())
  email         String   @unique
  passwordHash  String
  twoFactorSecret String?  // encrypted
  failedAttempts Int     @default(0)
  lockedUntil   DateTime?
  createdAt     DateTime @default(now())

  tenants       UserTenant[]
}

model UserTenant {
  id       String @id @default(uuid())
  userId   String
  tenantId String
  role     Role   // OWNER, ADMIN, RECEPTIONIST

  user     User   @relation(fields: [userId], references: [id])
  tenant   Tenant @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId])
}

enum Role {
  OWNER
  ADMIN
  RECEPTIONIST
}
```

### Members (Socios)

```prisma
model Member {
  id              String   @id @default(uuid())
  tenantId        String
  firstName       String   // 1-100 chars
  lastName        String   // 1-100 chars
  phone           String   // E.164 format
  email           String   // RFC 5322
  dateOfBirth     DateTime
  documentId      String?
  isActive        Boolean  @default(true)
  optOut          Boolean  @default(false)
  optOutDate      DateTime?
  optOutSource    String?
  marketingConsent Boolean @default(false)
  marketingConsentDate DateTime?
  marketingConsentChannel String?
  referralCode    String   // 6-12 alphanumeric, unique per tenant
  referredById    String?
  isReferred      Boolean  @default(false)
  riskScore       Int?     // 0-100
  riskLevel       RiskLevel? // LOW, MEDIUM, HIGH
  riskScoreDate   DateTime?
  riskInsufficient Boolean @default(false)
  pointsBalance   Int      @default(0)
  qrCode          String   @unique
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deactivatedAt   DateTime?

  tenant          Tenant   @relation(fields: [tenantId], references: [id])
  referredBy      Member?  @relation("Referrals", fields: [referredById], references: [id])
  referrals       Member[] @relation("Referrals")
  memberships     Membership[]
  attendances     Attendance[]
  pointMovements  PointMovement[]
  messages        Message[]
  npsResponses    NpsResponse[]
  tags            MemberTag[]

  @@unique([tenantId, phone])
  @@index([tenantId, lastName, firstName])
  @@index([tenantId, isActive])
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}
```

### Plans & Memberships

```prisma
model Plan {
  id          String   @id @default(uuid())
  tenantId    String
  name        String   // 1-80 chars
  description String?  // 0-500 chars
  durationDays Int     // 1-3650
  price       Decimal  // 0.00 - 9,999,999.99
  currency    String   // ISO 4217
  isArchived  Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  memberships Membership[]
}

model Membership {
  id          String          @id @default(uuid())
  tenantId    String
  memberId    String
  planId      String
  startDate   DateTime
  endDate     DateTime        // calculated: startDate + plan.durationDays - 1
  status      MembershipStatus @default(ACTIVE)
  cancelledAt DateTime?
  cancelReason String?
  createdAt   DateTime        @default(now())

  member      Member   @relation(fields: [memberId], references: [id])
  plan        Plan     @relation(fields: [planId], references: [id])
  payments    Payment[]

  @@index([tenantId, memberId, status])
  @@index([tenantId, endDate])
}

enum MembershipStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}
```

### Attendance & Payments

```prisma
model Attendance {
  id          String   @id @default(uuid())
  tenantId    String
  memberId    String
  timestamp   DateTime // timezone-aware, second precision
  method      AttendanceMethod // MANUAL, QR
  createdAt   DateTime @default(now())

  member      Member   @relation(fields: [memberId], references: [id])

  @@index([tenantId, memberId, timestamp])
}

enum AttendanceMethod {
  MANUAL
  QR
}

model Payment {
  id            String        @id @default(uuid())
  tenantId      String
  membershipId  String
  amount        Decimal       // 0.01 - 9,999,999.99
  currency      String        // must match plan currency
  paymentDate   DateTime
  method        PaymentMethod
  status        PaymentStatus // PAID, PENDING
  isVoided      Boolean       @default(false)
  voidedAt      DateTime?
  voidedBy      String?
  voidReason    String?       // 5-500 chars when voided
  createdAt     DateTime      @default(now())

  membership    Membership @relation(fields: [membershipId], references: [id])

  @@index([tenantId, membershipId])
  @@index([tenantId, paymentDate])
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  DEBIT_CARD
  CREDIT_CARD
  OTHER
}

enum PaymentStatus {
  PAID
  PENDING
}
```


### Campaigns & Segments

```prisma
model Segment {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  criteria    Json     // { daysInactive?, membershipStatus?, ageRange?, plans?, seniority?, tags?, riskLevel? }
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  campaigns   Campaign[]
}

model Campaign {
  id                String         @id @default(uuid())
  tenantId          String
  name              String         // 3-80 chars, unique per tenant
  objective         String         // 1-500 chars
  type              CampaignType   // REMINDER, BIRTHDAY, RENEWAL, PROMO, REFERRAL, NPS, CUSTOM
  segmentId         String
  templateName      String         // WhatsApp template name
  templateLanguage  String         @default("es")
  frequency         CampaignFrequency // ONCE, DAILY, WEEKLY, MONTHLY
  startAt           DateTime
  endAt             DateTime?
  status            CampaignStatus @default(DRAFT)
  attributionDays   Int            @default(7) // 1-90
  config            Json?          // type-specific config (e.g., inactivity days, renewal offsets)
  createdAt         DateTime       @default(now())
  updatedAt         DateTime       @updatedAt

  tenant            Tenant   @relation(fields: [tenantId], references: [id])
  segment           Segment  @relation(fields: [segmentId], references: [id])
  executions        CampaignExecution[]

  @@unique([tenantId, name])
}

enum CampaignType {
  REMINDER
  BIRTHDAY
  RENEWAL
  PROMO
  REFERRAL
  NPS
  CUSTOM
}

enum CampaignFrequency {
  ONCE
  DAILY
  WEEKLY
  MONTHLY
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  PAUSED
  CANCELLED
  FINISHED
}

model CampaignExecution {
  id          String   @id @default(uuid())
  campaignId  String
  startedAt   DateTime
  finishedAt  DateTime?
  totalTarget Int      @default(0)
  sent        Int      @default(0)
  delivered   Int      @default(0)
  read        Int      @default(0)
  failed      Int      @default(0)
  responded   Int      @default(0)
  conversions Int      @default(0)

  campaign    Campaign @relation(fields: [campaignId], references: [id])
  messages    Message[]
}
```

### Messages & WhatsApp

```prisma
model Message {
  id              String        @id @default(uuid())
  tenantId        String
  memberId        String
  executionId     String?       // null for manual/inbox messages
  direction       MessageDirection // OUTBOUND, INBOUND
  templateName    String?
  body            String?       // free-text for session messages
  whatsappMsgId   String?       // Meta message ID
  status          MessageStatus @default(PENDING)
  statusUpdatedAt DateTime?
  sentAt          DateTime?
  deliveredAt     DateTime?
  readAt          DateTime?
  failedAt        DateTime?
  failReason      String?
  retryCount      Int           @default(0)
  createdAt       DateTime      @default(now())

  member          Member    @relation(fields: [memberId], references: [id])
  execution       CampaignExecution? @relation(fields: [executionId], references: [id])

  @@index([tenantId, memberId, createdAt])
  @@index([tenantId, status])
}

enum MessageDirection {
  OUTBOUND
  INBOUND
}

enum MessageStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

model ConversationWindow {
  id        String   @id @default(uuid())
  tenantId  String
  memberId  String
  openedAt  DateTime
  expiresAt DateTime // openedAt + 24h

  @@unique([tenantId, memberId])
  @@index([expiresAt])
}
```

### Points & Rewards

```prisma
model PointRule {
  id        String    @id @default(uuid())
  tenantId  String
  event     PointEvent // ATTENDANCE, PAYMENT, REFERRAL, NPS_RESPONSE
  points    Int       // 1-10000
  isEnabled Boolean   @default(true)

  tenant    Tenant    @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, event])
}

enum PointEvent {
  ATTENDANCE
  PAYMENT
  REFERRAL
  NPS_RESPONSE
}

model Reward {
  id          String   @id @default(uuid())
  tenantId    String
  name        String   // 3-100 chars
  pointsCost  Int      // 1-1,000,000
  stock       Int?     // null = unlimited
  startDate   DateTime
  endDate     DateTime
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  redemptions Redemption[]
}

model Redemption {
  id          String   @id @default(uuid())
  tenantId    String
  memberId    String
  rewardId    String
  pointsSpent Int
  code        String   // min 8 alphanumeric chars
  redeemedAt  DateTime @default(now())

  reward      Reward   @relation(fields: [rewardId], references: [id])

  @@index([tenantId, memberId])
}

model PointMovement {
  id          String        @id @default(uuid())
  tenantId    String
  memberId    String
  type        PointMoveType // EARN, REDEEM, REVERSAL
  points      Int           // positive for earn, negative for redeem/reversal
  balance     Int           // resulting balance
  event       String?       // source event description
  referenceId String?       // payment/redemption/attendance ID
  createdAt   DateTime      @default(now())

  member      Member @relation(fields: [memberId], references: [id])

  @@index([tenantId, memberId, createdAt])
}

enum PointMoveType {
  EARN
  REDEEM
  REVERSAL
}
```

### NPS Surveys

```prisma
model NpsSurvey {
  id              String       @id @default(uuid())
  tenantId        String
  mainQuestion    String
  followUpQuestions Json?      // array of up to 3 strings
  frequency       NpsFrequency // MONTHLY, QUARTERLY, BIANNUAL
  isActive        Boolean      @default(true)
  lastSentAt      DateTime?
  createdAt       DateTime     @default(now())

  responses       NpsResponse[]
}

enum NpsFrequency {
  MONTHLY
  QUARTERLY
  BIANNUAL
}

model NpsResponse {
  id          String   @id @default(uuid())
  tenantId    String
  surveyId    String
  memberId    String
  token       String   @unique // unique link token
  score       Int?     // 0-10
  answers     Json?    // follow-up answers
  respondedAt DateTime?
  expiresAt   DateTime // sentAt + 14 days
  sentAt      DateTime
  isUsed      Boolean  @default(false)

  survey      NpsSurvey @relation(fields: [surveyId], references: [id])
  member      Member    @relation(fields: [memberId], references: [id])

  @@index([tenantId, surveyId])
  @@index([token])
}
```

### Audit Log

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  tenantId    String
  userId      String
  action      String   // LOGIN, LOGIN_FAILED, MEMBER_CREATE, MEMBER_UPDATE, etc.
  entityType  String?  // Member, Campaign, Payment, etc.
  entityId    String?
  details     Json?    // old/new values, extra context
  ipAddress   String
  timestamp   DateTime @default(now()) // UTC, second precision

  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@index([tenantId, timestamp])
  @@index([tenantId, userId, timestamp])
  @@index([tenantId, action])
}
```

### API Tokens

```prisma
model ApiToken {
  id          String   @id @default(uuid())
  tenantId    String
  tokenHash   String   @unique // hashed token
  name        String
  isRevoked   Boolean  @default(false)
  revokedAt   DateTime?
  createdAt   DateTime @default(now())
  lastUsedAt  DateTime?

  tenant      Tenant   @relation(fields: [tenantId], references: [id])
}
```

## API Design

### Authentication Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/auth/login` | Login con email/password | Public |
| POST | `/api/auth/verify-2fa` | Verificar código TOTP | Public (post-login) |
| POST | `/api/auth/refresh` | Renovar access token | Authenticated |
| POST | `/api/auth/logout` | Cerrar sesión | Authenticated |
| GET | `/api/auth/tenants` | Listar tenants del usuario | Authenticated |
| POST | `/api/auth/select-tenant` | Seleccionar tenant activo | Authenticated |

### Members (Socios) Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/members` | Listar/buscar socios | All |
| POST | `/api/members` | Crear socio | Owner, Admin |
| GET | `/api/members/:id` | Detalle de socio | All |
| PUT | `/api/members/:id` | Editar socio | Owner, Admin |
| DELETE | `/api/members/:id` | Dar de baja (soft delete) | Owner, Admin |
| POST | `/api/members/import` | Importar CSV/XLSX | Owner, Admin |
| GET | `/api/members/import/:jobId` | Estado de importación | Owner, Admin |
| POST | `/api/members/import/:jobId/confirm` | Confirmar importación | Owner, Admin |
| GET | `/api/members/:id/points` | Historial de puntos | Owner, Admin |
| GET | `/api/members/:id/attendances` | Historial de asistencias | All |
| GET | `/api/members/:id/data-export` | Export PII (GDPR) | Owner, Admin |

### Attendance Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/attendances` | Registrar asistencia manual | All |
| POST | `/api/attendances/qr` | Registrar por QR | All |

### Plans & Memberships Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/plans` | Listar planes | Owner, Admin |
| POST | `/api/plans` | Crear plan | Owner, Admin |
| PUT | `/api/plans/:id` | Editar plan | Owner, Admin |
| PATCH | `/api/plans/:id/archive` | Archivar plan | Owner, Admin |
| POST | `/api/memberships` | Asignar membresía | Owner, Admin |
| GET | `/api/members/:id/memberships` | Historial membresías | All |

### Payments Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/api/payments` | Registrar pago | All |
| PATCH | `/api/payments/:id/void` | Anular pago | Owner, Admin |
| GET | `/api/payments/export` | Exportar CSV | Owner, Admin |

### Campaigns Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/campaigns` | Listar campañas | Owner, Admin |
| POST | `/api/campaigns` | Crear campaña | Owner, Admin |
| PUT | `/api/campaigns/:id` | Editar campaña | Owner, Admin |
| PATCH | `/api/campaigns/:id/status` | Cambiar estado (pause/resume/cancel) | Owner, Admin |
| GET | `/api/campaigns/:id/stats` | Métricas de campaña | Owner, Admin |
| GET | `/api/campaigns/effectiveness` | Reporte comparativo | Owner, Admin |

### Segments Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/segments` | Listar segmentos | Owner, Admin |
| POST | `/api/segments` | Crear segmento | Owner, Admin |
| PUT | `/api/segments/:id` | Editar segmento | Owner, Admin |
| GET | `/api/segments/:id/preview` | Previsualizar (count + sample) | Owner, Admin |

### Points & Rewards Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/points/rules` | Listar reglas de puntos | Owner, Admin |
| PUT | `/api/points/rules` | Configurar reglas | Owner, Admin |
| GET | `/api/rewards` | Listar recompensas | Owner, Admin |
| POST | `/api/rewards` | Crear recompensa | Owner, Admin |
| PUT | `/api/rewards/:id` | Editar recompensa | Owner, Admin |
| POST | `/api/rewards/:id/redeem` | Canjear recompensa | Owner, Admin |

### NPS Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/nps/surveys` | Listar encuestas | Owner, Admin |
| POST | `/api/nps/surveys` | Crear/configurar encuesta | Owner, Admin |
| GET | `/api/nps/respond/:token` | Formulario de respuesta (público) | Public |
| POST | `/api/nps/respond/:token` | Enviar respuesta | Public |
| GET | `/api/nps/results` | Resultados y evolución NPS | Owner, Admin |

### WhatsApp & Inbox Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/inbox` | Bandeja de entrada | All |
| GET | `/api/inbox/:memberId` | Conversación con socio | All |
| POST | `/api/inbox/:memberId/send` | Enviar mensaje libre | All |
| POST | `/api/webhooks/whatsapp` | Webhook de Meta (status + inbound) | System |

### Dashboard & Reports Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/dashboard` | Métricas principales | Owner, Admin |
| GET | `/api/dashboard/export` | Exportar CSV/PDF | Owner, Admin |
| GET | `/api/referrals/ranking` | Ranking de referidos | Owner, Admin |

### External API (para integraciones)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/members` | Consultar socios | API Token |
| POST | `/api/v1/members` | Crear socio | API Token |
| PUT | `/api/v1/members/:id` | Actualizar socio | API Token |
| POST | `/api/v1/attendances` | Registrar asistencia | API Token |
| POST | `/api/v1/payments` | Registrar pago | API Token |
| POST | `/api/v1/webhooks/inbound` | Webhook entrante (HMAC) | HMAC Signature |

### Audit Log Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | `/api/audit-logs` | Consultar logs | Owner |


## Components and Interfaces

### 1. Auth Service

Responsable de autenticación, autorización y gestión de sesiones.

**Flujo de Login:**
1. Usuario envía email + password → validar formato, buscar usuario
2. Comparar hash (argon2) → si falla, incrementar contador, verificar bloqueo
3. Si 2FA habilitado en tenant → solicitar código TOTP
4. Generar JWT access token (15 min) + refresh token (7 días, rotación)
5. Retornar lista de tenants accesibles → usuario selecciona tenant activo
6. Establecer `tenantId` en claims del JWT

**Middleware de Autorización:**
```typescript
// Ejecutado en cada request
interface AuthContext {
  userId: string;
  tenantId: string;
  role: Role;
}

// Row-Level Security: todas las queries incluyen WHERE tenantId = ctx.tenantId
// Permisos: decorador @Roles(Role.OWNER, Role.ADMIN) en cada endpoint
```

### 2. Core API Service

Módulo principal que maneja CRUD de entidades de negocio.

**Multi-Tenancy Implementation:**
- Cada tabla incluye `tenantId` como columna obligatoria
- Prisma middleware inyecta automáticamente `tenantId` en todas las queries
- Índices compuestos `(tenantId, ...)` para rendimiento

**Importación Masiva:**
1. Upload del archivo → validar formato, tamaño, columnas
2. Job asíncrono (BullMQ) → parsear filas, validar cada una
3. Generar reporte en memoria → almacenar temporalmente en Redis (TTL 30 min)
4. Usuario confirma → persistir filas válidas en batch (transacción)
5. Si no confirma en 30 min → TTL expira, datos descartados

**Búsqueda de Socios:**
- PostgreSQL full-text search con `tsvector` sobre nombre, apellido, teléfono, documento
- Índice GIN para búsqueda parcial (trigram)
- Límite de resultados: 50 por página

### 3. Campaign Engine (MotorCampañas)

Servicio de procesamiento de campañas basado en BullMQ.

**Arquitectura de Colas:**
```
campaign-scheduler (cron cada 1 min)
  → Evalúa campañas activas cuyo próximo envío es <= now
  → Para cada campaña: evalúa segmento, genera lista de destinatarios
  → Encola mensajes individuales en campaign-send queue

campaign-send (workers concurrentes)
  → Toma mensaje de la cola
  → Verifica: socio activo, consent, no opt-out, no en periodo de gracia
  → Envía via GestorWhatsApp
  → Actualiza contadores de ejecución (Redis atomic increment)
  → Registra en Message table
```

**Campañas Preconfiguradas:**
- **Recordatorio**: Cron diario evalúa `lastAttendance > N days`, respeta periodo de gracia
- **Cumpleaños**: Cron diario a las 00:01 timezone del gym, programa envío en ventana horaria
- **Renovación**: Cron diario evalúa membresías con vencimiento en offsets configurados (-7, -1, 0, +3)
- **NPS**: Cron según frecuencia (mensual/trimestral/semestral)

**Rate Limiting:**
- Respeta límites de Meta Cloud API (actualmente ~80 msg/seg por número)
- BullMQ rate limiter configurado por tenant
- Backoff exponencial en errores 429

### 4. WhatsApp Manager (GestorWhatsApp)

Integración con Meta Cloud API.

**Envío de Mensajes:**
```typescript
async function sendTemplate(tenantId: string, phone: string, templateName: string, params: object) {
  // 1. Verificar credenciales del tenant
  // 2. Verificar si hay ventana de conversación activa
  // 3. Si no hay ventana → usar template aprobado
  // 4. POST a https://graph.facebook.com/v18.0/{phoneId}/messages
  // 5. Registrar Message con status PENDING
  // 6. Retornar whatsappMsgId
}
```

**Webhook de Meta (recepción):**
```typescript
// POST /api/webhooks/whatsapp
// 1. Verificar firma del webhook (app secret)
// 2. Procesar status updates → actualizar Message.status
// 3. Procesar mensajes entrantes:
//    a. Buscar socio por teléfono
//    b. Crear/extender ConversationWindow (24h)
//    c. Persistir Message (INBOUND)
//    d. Verificar opt-out keywords → marcar socio si aplica
//    e. Emitir evento para bandeja de entrada (WebSocket/SSE)
```

**Bandeja de Entrada:**
- WebSocket para notificaciones en tiempo real
- Mensajes agrupados por socio (conversación)
- Indicador de ventana activa (puede enviar texto libre) vs expirada (solo templates)

### 5. Risk Engine (MotorRiesgo)

Job diario que calcula el PuntajeRiesgo.

**Algoritmo de Scoring:**
```typescript
function calculateRiskScore(member: MemberWithHistory): number {
  const weights = {
    daysSinceLastAttendance: 0.35,  // más días = más riesgo
    frequencyDrop: 0.25,            // caída vs promedio histórico
    daysToExpiry: 0.25,             // menos días = más riesgo
    pendingPayments: 0.15           // más pagos pendientes = más riesgo
  };

  // Normalizar cada factor a 0-100
  const daysFactor = normalize(daysSinceLastAttendance, 0, 90); // 90+ days = max risk
  const freqFactor = normalize(frequencyDrop, 0, 1);            // 100% drop = max risk
  const expiryFactor = normalize(90 - daysToExpiry, 0, 90);     // 0 days left = max risk
  const paymentFactor = normalize(pendingPayments, 0, 3);       // 3+ pending = max risk

  return Math.round(
    daysFactor * weights.daysSinceLastAttendance +
    freqFactor * weights.frequencyDrop +
    expiryFactor * weights.daysToExpiry +
    paymentFactor * weights.pendingPayments
  );
}
```

**Ejecución:**
- BullMQ repeatable job: cada 24h a las 02:00 UTC
- Procesa en batches de 500 socios
- Si falla para un socio → conserva último score, registra error, reintenta en siguiente ciclo
- Si socio tiene < 30 días de historial → score = 0, flag `riskInsufficient = true`
- Detecta transiciones a HIGH → encola alerta en Bandeja_Alertas

### 6. Dashboard & Metrics

**Estrategia de Cálculo:**
- Métricas se pre-calculan cada 15 minutos via job de BullMQ
- Resultados almacenados en Redis con TTL de 15 min
- Dashboard lee de cache; si miss → calcula on-demand (fallback)

**Cálculos Principales:**
```sql
-- Tasa de Retención
WITH start_members AS (
  SELECT id FROM members WHERE tenant_id = $1 AND is_active = true
  AND created_at <= $startDate
),
end_members AS (
  SELECT id FROM members WHERE tenant_id = $1 AND is_active = true
  AND id IN (SELECT id FROM start_members)
  AND deactivated_at IS NULL OR deactivated_at > $endDate
)
SELECT (COUNT(end_members) * 100.0 / NULLIF(COUNT(start_members), 0)) as retention_rate;

-- Ingresos Proyectados
-- 1. Membresías activas que no vencen el mes siguiente: sum(plan.price)
-- 2. Membresías que vencen el mes siguiente: sum(plan.price) * retention_rate_6m
-- 3. Total = (1) + (2)
```

## Security Design

### Encryption
- **At rest**: PostgreSQL con pgcrypto para campos PII, AES-256
- **In transit**: TLS 1.2+ obligatorio, HSTS headers
- **Secrets**: Variables de entorno + vault para tokens de WhatsApp

### Authentication Security
- Passwords: Argon2id (memory=64MB, iterations=3, parallelism=4)
- JWT: RS256, access token 15 min, refresh token 7 días con rotación
- 2FA: TOTP (RFC 6238), código de 6 dígitos, ventana de 60 segundos
- Rate limiting: 5 intentos / 15 min → bloqueo 15 min

### Multi-Tenant Isolation
- Prisma middleware: inyecta `tenantId` en todas las operaciones
- PostgreSQL Row-Level Security como segunda capa de defensa
- Validación en application layer + database layer (defense in depth)

### API Security
- API tokens: SHA-256 hash almacenado, token original solo visible al crear
- Rate limiting: 120 req/min por token (sliding window en Redis)
- Webhooks: HMAC-SHA256 + timestamp validation (±5 min)
- CORS: whitelist por tenant

### Data Protection (GDPR/LGPD)
- Consent tracking con timestamp y canal
- Data export: job asíncrono genera JSON con toda la PII
- Data deletion: anonimización irreversible de campos PII
- Audit log inmutable: append-only, sin DELETE/UPDATE permitido

## Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              Load Balancer (HTTPS)            │
└──────────────────────┬──────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │ App Pod │   │ App Pod │   │ App Pod │  (Horizontal scaling)
   │ (API +  │   │ (API +  │   │ (API +  │
   │  Workers)│   │  Workers)│   │  Workers)│
   └────┬────┘   └────┬────┘   └────┬────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐   ┌────▼────┐   ┌────▼────┐
   │PostgreSQL│   │  Redis   │   │   S3    │
   │ Primary  │   │ Cluster  │   │ Storage │
   │ + Replica│   │          │   │         │
   └──────────┘   └──────────┘   └─────────┘
```

**Escalabilidad:**
- API: stateless, escala horizontalmente con más pods
- Workers (BullMQ): escalan independientemente según carga de campañas
- PostgreSQL: read replicas para queries de dashboard/reportes
- Redis: cluster mode para alta disponibilidad

## Project Structure

```
gimnasio-fidelizacion/
├── apps/
│   ├── web/                          # React frontend
│   │   ├── src/
│   │   │   ├── components/           # UI components (Shadcn)
│   │   │   ├── pages/                # Route pages
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── services/             # API client (TanStack Query)
│   │   │   ├── stores/               # Zustand stores
│   │   │   ├── types/                # Shared TypeScript types
│   │   │   └── utils/                # Helpers
│   │   ├── public/
│   │   └── package.json
│   │
│   └── api/                          # Fastify backend
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/             # Login, JWT, 2FA, RBAC
│       │   │   ├── members/          # CRUD socios, import, search
│       │   │   ├── plans/            # Planes y membresías
│       │   │   ├── payments/         # Pagos, anulación, export
│       │   │   ├── attendance/       # Registro asistencia, QR
│       │   │   ├── campaigns/        # CRUD campañas, segmentos
│       │   │   ├── whatsapp/         # GestorWhatsApp, inbox, webhook
│       │   │   ├── points/           # Puntos, recompensas, canje
│       │   │   ├── nps/              # Encuestas NPS
│       │   │   ├── risk/             # MotorRiesgo
│       │   │   ├── dashboard/        # Métricas, exports
│       │   │   ├── referrals/        # Programa referidos
│       │   │   ├── audit/            # Log de auditoría
│       │   │   └── external-api/     # API pública + webhooks
│       │   ├── workers/
│       │   │   ├── campaign-scheduler.ts
│       │   │   ├── campaign-sender.ts
│       │   │   ├── risk-calculator.ts
│       │   │   ├── membership-expiry.ts
│       │   │   ├── metrics-aggregator.ts
│       │   │   └── import-processor.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts           # JWT verification
│       │   │   ├── tenant.ts         # Tenant context injection
│       │   │   ├── rbac.ts           # Role-based access
│       │   │   ├── rate-limit.ts     # Rate limiting
│       │   │   └── audit.ts          # Audit logging
│       │   ├── lib/
│       │   │   ├── prisma.ts         # Prisma client with tenant middleware
│       │   │   ├── redis.ts          # Redis connection
│       │   │   ├── queue.ts          # BullMQ setup
│       │   │   ├── whatsapp-client.ts # Meta Cloud API client
│       │   │   └── crypto.ts         # Encryption utilities
│       │   └── app.ts                # Fastify app setup
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared types, validators, constants
│       ├── src/
│       │   ├── types/
│       │   ├── validators/           # Zod schemas (shared frontend/backend)
│       │   └── constants/
│       └── package.json
│
├── docker-compose.yml                # Dev environment
├── Dockerfile                        # Production build
├── turbo.json                        # Turborepo config
└── package.json                      # Workspace root
```

## Correctness Properties

### Property 1: Aislamiento de Tenant

**Validates: Requirements 1.1, 1.2, 1.3**

Ninguna operación puede leer, crear o modificar datos de un Tenant distinto al Tenant_Activo de la sesión. Garantizado por Prisma middleware + PostgreSQL RLS.

### Property 2: Membresía Única Activa

**Validates: Requirements 7.3, 7.4**

Un Socio puede tener a lo sumo una Membresía con status ACTIVE en cualquier momento. Enforced por constraint de aplicación + check en transacción.

### Property 3: Atomicidad de Canje de Puntos

**Validates: Requirements 13.4, 13.5, 13.6**

El descuento de puntos, decremento de stock y generación de código de canje ocurren en una única transacción. Si cualquier paso falla, se revierte todo.

### Property 4: Idempotencia de Webhooks

**Validates: Requirements 5.6**

Un webhook con el mismo `idempotencyKey` procesado en las últimas 24h no produce efectos secundarios duplicados.

### Property 5: Consistencia de Saldo de Puntos

**Validates: Requirements 13.2, 13.7**

`pointsBalance` en Member siempre es igual a la suma de todos los `PointMovement.points` del socio. Verificable por reconciliación periódica.

### Property 6: Inmutabilidad de Auditoría

**Validates: Requirements 24.3**

Las entradas del AuditLog no pueden ser modificadas ni eliminadas. Enforced por permisos de DB (REVOKE UPDATE, DELETE en tabla audit_logs).

### Property 7: Ventana de Conversación WhatsApp

**Validates: Requirements 17.3, 17.6**

Mensajes de texto libre solo se envían si existe un `ConversationWindow` no expirado para el socio. Verificado antes de cada envío.

### Property 8: Opt-out Irreversible por Campañas

**Validates: Requirements 17.9, 21.8**

Un socio con `optOut = true` nunca es incluido en el resultado de evaluación de segmentos para campañas automáticas.

### Concurrencia

- Canje de recompensas: `SELECT ... FOR UPDATE` en Member y Reward para evitar race conditions en saldo/stock.
- Registro de asistencia: deduplicación por `(memberId, timestamp)` con ventana configurable, usando `INSERT ... ON CONFLICT DO NOTHING`.
- Contadores de campaña: Redis `INCR` atómico para actualización en tiempo real.

## Error Handling

### Estrategia General

| Tipo de Error | Comportamiento | Respuesta al Usuario |
|---------------|---------------|---------------------|
| Validación (400) | Rechazar sin persistir, preservar datos del form | Mensaje específico por campo inválido |
| No autorizado (401) | Rechazar, registrar en audit log | "Credenciales inválidas" (genérico) |
| Prohibido (403) | Rechazar, registrar en audit log | "Permiso insuficiente" |
| No encontrado (404) | Rechazar | "Recurso no encontrado" |
| Conflicto (409) | Rechazar, no modificar estado | Mensaje de conflicto específico (ej: teléfono duplicado) |
| Rate limit (429) | Rechazar, header Retry-After | "Demasiadas solicitudes, intente en X segundos" |
| Error interno (500) | Log detallado, alerta a ops | "Error interno, intente más tarde" |

### Manejo de Fallos en Workers

| Worker | Fallo | Acción |
|--------|-------|--------|
| campaign-sender | Error recuperable de Meta (429, 5xx) | Reintento exponencial (30s, 60s, 120s), max 3 intentos |
| campaign-sender | Error no recuperable de Meta | Marcar mensaje como FAILED, registrar motivo, continuar con siguiente |
| risk-calculator | Error en cálculo de un socio | Conservar último score válido, registrar error, reintentar en siguiente ciclo |
| membership-expiry | Error al marcar membresía | Reintentar en siguiente ejecución (cada 30 min) |
| metrics-aggregator | Error de cálculo | Servir datos de cache anterior, registrar error |
| import-processor | Error en fila individual | Marcar fila como rechazada, continuar procesamiento |

### Circuit Breaker (WhatsApp)

- Si >50% de envíos fallan en ventana de 5 minutos → abrir circuito
- Circuito abierto: encolar mensajes sin enviar, notificar admin
- Después de 5 minutos → half-open: enviar 1 mensaje de prueba
- Si éxito → cerrar circuito, procesar cola
- Si fallo → mantener abierto otros 5 minutos

### Audit Log Resilience

- Si falla escritura de audit log → 3 reintentos con 2s entre cada uno
- Si persiste falla → escribir en buffer local (archivo) + alerta a Dueño
- Job de reconciliación cada hora: procesa buffer local → DB

## Testing Strategy

### Niveles de Testing

| Nivel | Herramienta | Cobertura Objetivo | Qué se Prueba |
|-------|-------------|-------------------|---------------|
| Unit | Vitest | 80% líneas | Lógica de negocio, validadores, cálculos (risk score, NPS, retención) |
| Integration | Vitest + Testcontainers | Módulos críticos | Queries con PostgreSQL real, BullMQ jobs, Redis cache |
| API (E2E) | Vitest + Supertest | Todos los endpoints | Request/response, auth, RBAC, multi-tenancy isolation |
| Frontend | Vitest + Testing Library | Componentes críticos | Forms, validaciones, estados de carga/error |
| E2E Browser | Playwright | Flujos principales | Login, alta socio, registro asistencia, crear campaña |

### Casos de Test Críticos

1. **Multi-Tenancy Isolation**: Crear datos en Tenant A, verificar que Tenant B no puede acceder.
2. **Canje Atómico**: Simular canje concurrente del mismo socio → solo uno debe tener éxito.
3. **Deduplicación de Asistencia**: Registrar 2 asistencias en <30 min → segunda rechazada.
4. **Opt-out Enforcement**: Socio con opt-out nunca aparece en evaluación de segmentos.
5. **Bloqueo por Intentos**: 5 logins fallidos → 6to rechazado con mensaje de bloqueo.
6. **Webhook Idempotencia**: Enviar mismo webhook 2 veces → solo 1 registro creado.
7. **Risk Score Edge Cases**: Socio sin historial → score 0 + flag insufficient.
8. **Campaign Lifecycle**: Draft → Scheduled → Running → Paused → Resumed → Finished.
9. **WhatsApp Retry**: Mock de error 429 → verificar 3 reintentos con backoff.
10. **Data Export/Deletion**: Verificar que export contiene toda PII, deletion la anonimiza.

### Entorno de Testing

- **Dev**: Docker Compose con PostgreSQL + Redis locales
- **CI**: GitHub Actions con Testcontainers (PostgreSQL + Redis efímeros)
- **Staging**: Réplica de producción con datos sintéticos, WhatsApp sandbox de Meta

## Key Design Decisions

| Decisión | Alternativa Considerada | Justificación |
|----------|------------------------|---------------|
| Monolito modular (Fastify) | Microservicios separados | Menor complejidad operativa para MVP; la estructura modular permite extraer servicios después |
| PostgreSQL único con tenant_id | DB por tenant | Más simple de operar y migrar; RLS provee aislamiento suficiente para la escala esperada |
| BullMQ sobre Redis | RabbitMQ, SQS | Ya usamos Redis para cache/sesiones; BullMQ tiene scheduling nativo y UI de monitoreo |
| Prisma | TypeORM, Drizzle | Mejor DX con TypeScript, migraciones declarativas, middleware para multi-tenancy |
| Argon2id | bcrypt | Más resistente a ataques GPU/ASIC, recomendado por OWASP 2024 |
| JWT + Refresh rotation | Sessions en DB | Stateless para escalar API horizontalmente; rotación mitiga token theft |
| React + Shadcn/ui | Next.js, Vue | SPA pura (no necesita SSR), Shadcn da control total sobre accesibilidad |
| Turborepo monorepo | Nx, repos separados | Ligero, comparte tipos entre frontend/backend, builds incrementales |

## Requirement Traceability

| Requirement | Components | Key Tables |
|-------------|-----------|------------|
| Req 1: Multi-Tenant | Tenant middleware, RLS | Tenant, UserTenant |
| Req 2: Auth | Auth Service | User, UserTenant |
| Req 3: CRUD Socios | Members module | Member, MemberTag |
| Req 4: Import | Import processor worker | Member (batch) |
| Req 5: API Externa | External API module | ApiToken |
| Req 6: Asistencia | Attendance module | Attendance |
| Req 7: Planes/Membresías | Plans module, expiry worker | Plan, Membership |
| Req 8: Pagos | Payments module | Payment |
| Req 9: Campañas | Campaigns module | Campaign, Segment, CampaignExecution |
| Req 10: Recordatorio | Campaign scheduler | Campaign (type=REMINDER) |
| Req 11: Cumpleaños | Campaign scheduler | Campaign (type=BIRTHDAY) |
| Req 12: Renovación | Campaign scheduler | Campaign (type=RENEWAL) |
| Req 13: Puntos | Points module | PointRule, PointMovement, Reward, Redemption |
| Req 14: Promo Masiva | Campaign scheduler/sender | Campaign (type=PROMO) |
| Req 15: Referidos | Referrals module | Member (referralCode, referredById) |
| Req 16: NPS | NPS module | NpsSurvey, NpsResponse |
| Req 17: WhatsApp | WhatsApp module | Message, ConversationWindow |
| Req 18: Dashboard | Dashboard module, metrics worker | (aggregated queries) |
| Req 19: Efectividad | Campaigns module | CampaignExecution |
| Req 20: Riesgo | Risk engine worker | Member (riskScore, riskLevel) |
| Req 21: Protección Datos | Crypto lib, audit middleware | AuditLog, Member (PII encrypted) |
| Req 22: UI Responsive | Web app (React + Shadcn) | — |
| Req 23: Rendimiento | Redis cache, indexes, workers | — |
| Req 24: Auditoría | Audit middleware | AuditLog |
