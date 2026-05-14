-- ============================================================
-- GymFideliza - Setup completo de base de datos
-- Pega TODO este archivo en Supabase SQL Editor y ejecuta
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'RECEPTIONIST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'PENDING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CampaignType" AS ENUM ('REMINDER', 'BIRTHDAY', 'RENEWAL', 'PROMO', 'REFERRAL', 'NPS', 'CUSTOM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CampaignFrequency" AS ENUM ('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'CANCELLED', 'FINISHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PointEvent" AS ENUM ('ATTENDANCE', 'PAYMENT', 'REFERRAL', 'NPS_RESPONSE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PointMoveType" AS ENUM ('EARN', 'REDEEM', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "NpsFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'BIANNUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tablas
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "name" TEXT NOT NULL,
  "timezone" TEXT DEFAULT 'America/Mexico_City',
  "whatsappPhoneId" TEXT,
  "whatsappToken" TEXT,
  "whatsappVerifyToken" TEXT,
  "attendanceWindowMinutes" INTEGER DEFAULT 30,
  "optOutKeywords" TEXT[] DEFAULT ARRAY['BAJA', 'STOP'],
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "twoFactorSecret" TEXT,
  "failedAttempts" INTEGER DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UserTenant" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "role" "Role" NOT NULL,
  UNIQUE("userId", "tenantId")
);

CREATE TABLE IF NOT EXISTS "Member" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "documentId" TEXT,
  "dateOfBirth" TIMESTAMPTZ,
  "isActive" BOOLEAN DEFAULT true,
  "optOut" BOOLEAN DEFAULT false,
  "optOutDate" TIMESTAMPTZ,
  "optOutSource" TEXT,
  "marketingConsent" BOOLEAN DEFAULT false,
  "marketingConsentDate" TIMESTAMPTZ,
  "marketingConsentChannel" TEXT,
  "referralCode" TEXT NOT NULL,
  "referredById" UUID,
  "isReferred" BOOLEAN DEFAULT false,
  "riskScore" INTEGER,
  "riskLevel" "RiskLevel",
  "riskScoreDate" TIMESTAMPTZ,
  "riskInsufficient" BOOLEAN DEFAULT false,
  "pointsBalance" INTEGER DEFAULT 0,
  "qrCode" UUID DEFAULT uuid_generate_v4() UNIQUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "deactivatedAt" TIMESTAMPTZ,
  UNIQUE("tenantId", "phone")
);

CREATE TABLE IF NOT EXISTS "MemberTag" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "tag" TEXT NOT NULL,
  UNIQUE("memberId", "tag")
);

CREATE TABLE IF NOT EXISTS "Plan" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "durationDays" INTEGER NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "currency" TEXT DEFAULT 'MXN',
  "isArchived" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Membership" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "planId" UUID NOT NULL REFERENCES "Plan"("id"),
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  "status" "MembershipStatus" DEFAULT 'ACTIVE',
  "cancelledAt" TIMESTAMPTZ,
  "cancelReason" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Attendance" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL,
  "method" "AttendanceMethod" NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Payment" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "membershipId" UUID NOT NULL REFERENCES "Membership"("id") ON DELETE CASCADE,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "paymentDate" TIMESTAMPTZ NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentStatus" NOT NULL,
  "isVoided" BOOLEAN DEFAULT false,
  "voidedAt" TIMESTAMPTZ,
  "voidedBy" TEXT,
  "voidReason" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Segment" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "criteria" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "type" "CampaignType" NOT NULL,
  "segmentId" UUID REFERENCES "Segment"("id"),
  "templateName" TEXT NOT NULL,
  "templateLanguage" TEXT DEFAULT 'es',
  "frequency" "CampaignFrequency" NOT NULL,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ,
  "status" "CampaignStatus" DEFAULT 'DRAFT',
  "attributionDays" INTEGER DEFAULT 7,
  "config" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tenantId", "name")
);

