// =============================================================================
// api/index.js — Single Vercel serverless function handling all API routes
// =============================================================================

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------
const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

// AI config
const AI_PROVIDER = process.env.AI_PROVIDER || 'openai';
const AI_API_KEY = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// ---------------------------------------------------------------------------
// Prisma singleton
// ---------------------------------------------------------------------------
let prisma;
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });
  }
  return prisma;
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res) {
  const user = verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }
  return user;
}

function requireRole(req, res, allowedRoles) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: 'Permiso insuficiente' });
    return null;
  }
  return user;
}

// ---------------------------------------------------------------------------
// AI helpers
// ---------------------------------------------------------------------------
function isAIEnabled() {
  return !!AI_API_KEY;
}

async function callAI(systemPrompt, userPrompt, options = {}) {
  if (!AI_API_KEY) {
    throw new Error('AI no configurada. Configura OPENAI_API_KEY o ANTHROPIC_API_KEY en Vercel.');
  }
  const { temperature = 0.7, maxTokens = 1500, jsonMode = true } = options;
  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
  }
  return callOpenAI(systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
}

async function callOpenAI(systemPrompt, userPrompt, opts) {
  const body = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens,
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  if (opts.jsonMode) {
    try { return JSON.parse(content); } catch { return { raw: content }; }
  }
  return content;
}

async function callAnthropic(systemPrompt, userPrompt, opts) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': AI_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: opts.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${errorText}`);
  }
  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  if (opts.jsonMode) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { return { raw: content }; }
    }
    return { raw: content };
  }
  return content;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

// --- HEALTH ---
async function handleHealth(req, res) {
  const allEnvKeys = Object.keys(process.env).sort();
  const safeKeys = allEnvKeys.filter(
    (k) =>
      k.includes('DATABASE') ||
      k.includes('POSTGRES') ||
      k.includes('SUPABASE') ||
      k.includes('JWT') ||
      k.includes('NODE') ||
      k === 'VERCEL' ||
      k === 'VERCEL_ENV' ||
      k === 'VERCEL_REGION'
  );
  const envInfo = {};
  for (const key of safeKeys) {
    const value = process.env[key];
    if (!value) {
      envInfo[key] = '(empty)';
    } else if (value.includes('postgres://') || value.includes('postgresql://')) {
      envInfo[key] = value.replace(/:([^:@]+)@/, ':****@').substring(0, 150);
    } else if (value.length > 50) {
      envInfo[key] = value.substring(0, 20) + '...(' + value.length + ' chars)';
    } else {
      envInfo[key] = value;
    }
  }

  let dbStatus = { connected: false };
  if (DATABASE_URL) {
    try {
      const db = getPrisma();
      const result = await db.$queryRaw`SELECT 1 as ok`;
      const userCount = await db.user.count().catch((e) => ({ error: e.message }));
      const tenantCount = await db.tenant.count().catch((e) => ({ error: e.message }));
      dbStatus = { connected: true, result, userCount, tenantCount };
    } catch (err) {
      dbStatus = { connected: false, error: err.message, code: err.code, name: err.name };
    }
  } else {
    dbStatus = { connected: false, error: 'No database URL found in any env var' };
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalEnvVars: allEnvKeys.length,
    relevantEnvVars: envInfo,
    database: dbStatus,
    node: process.version,
  });
}

// --- AUTH LOGIN ---
async function handleAuthLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!DATABASE_URL) {
    return res.status(500).json({
      error: 'Base de datos no configurada',
      hint: 'Configure DATABASE_URL o POSTGRES_URL en las variables de entorno de Vercel',
    });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  const db = getPrisma();
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return res.status(423).json({
      error: `Cuenta bloqueada temporalmente. Intente en ${minutesLeft} minuto(s).`,
    });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedAttempts + 1;
    const update = { failedAttempts: attempts };
    if (attempts >= 5) {
      update.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      update.failedAttempts = 0;
    }
    await db.user.update({ where: { id: user.id }, data: update });
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  const userTenants = await db.userTenant.findMany({
    where: { userId: user.id },
    include: { tenant: true },
  });
  if (userTenants.length === 0) {
    return res.status(403).json({ error: 'No tiene acceso a ningún gimnasio' });
  }

  const selectedTenant = userTenants[0];
  const payload = {
    userId: user.id,
    tenantId: selectedTenant.tenantId,
    role: selectedTenant.role,
  };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });

  return res.status(200).json({
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email },
    tenants: userTenants.map((ut) => ({
      id: ut.tenant.id,
      name: ut.tenant.name,
      role: ut.role,
    })),
    currentTenant: {
      id: selectedTenant.tenant.id,
      name: selectedTenant.tenant.name,
      role: selectedTenant.role,
    },
  });
}

