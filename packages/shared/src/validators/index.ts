import { z } from 'zod';
import { PaymentMethod, PaymentStatus, CampaignFrequency } from '../types/index.js';

// ─── Auth ────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Members ─────────────────────────────────────────────────────────────────
export const createMemberSchema = z.object({
  firstName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  lastName: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'El teléfono debe estar en formato E.164 (ej: +5491155551234)'),
  email: z.string().email('Email inválido').optional(),
  dateOfBirth: z.coerce.date().optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

// ─── Plans ───────────────────────────────────────────────────────────────────
export const createPlanSchema = z.object({
  name: z.string().min(2, 'El nombre del plan debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  durationDays: z.number().int().positive('La duración debe ser un número positivo'),
  price: z.number().positive('El precio debe ser mayor a 0'),
  currency: z.string().length(3, 'La moneda debe ser un código ISO de 3 caracteres').default('ARS'),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

// ─── Campaigns ───────────────────────────────────────────────────────────────
export const createCampaignSchema = z.object({
  name: z.string().min(2, 'El nombre de la campaña debe tener al menos 2 caracteres'),
  objective: z.string().min(5, 'El objetivo debe tener al menos 5 caracteres'),
  segmentId: z.string().uuid('ID de segmento inválido').optional(),
  templateName: z.string().min(1, 'El nombre del template es requerido'),
  startAt: z.coerce.date(),
  frequency: z.nativeEnum(CampaignFrequency),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ─── Payments ────────────────────────────────────────────────────────────────
export const createPaymentSchema = z.object({
  membershipId: z.string().uuid('ID de membresía inválido'),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  paymentDate: z.coerce.date(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.COMPLETED),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