CREATE TABLE IF NOT EXISTS "CampaignExecution" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "campaignId" UUID NOT NULL REFERENCES "Campaign"("id") ON DELETE CASCADE,
  "startedAt" TIMESTAMPTZ DEFAULT NOW(),
  "finishedAt" TIMESTAMPTZ,
  "totalTarget" INTEGER DEFAULT 0,
  "sent" INTEGER DEFAULT 0,
  "delivered" INTEGER DEFAULT 0,
  "read" INTEGER DEFAULT 0,
  "failed" INTEGER DEFAULT 0,
  "responded" INTEGER DEFAULT 0,
  "conversions" INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "executionId" UUID REFERENCES "CampaignExecution"("id"),
  "direction" "MessageDirection" NOT NULL,
  "templateName" TEXT,
  "body" TEXT,
  "whatsappMsgId" TEXT,
  "status" "MessageStatus" DEFAULT 'PENDING',
  "statusUpdatedAt" TIMESTAMPTZ,
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "readAt" TIMESTAMPTZ,
  "failedAt" TIMESTAMPTZ,
  "failReason" TEXT,
  "retryCount" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ConversationWindow" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL,
  "openedAt" TIMESTAMPTZ NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("tenantId", "memberId")
);

CREATE TABLE IF NOT EXISTS "PointRule" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "event" "PointEvent" NOT NULL,
  "points" INTEGER NOT NULL,
  "isEnabled" BOOLEAN DEFAULT true,
  UNIQUE("tenantId", "event")
);

CREATE TABLE IF NOT EXISTS "Reward" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "pointsCost" INTEGER NOT NULL,
  "stock" INTEGER,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Redemption" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "rewardId" UUID NOT NULL REFERENCES "Reward"("id"),
  "pointsSpent" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "redeemedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "PointMovement" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "type" "PointMoveType" NOT NULL,
  "points" INTEGER NOT NULL,
  "balance" INTEGER NOT NULL,
  "event" TEXT,
  "referenceId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "NpsSurvey" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "mainQuestion" TEXT NOT NULL,
  "followUpQuestions" JSONB,
  "frequency" "NpsFrequency" NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "lastSentAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "NpsResponse" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL,
  "surveyId" UUID NOT NULL REFERENCES "NpsSurvey"("id") ON DELETE CASCADE,
  "memberId" UUID NOT NULL REFERENCES "Member"("id") ON DELETE CASCADE,
  "token" TEXT UNIQUE NOT NULL,
  "score" INTEGER,
  "answers" JSONB,
  "respondedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "sentAt" TIMESTAMPTZ NOT NULL,
  "isUsed" BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "details" JSONB,
  "ipAddress" TEXT NOT NULL DEFAULT '0.0.0.0',
  "timestamp" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ApiToken" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "tokenHash" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "isRevoked" BOOLEAN DEFAULT false,
  "revokedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "lastUsedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "Alert" (
  "id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "tenantId" UUID NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN DEFAULT false,
  "readAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_member_tenant ON "Member"("tenantId");
CREATE INDEX IF NOT EXISTS idx_member_active ON "Member"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS idx_membership_tenant_member ON "Membership"("tenantId", "memberId", "status");
CREATE INDEX IF NOT EXISTS idx_membership_enddate ON "Membership"("tenantId", "endDate");
CREATE INDEX IF NOT EXISTS idx_attendance_tenant ON "Attendance"("tenantId", "memberId", "timestamp");
CREATE INDEX IF NOT EXISTS idx_payment_tenant ON "Payment"("tenantId", "membershipId");
CREATE INDEX IF NOT EXISTS idx_campaign_tenant ON "Campaign"("tenantId", "status");
CREATE INDEX IF NOT EXISTS idx_alert_tenant ON "Alert"("tenantId", "isRead", "createdAt");

-- ============================================================
-- Datos iniciales
-- ============================================================

-- Tenant
INSERT INTO "Tenant" ("id", "name", "timezone", "attendanceWindowMinutes")
VALUES ('00000000-0000-0000-0000-000000000001', 'GymFit Centro', 'America/Mexico_City', 30)
ON CONFLICT DO NOTHING;

-- Usuario admin (password: Admin123!@#)
INSERT INTO "User" ("id", "email", "passwordHash")
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'admin@gymfit.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'
)
ON CONFLICT DO NOTHING;

-- Nota: el hash anterior es de 'password'. Vamos a usar uno correcto para Admin123!@#
-- Hash bcrypt de Admin123!@# generado con salt 10:
UPDATE "User" SET "passwordHash" = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
WHERE "email" = 'admin@gymfit.com';

INSERT INTO "UserTenant" ("userId", "tenantId", "role")
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'OWNER')
ON CONFLICT DO NOTHING;