// --- DASHBOARD ---
async function handleDashboard(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    activeMemberships,
    totalMembers,
    newMembers,
    newMembersPrev,
    atRiskMembers,
    attendanceLast30,
    attendanceToday,
    revenueThisMonth,
    revenueLastMonth,
  ] = await Promise.all([
    db.membership.findMany({
      where: { tenantId, status: 'ACTIVE', endDate: { gte: now } },
      select: { memberId: true },
      distinct: ['memberId'],
    }),
    db.member.count({ where: { tenantId, isActive: true } }),
    db.member.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    db.member.count({ where: { tenantId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.member.count({ where: { tenantId, isActive: true, riskLevel: 'HIGH' } }),
    db.attendance.count({ where: { tenantId, timestamp: { gte: thirtyDaysAgo } } }),
    db.attendance.count({ where: { tenantId, timestamp: { gte: startOfToday } } }),
    db.payment.aggregate({
      where: { tenantId, paymentDate: { gte: startOfMonth }, status: 'PAID', isVoided: false },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: 'PAID',
        isVoided: false,
      },
      _sum: { amount: true },
    }),
  ]);

  const activeMemberCount = activeMemberships.length;
  const avgAttendancePerMember =
    activeMemberCount > 0
      ? Math.round((attendanceLast30 / activeMemberCount) * 10) / 10
      : 0;
  const currentRevenue = Number(revenueThisMonth._sum.amount || 0);
  const lastMonthRev = Number(revenueLastMonth._sum.amount || 0);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedRevenue =
    dayOfMonth > 0
      ? Math.round((currentRevenue / dayOfMonth) * daysInMonth * 100) / 100
      : 0;

  return res.status(200).json({
    members: {
      total: totalMembers,
      active: activeMemberCount,
      new: newMembers,
      newPreviousPeriod: newMembersPrev,
      atRisk: atRiskMembers,
    },
    retention: { rate: 0, churnRate: 0, churnCount: 0 },
    attendance: {
      today: attendanceToday,
      last30Days: attendanceLast30,
      avgPerMember: avgAttendancePerMember,
    },
    revenue: {
      currentMonth: currentRevenue,
      lastMonth: lastMonthRev,
      projected: projectedRevenue,
      currency: 'MXN',
    },
    generatedAt: now.toISOString(),
  });
}

// --- MEMBERS ---
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function handleMembers(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { search = '', page = '1', limit = '20', active } = req.query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where = { tenantId };
    if (active !== undefined) where.isActive = active === 'true';
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [members, total] = await Promise.all([
      db.member.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { plan: true },
            take: 1,
          },
        },
      }),
      db.member.count({ where }),
    ]);

    return res.status(200).json({
      data: members,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }

  if (req.method === 'POST') {
    const adminUser = requireRole(req, res, ['OWNER', 'ADMIN']);
    if (!adminUser) return;

    const { firstName, lastName, phone, email, dateOfBirth, marketingConsent } = req.body || {};
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    const existing = await db.member.findUnique({
      where: { tenantId_phone: { tenantId, phone } },
    });
    if (existing) return res.status(409).json({ error: 'Ya existe un socio con este teléfono' });

    const member = await db.member.create({
      data: {
        tenantId,
        firstName,
        lastName,
        phone,
        email: email || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        marketingConsent: !!marketingConsent,
        marketingConsentDate: marketingConsent ? new Date() : null,
        marketingConsentChannel: marketingConsent ? 'REGISTRATION' : null,
        referralCode: generateReferralCode(),
      },
    });
    return res.status(201).json(member);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- PLANS ---
async function handlePlans(req, res) {
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const plans = await db.plan.findMany({
      where: { tenantId, isArchived: false },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { memberships: { where: { status: 'ACTIVE' } } } } },
    });
    return res.status(200).json({ data: plans });
  }

  if (req.method === 'POST') {
    const { name, description, durationDays, price, currency = 'MXN' } = req.body || {};
    if (!name || !durationDays || price === undefined) {
      return res.status(400).json({ error: 'Nombre, duración y precio son requeridos' });
    }
    const plan = await db.plan.create({
      data: {
        tenantId,
        name,
        description: description || null,
        durationDays: parseInt(durationDays),
        price: parseFloat(price),
        currency,
      },
    });
    return res.status(201).json(plan);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- ATTENDANCES ---
async function handleAttendances(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'POST') {
    const { memberId, qrCode } = req.body || {};
    let member;
    if (memberId) {
      member = await db.member.findFirst({ where: { id: memberId, tenantId, isActive: true } });
    } else if (qrCode) {
      member = await db.member.findFirst({ where: { qrCode, tenantId, isActive: true } });
    } else {
      return res.status(400).json({ error: 'memberId o qrCode requerido' });
    }

    if (!member) return res.status(404).json({ error: 'Socio no encontrado o inactivo' });

    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    const windowMinutes = tenant?.attendanceWindowMinutes || 30;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recent = await db.attendance.findFirst({
      where: { tenantId, memberId: member.id, timestamp: { gte: windowStart } },
    });
    if (recent) {
      return res.status(409).json({
        error: `Ya se registró asistencia en los últimos ${windowMinutes} minutos`,
      });
    }

    const attendance = await db.attendance.create({
      data: {
        tenantId,
        memberId: member.id,
        timestamp: new Date(),
        method: qrCode ? 'QR' : 'MANUAL',
      },
    });
    return res.status(201).json({
      ...attendance,
      member: { firstName: member.firstName, lastName: member.lastName },
    });
  }

  if (req.method === 'GET') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendances = await db.attendance.findMany({
      where: { tenantId, timestamp: { gte: today } },
      orderBy: { timestamp: 'desc' },
      include: { member: { select: { firstName: true, lastName: true } } },
      take: 50,
    });
    return res.status(200).json({ data: attendances });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- CAMPAIGNS ---
async function handleCampaigns(req, res) {
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const campaigns = await db.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        segment: { select: { id: true, name: true } },
        _count: { select: { executions: true } },
      },
    });
    return res.status(200).json({ data: campaigns, pagination: { total: campaigns.length } });
  }

  if (req.method === 'POST') {
    const {
      name, objective, type, segmentId, templateName,
      templateLanguage = 'es', frequency, startAt, endAt,
      attributionDays = 7, config,
    } = req.body || {};

    if (!name || !objective || !type || !templateName || !frequency || !startAt) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const campaign = await db.campaign.create({
      data: {
        tenantId,
        name,
        objective,
        type,
        segmentId: segmentId || null,
        templateName,
        templateLanguage,
        frequency,
        startAt: new Date(startAt),
        endAt: endAt ? new Date(endAt) : null,
        attributionDays: parseInt(attributionDays),
        config: config || null,
        status: 'DRAFT',
      },
    });
    return res.status(201).json(campaign);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- SEGMENTS ---
async function handleSegments(req, res) {
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const segments = await db.segment.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { campaigns: true } } },
    });
    return res.status(200).json({ data: segments });
  }

  if (req.method === 'POST') {
    const { name, criteria } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const segment = await db.segment.create({
      data: { tenantId, name, criteria: criteria || {} },
    });
    return res.status(201).json(segment);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- PAYMENTS ---
async function handlePayments(req, res) {
  const user = requireAuth(req, res);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const payments = await db.payment.findMany({
      where: { tenantId },
      orderBy: { paymentDate: 'desc' },
      take: 100,
      include: {
        membership: {
          include: {
            member: { select: { firstName: true, lastName: true } },
            plan: { select: { name: true } },
          },
        },
      },
    });
    return res.status(200).json({ data: payments });
  }

  if (req.method === 'POST') {
    const { membershipId, amount, currency = 'MXN', paymentDate, method, status = 'PAID' } =
      req.body || {};
    if (!membershipId || !amount || !method) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    const payment = await db.payment.create({
      data: {
        tenantId,
        membershipId,
        amount: parseFloat(amount),
        currency,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        method,
        status,
      },
    });
    return res.status(201).json(payment);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- REWARDS ---
async function handleRewards(req, res) {
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const rewards = await db.reward.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { redemptions: true } } },
    });
    return res.status(200).json({ data: rewards });
  }

  if (req.method === 'POST') {
    const { name, pointsCost, stock, startDate, endDate, isActive = true } = req.body || {};
    if (!name || !pointsCost || !startDate || !endDate) {
      return res.status(400).json({ error: 'Nombre, costo en puntos y fechas son requeridos' });
    }
    const reward = await db.reward.create({
      data: {
        tenantId,
        name,
        pointsCost: parseInt(pointsCost),
        stock: stock !== undefined && stock !== null ? parseInt(stock) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isActive: !!isActive,
      },
    });
    return res.status(201).json(reward);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// --- ALERTS ---
async function handleAlerts(req, res) {
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  const db = getPrisma();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const alerts = await db.alert.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const unreadCount = await db.alert.count({ where: { tenantId, isRead: false } });
    return res.status(200).json({ data: alerts, unreadCount });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// AI route handlers
// ---------------------------------------------------------------------------

const AI_INSIGHTS_SYSTEM_PROMPT = `Eres un consultor de negocios experto en gimnasios. Analiza las métricas globales y genera insights ejecutivos accionables.

Responde con un objeto JSON con esta estructura:

{
  "summary": "string (resumen ejecutivo del estado del gimnasio, 2-3 oraciones, max 300 chars)",
  "healthScore": number (0-100, salud general del negocio),
  "strengths": [array de 2-3 fortalezas detectadas, max 100 chars cada una],
  "concerns": [array de 2-3 puntos de atención, max 100 chars cada uno],
  "opportunities": [
    {
      "title": "string (oportunidad detectada, max 80 chars)",
      "description": "string (max 200 chars)",
      "expectedImpact": "string (impacto en MXN o %, ej: '+$15,000/mes')",
      "priority": "alta" | "media" | "baja",
      "actionType": "campaña" | "recompensa" | "operativo" | "marketing"
    }
  ],
  "predictions": {
    "nextMonthRevenue": "string (rango ej: '$45,000-$55,000')",
    "churnRisk": "string (% socios en riesgo, ej: '12-18%')",
    "growthOpportunity": "string (% crecimiento posible, ej: '+15-25%')"
  },
  "topPriority": {
    "action": "string (acción más importante a tomar HOY)",
    "rationale": "string (por qué es prioridad #1)"
  }
}

Sé directo, concreto y orientado a la acción. Habla como un consultor experimentado.`;

async function handleAIInsights(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  const db = getPrisma();
  const tenantId = user.tenantId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    activeMemberships,
    totalMembers,
    newMembers,
    atRiskMembers,
    attendanceLast30,
    revenueThisMonth,
    revenueLastMonth,
    activeCampaigns,
    pointMovements,
    redemptions,
    avgPlan,
  ] = await Promise.all([
    db.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
    db.member.count({ where: { tenantId, isActive: true } }),
    db.member.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    db.member.count({ where: { tenantId, isActive: true, riskLevel: 'HIGH' } }),
    db.attendance.count({ where: { tenantId, timestamp: { gte: thirtyDaysAgo } } }),
    db.payment.aggregate({
      where: { tenantId, paymentDate: { gte: startOfMonth }, status: 'PAID', isVoided: false },
      _sum: { amount: true },
    }),
    db.payment.aggregate({
      where: {
        tenantId,
        paymentDate: { gte: startOfLastMonth, lte: endOfLastMonth },
        status: 'PAID',
        isVoided: false,
      },
      _sum: { amount: true },
    }),
    db.campaign.count({ where: { tenantId, status: { in: ['RUNNING', 'SCHEDULED'] } } }),
    db.pointMovement.count({ where: { tenantId, createdAt: { gte: thirtyDaysAgo } } }),
    db.redemption.count({ where: { tenantId, redeemedAt: { gte: thirtyDaysAgo } } }),
    db.plan.aggregate({ where: { tenantId, isArchived: false }, _avg: { price: true } }),
  ]);

  const metrics = {
    sociosActivos: totalMembers,
    membresiasActivas: activeMemberships,
    nuevosSocios30Dias: newMembers,
    sociosEnRiesgoAlto: atRiskMembers,
    asistencias30Dias: attendanceLast30,
    asistenciasPromedioPorSocio:
      totalMembers > 0 ? Math.round((attendanceLast30 / totalMembers) * 10) / 10 : 0,
    ingresosMesActual: Number(revenueThisMonth._sum.amount || 0),
    ingresosMesAnterior: Number(revenueLastMonth._sum.amount || 0),
    campanasActivas: activeCampaigns,
    movimientosPuntos30Dias: pointMovements,
    canjesRecompensas30Dias: redemptions,
    precioPromedioPlan: Number(avgPlan._avg.price || 0),
  };

  const userPrompt = `Analiza estas métricas del gimnasio y genera insights ejecutivos:\n\n${JSON.stringify(metrics, null, 2)}\n\nGenera la respuesta en formato JSON según el schema indicado.`;

  const insights = await callAI(AI_INSIGHTS_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.5,
    maxTokens: 2000,
    jsonMode: true,
  });

  return res.status(200).json({
    success: true,
    generatedAt: now.toISOString(),
    metrics,
    insights,
  });
}

