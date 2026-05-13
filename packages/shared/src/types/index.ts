// ─── Roles ───────────────────────────────────────────────────────────────────
export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
}

// ─── Membership ──────────────────────────────────────────────────────────────
export enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

// ─── Payments ────────────────────────────────────────────────────────────────
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  MERCADOPAGO = 'MERCADOPAGO',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
export enum CampaignType {
  PROMOTIONAL = 'PROMOTIONAL',
  RETENTION = 'RETENTION',
  REACTIVATION = 'REACTIVATION',
  BIRTHDAY = 'BIRTHDAY',
  NPS = 'NPS',
}

export enum CampaignFrequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
}

// ─── Messages ────────────────────────────────────────────────────────────────
export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageStatus {
  QUEUED = 'QUEUED',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

// ─── Risk & Points ───────────────────────────────────────────────────────────
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum PointEvent {
  ATTENDANCE = 'ATTENDANCE',
  REFERRAL = 'REFERRAL',
  PURCHASE = 'PURCHASE',
  BIRTHDAY = 'BIRTHDAY',
  NPS_RESPONSE = 'NPS_RESPONSE',
  MANUAL = 'MANUAL',
}

export enum PointMoveType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
  EXPIRE = 'EXPIRE',
  ADJUST = 'ADJUST',
}

// ─── NPS ─────────────────────────────────────────────────────────────────────
export enum NpsFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  BIANNUAL = 'BIANNUAL',
  ANNUAL = 'ANNUAL',
}

// ─── Attendance ──────────────────────────────────────────────────────────────
export enum AttendanceMethod {
  QR = 'QR',
  MANUAL = 'MANUAL',
  BIOMETRIC = 'BIOMETRIC',
  NFC = 'NFC',
}

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  gymId: string;
  totpEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: Date;
  points: number;
  riskLevel: RiskLevel;
  gymId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface Plan {
  id: string;
  name: string;
  description?: string;
  durationDays: number;
  price: number;
  currency: string;
  gymId: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Payment {
  id: string;
  membershipId: string;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  type: CampaignType;
  segmentId?: string;
  templateName: string;
  startAt: Date;
  frequency: CampaignFrequency;
  status: CampaignStatus;
  gymId: string;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  memberId: string;
  gymId: string;
  method: AttendanceMethod;
  checkedInAt: Date;
}