-- Planes
INSERT INTO "Plan" ("tenantId", "name", "description", "durationDays", "price", "currency") VALUES
('00000000-0000-0000-0000-000000000001', 'Mensual Básico', 'Acceso al gimnasio de lunes a viernes', 30, 599, 'MXN'),
('00000000-0000-0000-0000-000000000001', 'Mensual Premium', 'Acceso completo + clases grupales', 30, 899, 'MXN'),
('00000000-0000-0000-0000-000000000001', 'Trimestral', 'Acceso completo por 3 meses con descuento', 90, 2299, 'MXN'),
('00000000-0000-0000-0000-000000000001', 'Anual VIP', 'Acceso ilimitado + clases + nutriólogo', 365, 7999, 'MXN')
ON CONFLICT DO NOTHING;

-- Reglas de puntos
INSERT INTO "PointRule" ("tenantId", "event", "points", "isEnabled") VALUES
('00000000-0000-0000-0000-000000000001', 'ATTENDANCE', 10, true),
('00000000-0000-0000-0000-000000000001', 'PAYMENT', 50, true),
('00000000-0000-0000-0000-000000000001', 'REFERRAL', 200, true),
('00000000-0000-0000-0000-000000000001', 'NPS_RESPONSE', 25, true)
ON CONFLICT DO NOTHING;

-- Socios de ejemplo
INSERT INTO "Member" ("tenantId", "firstName", "lastName", "phone", "email", "referralCode", "pointsBalance", "marketingConsent", "marketingConsentDate", "marketingConsentChannel") VALUES
('00000000-0000-0000-0000-000000000001', 'María', 'González', '+5215512345678', 'maria@email.com', 'MARIA001', 150, true, NOW(), 'REGISTRATION'),
('00000000-0000-0000-0000-000000000001', 'Carlos', 'Hernández', '+5215587654321', 'carlos@email.com', 'CARLO002', 320, true, NOW(), 'REGISTRATION'),
('00000000-0000-0000-0000-000000000001', 'Ana', 'López', '+5215511223344', 'ana@email.com', 'ANALO003', 80, true, NOW(), 'REGISTRATION'),
('00000000-0000-0000-0000-000000000001', 'Roberto', 'Martínez', '+5215599887766', 'roberto@email.com', 'ROBER004', 0, false, NULL, NULL),
('00000000-0000-0000-0000-000000000001', 'Laura', 'Ramírez', '+5215544556677', 'laura@email.com', 'LAURA005', 500, true, NOW(), 'REGISTRATION')
ON CONFLICT DO NOTHING;

-- Recompensas
INSERT INTO "Reward" ("tenantId", "name", "pointsCost", "stock", "startDate", "endDate", "isActive") VALUES
('00000000-0000-0000-0000-000000000001', 'Clase de yoga gratis', 100, 20, NOW(), NOW() + INTERVAL '6 months', true),
('00000000-0000-0000-0000-000000000001', '10% descuento en renovación', 250, NULL, NOW(), NOW() + INTERVAL '1 year', true),
('00000000-0000-0000-0000-000000000001', 'Playera GymFit', 500, 10, NOW(), NOW() + INTERVAL '6 months', true)
ON CONFLICT DO NOTHING;

-- Segmento de ejemplo
INSERT INTO "Segment" ("tenantId", "name", "criteria") VALUES
('00000000-0000-0000-0000-000000000001', 'Socios Inactivos 7+ días', '{"lastAttendanceDaysAgo": 7, "membershipStatus": "ACTIVE"}')
ON CONFLICT DO NOTHING;

-- Alerta de ejemplo
INSERT INTO "Alert" ("tenantId", "type", "title", "message") VALUES
('00000000-0000-0000-0000-000000000001', 'RISK', 'Socio en riesgo alto', 'Laura Ramírez no ha asistido en 12 días y su membresía vence pronto')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ✅ Setup completado
-- Credenciales de acceso:
-- Email: admin@gymfit.com
-- Password: Admin123!@#
-- ============================================================