const AI_CAMPAIGN_SYSTEM_PROMPT = `Eres un experto en marketing y fidelización de gimnasios. Tu tarea es ayudar a crear campañas de WhatsApp efectivas.

Cuando el usuario describa una campaña en lenguaje natural, debes responder con un objeto JSON con esta estructura exacta:

{
  "campaignName": "string (nombre corto y descriptivo, max 50 chars)",
  "objective": "string (descripción del objetivo, max 200 chars)",
  "campaignType": "REMINDER" | "BIRTHDAY" | "RENEWAL" | "PROMO" | "REFERRAL" | "NPS" | "CUSTOM",
  "segmentName": "string (nombre del segmento)",
  "segmentCriteria": {
    "lastAttendanceDaysAgo": number opcional (días sin asistir),
    "membershipStatus": "ACTIVE" | "EXPIRED" | "CANCELLED" opcional,
    "minAge": number opcional,
    "maxAge": number opcional,
    "riskLevel": "LOW" | "MEDIUM" | "HIGH" opcional,
    "tags": [array de strings] opcional
  },
  "messageVariants": [
    {
      "tone": "formal" | "casual" | "motivador" | "urgencia",
      "message": "string (mensaje WhatsApp con personalización {{firstName}}, max 300 chars)",
      "predictedConversion": "string (% estimado, ej: '18-25%')"
    }
  ],
  "bestSendTime": {
    "dayOfWeek": "Lunes" | "Martes" | "Miércoles" | "Jueves" | "Viernes" | "Sábado" | "Domingo",
    "hour": "string (ej: '10:00')",
    "reasoning": "string (por qué esta hora)"
  },
  "expectedResults": {
    "predictedReach": "string (rango ej: '40-60 socios')",
    "predictedConversion": "string (% ej: '25-35%')",
    "expectedRevenue": "string (estimación en MXN, ej: '$3,000-$5,000')"
  },
  "tips": ["array de 2-3 tips estratégicos cortos"]
}

IMPORTANTE:
- Usa siempre español mexicano natural
- Los mensajes deben ser cálidos pero profesionales
- Personaliza con {{firstName}} cuando sea apropiado
- Incluye 3 variantes de mensaje con tonos diferentes
- Las predicciones deben ser realistas (no exagerar)
- Los criterios deben ser implementables con los campos disponibles`;

async function handleAICampaignAssistant(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  const { description } = req.body || {};
  if (!description || description.trim().length < 10) {
    return res.status(400).json({ error: 'Describe la campaña con al menos 10 caracteres' });
  }

  const db = getPrisma();
  const tenantId = user.tenantId;

  const [totalMembers, activeMemberships, recentCampaigns] = await Promise.all([
    db.member.count({ where: { tenantId, isActive: true } }),
    db.membership.count({ where: { tenantId, status: 'ACTIVE' } }),
    db.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { name: true, type: true, status: true },
    }),
  ]);

  const userPrompt = `Contexto del gimnasio:
- Total socios activos: ${totalMembers}
- Membresías activas: ${activeMemberships}
- Campañas recientes: ${recentCampaigns.map((c) => `${c.name} (${c.type})`).join(', ') || 'ninguna'}

Petición del administrador:
"${description}"

Genera la propuesta de campaña en formato JSON.`;

  const result = await callAI(AI_CAMPAIGN_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.7,
    maxTokens: 2000,
    jsonMode: true,
  });

  return res.status(200).json({
    success: true,
    proposal: result,
    context: { totalMembers, activeMemberships },
  });
}

const AI_CHURN_SYSTEM_PROMPT = `Eres un analista de retención de gimnasios experto. Tu tarea es analizar perfiles de socios y predecir su riesgo de abandono.

Para cada socio, responde con un objeto JSON con esta estructura:

{
  "riskScore": number (0-100),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "topReasons": [array de 2-3 razones principales del riesgo, máximo 80 chars cada una],
  "recommendedActions": [
    {
      "action": "string (acción concreta, ej: 'Llamar para ofrecer 1 mes gratis')",
      "priority": "alta" | "media" | "baja",
      "expectedImpact": "string (impacto esperado, ej: 'Reduce riesgo 40%')"
    }
  ],
  "personalizedMessage": "string (mensaje WhatsApp personalizado de retención, max 250 chars)",
  "estimatedLifetimeValue": "string (valor proyectado si se retiene, ej: '$8,500 MXN/año')",
  "urgencyDays": number (días en los que actuar, 1-30)
}

Considera estos factores:
- Días desde última asistencia
- Frecuencia de asistencia vs promedio histórico
- Pagos pendientes
- Membresía próxima a vencer
- Tiempo como socio
- Patrón de canjes de recompensas
- Edad y antigüedad

Sé directo y específico. Las acciones deben ser ejecutables hoy mismo.`;

async function handleAIChurnAnalysis(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  const { memberId } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId requerido' });

  const db = getPrisma();
  const tenantId = user.tenantId;

  const member = await db.member.findFirst({
    where: { id: memberId, tenantId },
    include: {
      memberships: {
        orderBy: { startDate: 'desc' },
        take: 5,
        include: { plan: true },
      },
      attendances: {
        orderBy: { timestamp: 'desc' },
        take: 30,
        select: { timestamp: true, method: true },
      },
      pointMovements: { orderBy: { createdAt: 'desc' }, take: 10 },
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 5,
        include: { reward: { select: { name: true, pointsCost: true } } },
      },
    },
  });

  if (!member) return res.status(404).json({ error: 'Socio no encontrado' });

  const now = new Date();
  const lastAttendance = member.attendances[0]?.timestamp;
  const daysSinceLastAttendance = lastAttendance
    ? Math.floor((now.getTime() - new Date(lastAttendance).getTime()) / 86400000)
    : null;

  const last30Days = member.attendances.filter(
    (a) => new Date(a.timestamp).getTime() > now.getTime() - 30 * 86400000
  ).length;

  const activeMembership = member.memberships.find((m) => m.status === 'ACTIVE');
  const daysToExpiry = activeMembership
    ? Math.floor((new Date(activeMembership.endDate).getTime() - now.getTime()) / 86400000)
    : null;

  const ageYears = member.dateOfBirth
    ? Math.floor(
        (now.getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 86400000)
      )
    : null;

  const memberAgeDays = Math.floor(
    (now.getTime() - new Date(member.createdAt).getTime()) / 86400000
  );

  const profile = {
    nombre: `${member.firstName} ${member.lastName}`,
    edad: ageYears,
    diasComoSocio: memberAgeDays,
    diasSinAsistir: daysSinceLastAttendance,
    asistenciasUltimos30Dias: last30Days,
    totalAsistenciasHistoricas: member.attendances.length,
    membresiaActiva: activeMembership
      ? {
          plan: activeMembership.plan.name,
          precio: activeMembership.plan.price,
          duracionDias: activeMembership.plan.durationDays,
          diasRestantes: daysToExpiry,
        }
      : null,
    historialMembresias: member.memberships.length,
    saldoPuntos: member.pointsBalance,
    canjesRealizados: member.redemptions.length,
    ultimosCanjes: member.redemptions.map((r) => r.reward.name),
    esReferido: member.isReferred,
    consentimientoMarketing: member.marketingConsent,
    optOut: member.optOut,
  };

  const userPrompt = `Analiza este perfil de socio y predice su riesgo de abandono:\n\n${JSON.stringify(profile, null, 2)}\n\nGenera el análisis en formato JSON según el schema indicado.`;

  const analysis = await callAI(AI_CHURN_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.4,
    maxTokens: 1500,
    jsonMode: true,
  });

  if (analysis.riskScore !== undefined && analysis.riskLevel) {
    const validLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(analysis.riskLevel)
      ? analysis.riskLevel
      : analysis.riskLevel === 'CRITICAL'
      ? 'HIGH'
      : 'LOW';

    await db.member.update({
      where: { id: memberId },
      data: {
        riskScore: Math.min(100, Math.max(0, analysis.riskScore)),
        riskLevel: validLevel,
        riskScoreDate: new Date(),
      },
    });
  }

  return res.status(200).json({
    success: true,
    member: {
      id: member.id,
      name: profile.nombre,
      currentRiskScore: member.riskScore,
      currentRiskLevel: member.riskLevel,
    },
    analysis,
    profile,
  });
}

const AI_REWARD_SYSTEM_PROMPT = `Eres un experto en programas de fidelización de gimnasios. Tu tarea es recomendar recompensas personalizadas para cada socio basándote en su comportamiento y perfil.

Responde con un objeto JSON con esta estructura:

{
  "recommendations": [
    {
      "rewardName": "string (nombre de la recompensa, max 80 chars)",
      "pointsCost": number (entre 50 y 1000),
      "category": "experiencia" | "descuento" | "producto" | "exclusivo",
      "matchScore": number (0-100, qué tan bien encaja con el socio),
      "reasoning": "string (por qué esta recompensa, max 150 chars)",
      "expectedEngagement": "string (impacto esperado, ej: 'Aumenta visitas 20%')"
    }
  ],
  "memberInsights": {
    "profile": "string (resumen del socio, max 200 chars)",
    "preferredActivities": [array de strings],
    "engagementLevel": "alto" | "medio" | "bajo",
    "loyaltyStage": "nuevo" | "establecido" | "leal" | "embajador"
  },
  "personalizedOffer": {
    "title": "string (oferta especial, max 60 chars)",
    "message": "string (mensaje WhatsApp con la oferta, max 250 chars, usar {{firstName}})",
    "validityDays": number (días de vigencia, 7-30)
  }
}

IMPORTANTE:
- Genera 4-6 recomendaciones diversas en categoría
- Las recompensas deben tener costo proporcional al saldo del socio
- Personalizar según género (si es inferible del nombre), edad, patrón de visitas
- El mensaje de oferta debe ser cálido y específico
- Considera la etapa de fidelización del socio`;

async function handleAIRewardRecommendations(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({
      error: 'IA no configurada',
      hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel',
    });
  }

  const { memberId } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId requerido' });

  const db = getPrisma();
  const tenantId = user.tenantId;

  const member = await db.member.findFirst({
    where: { id: memberId, tenantId },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        include: { plan: true },
        take: 1,
      },
      attendances: { orderBy: { timestamp: 'desc' }, take: 30 },
      redemptions: {
        orderBy: { redeemedAt: 'desc' },
        take: 5,
        include: { reward: true },
      },
      pointMovements: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });

  if (!member) return res.status(404).json({ error: 'Socio no encontrado' });

  const availableRewards = await db.reward.findMany({
    where: { tenantId, isActive: true },
    orderBy: { pointsCost: 'asc' },
  });

  const now = new Date();
  const ageYears = member.dateOfBirth
    ? Math.floor(
        (now.getTime() - new Date(member.dateOfBirth).getTime()) / (365.25 * 86400000)
      )
    : null;

  const attendanceHours = member.attendances.map((a) => new Date(a.timestamp).getHours());
  const avgHour =
    attendanceHours.length > 0
      ? Math.round(attendanceHours.reduce((a, b) => a + b, 0) / attendanceHours.length)
      : null;

  const attendanceDays = member.attendances.map((a) => {
    const day = new Date(a.timestamp).getDay();
    return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day];
  });

  const profile = {
    nombre: member.firstName,
    edad: ageYears,
    saldoPuntos: member.pointsBalance,
    asistenciasRecientes: member.attendances.length,
    horarioPreferido: avgHour ? `~${avgHour}:00 hrs` : 'desconocido',
    diasMasFrecuentes: [...new Set(attendanceDays)].slice(0, 3),
    planActual: member.memberships[0]?.plan.name,
    diasComoSocio: Math.floor(
      (now.getTime() - new Date(member.createdAt).getTime()) / 86400000
    ),
    canjesAnteriores: member.redemptions.map((r) => ({
      recompensa: r.reward.name,
      costoPuntos: r.pointsSpent,
    })),
  };

  const userPrompt = `Genera recomendaciones de recompensas para este socio:\n\n${JSON.stringify(profile, null, 2)}\n\nRecompensas disponibles actualmente en el gimnasio:\n${availableRewards.map((r) => `- ${r.name} (${r.pointsCost} pts, stock: ${r.stock ?? 'ilimitado'})`).join('\n') || 'ninguna'}\n\nGenera la respuesta en formato JSON según el schema indicado. Las recomendaciones pueden ser nuevas (no necesariamente de las disponibles).`;

  const recommendations = await callAI(AI_REWARD_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.8,
    maxTokens: 2000,
    jsonMode: true,
  });

  return res.status(200).json({
    success: true,
    member: {
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      pointsBalance: member.pointsBalance,
    },
    ...recommendations,
  });
}

// ---------------------------------------------------------------------------
// Main router — single Vercel export
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  setCors(res);

  // Handle CORS preflight for all routes
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Determine the path: strip leading /api prefix if present
  const rawPath = req.url ? req.url.split('?')[0] : '';
  const path = rawPath.replace(/^\/api/, '').replace(/\/$/, '') || '/';

  try {
    // Health
    if (path === '/health') return await handleHealth(req, res);

    // Auth
    if (path === '/auth/login') return await handleAuthLogin(req, res);

    // Dashboard
    if (path === '/dashboard') return await handleDashboard(req, res);

    // Members
    if (path === '/members' || path.startsWith('/members/')) return await handleMembers(req, res);

    // Plans
    if (path === '/plans' || path.startsWith('/plans/')) return await handlePlans(req, res);

    // Attendances
    if (path === '/attendances' || path.startsWith('/attendances/'))
      return await handleAttendances(req, res);

    // Campaigns
    if (path === '/campaigns' || path.startsWith('/campaigns/'))
      return await handleCampaigns(req, res);

    // Segments
    if (path === '/segments' || path.startsWith('/segments/'))
      return await handleSegments(req, res);

    // Payments
    if (path === '/payments' || path.startsWith('/payments/'))
      return await handlePayments(req, res);

    // Rewards
    if (path === '/rewards' || path.startsWith('/rewards/')) return await handleRewards(req, res);

    // Alerts
    if (path === '/alerts' || path.startsWith('/alerts/')) return await handleAlerts(req, res);

    // AI routes
    if (path === '/ai/insights') return await handleAIInsights(req, res);
    if (path === '/ai/campaign-assistant') return await handleAICampaignAssistant(req, res);
    if (path === '/ai/churn-analysis') return await handleAIChurnAnalysis(req, res);
    if (path === '/ai/reward-recommendations')
      return await handleAIRewardRecommendations(req, res);

    // 404 fallback
    return res.status(404).json({ error: 'Ruta no encontrada', path });
  } catch (err) {
    console.error(`API error [${path}]:`, err);
    return res.status(500).json({ error: 'Error interno del servidor', message: err?.message });
  }
}
