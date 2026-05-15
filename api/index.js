// =============================================================================
// api/index.js — Single Vercel serverless function handling all API routes
// Uses @supabase/supabase-js instead of Prisma + JWT
// =============================================================================

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// AI config
const AI_API_KEY = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';
const AI_PROVIDER = AI_API_KEY.startsWith('gsk_') ? 'groq' : (process.env.AI_PROVIDER || 'openai');

// Demo mode: when SUPABASE_URL is not configured
const IS_DEMO_MODE = !SUPABASE_URL;

// ---------------------------------------------------------------------------
// Supabase singleton (service-level client using anon key)
// ---------------------------------------------------------------------------
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
async function getUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  // Demo token
  if (token === 'demo-token-gymfideliza') {
    return {
      id: 'demo-user-001',
      email: 'demo@gymfideliza.com',
      tenantId: 'demo-tenant-001',
      role: 'OWNER',
      tenantName: 'GymFit Demo',
      isDemo: true,
    };
  }

  // Admin token (works with seeded tenant)
  if (token === 'admin-token-gymfideliza') {
    return {
      id: 'admin-user-001',
      email: 'admin@gymfit.com',
      tenantId: '00000000-0000-0000-0000-000000000001',
      role: 'OWNER',
      tenantName: 'GymFit Centro',
    };
  }

  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    // Get tenant info from UserTenant table
    const { data: ut } = await supabase
      .from('UserTenant')
      .select('tenantId, role, Tenant(name)')
      .eq('userId', user.id)
      .single();

    return {
      ...user,
      tenantId: ut?.tenantId ?? '00000000-0000-0000-0000-000000000001',
      role: ut?.role ?? 'OWNER',
      tenantName: ut?.Tenant?.name ?? 'GymFit Centro',
    };
  } catch {
    return null;
  }
}

async function requireAuth(req, res) {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }
  return user;
}

async function requireRole(req, res, allowedRoles) {
  const user = await requireAuth(req, res);
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
    throw new Error('AI no configurada. Configura GROQ_API_KEY en Vercel.');
  }
  const { temperature = 0.7, maxTokens = 1500, jsonMode = true } = options;
  if (AI_PROVIDER === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
  }
  // Groq uses OpenAI-compatible API
  const baseUrl = AI_PROVIDER === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  return callOpenAICompatible(baseUrl, systemPrompt, userPrompt, { temperature, maxTokens, jsonMode });
}

async function callOpenAICompatible(baseUrl, systemPrompt, userPrompt, opts) {
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

  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI error ${response.status}: ${errorText}`);
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
// Demo data
// ---------------------------------------------------------------------------
const DEMO_MEMBERS = [
  { id: 'member-001', firstName: 'María', lastName: 'González', phone: '+5215512345678', email: 'maria@email.com', isActive: true, pointsBalance: 150, riskLevel: 'LOW', createdAt: new Date('2024-01-15').toISOString(), memberships: [{ status: 'ACTIVE', plan: { name: 'Mensual Premium', price: 899, currency: 'MXN' } }] },
  { id: 'member-002', firstName: 'Carlos', lastName: 'Hernández', phone: '+5215587654321', email: 'carlos@email.com', isActive: true, pointsBalance: 320, riskLevel: 'MEDIUM', createdAt: new Date('2024-02-10').toISOString(), memberships: [{ status: 'ACTIVE', plan: { name: 'Trimestral', price: 2299, currency: 'MXN' } }] },
  { id: 'member-003', firstName: 'Ana', lastName: 'López', phone: '+5215511223344', email: 'ana@email.com', isActive: true, pointsBalance: 80, riskLevel: 'LOW', createdAt: new Date('2024-03-05').toISOString(), memberships: [{ status: 'ACTIVE', plan: { name: 'Mensual Básico', price: 599, currency: 'MXN' } }] },
  { id: 'member-004', firstName: 'Roberto', lastName: 'Martínez', phone: '+5215599887766', email: 'roberto@email.com', isActive: true, pointsBalance: 0, riskLevel: null, createdAt: new Date('2024-04-20').toISOString(), memberships: [] },
  { id: 'member-005', firstName: 'Laura', lastName: 'Ramírez', phone: '+5215544556677', email: 'laura@email.com', isActive: true, pointsBalance: 500, riskLevel: 'HIGH', createdAt: new Date('2024-01-01').toISOString(), memberships: [{ status: 'ACTIVE', plan: { name: 'Anual VIP', price: 7999, currency: 'MXN' } }] },
];

const DEMO_PLANS = [
  { id: 'plan-001', name: 'Mensual Básico', description: 'Acceso de lunes a viernes', durationDays: 30, price: 599, currency: 'MXN', isArchived: false, membershipCount: 1 },
  { id: 'plan-002', name: 'Mensual Premium', description: 'Acceso completo + clases grupales', durationDays: 30, price: 899, currency: 'MXN', isArchived: false, membershipCount: 2 },
  { id: 'plan-003', name: 'Trimestral', description: 'Acceso completo por 3 meses', durationDays: 90, price: 2299, currency: 'MXN', isArchived: false, membershipCount: 1 },
  { id: 'plan-004', name: 'Anual VIP', description: 'Acceso ilimitado + clases + nutriólogo', durationDays: 365, price: 7999, currency: 'MXN', isArchived: false, membershipCount: 1 },
];

const DEMO_CAMPAIGNS = [
  { id: 'camp-001', name: 'Reactivación Socios Inactivos', objective: 'Recuperar socios que no han venido en 2 semanas', type: 'REMINDER', status: 'DRAFT', templateName: 'reactivacion_v1', frequency: 'ONCE', startAt: new Date().toISOString(), createdAt: new Date().toISOString(), segment: { id: 'seg-001', name: 'Inactivos 14+ días' }, executionCount: 0 },
  { id: 'camp-002', name: 'Felicitación de Cumpleaños', objective: 'Enviar saludo y beneficio en cumpleaños', type: 'BIRTHDAY', status: 'RUNNING', templateName: 'cumpleanos_v1', frequency: 'DAILY', startAt: new Date().toISOString(), createdAt: new Date().toISOString(), segment: null, executionCount: 3 },
];

const DEMO_SEGMENTS = [
  { id: 'seg-001', name: 'Inactivos 14+ días', criteria: { lastAttendanceDaysAgo: 14, membershipStatus: 'ACTIVE' }, createdAt: new Date().toISOString(), campaignCount: 1 },
  { id: 'seg-002', name: 'Socios en riesgo alto', criteria: { riskLevel: 'HIGH' }, createdAt: new Date().toISOString(), campaignCount: 0 },
];

const DEMO_PAYMENTS = [
  { id: 'pay-001', memberId: 'member-001', amount: 899, currency: 'MXN', status: 'PAID', paymentDate: new Date('2024-04-01').toISOString(), member: { firstName: 'María', lastName: 'González' } },
  { id: 'pay-002', memberId: 'member-002', amount: 2299, currency: 'MXN', status: 'PAID', paymentDate: new Date('2024-03-15').toISOString(), member: { firstName: 'Carlos', lastName: 'Hernández' } },
];

const DEMO_REWARDS = [
  { id: 'rew-001', name: 'Botella de agua personalizada', description: 'Botella de 1L con logo del gym', pointsCost: 200, stock: 10, isActive: true, createdAt: new Date().toISOString() },
  { id: 'rew-002', name: '1 mes gratis', description: 'Un mes de membresía sin costo', pointsCost: 1000, stock: null, isActive: true, createdAt: new Date().toISOString() },
  { id: 'rew-003', name: 'Clase de yoga gratis', description: 'Acceso a una clase especial', pointsCost: 150, stock: 5, isActive: true, createdAt: new Date().toISOString() },
];

const DEMO_ALERTS = [
  { id: 'alert-001', type: 'MEMBERSHIP_EXPIRING', message: 'Laura Ramírez tiene su membresía por vencer en 3 días', severity: 'HIGH', isRead: false, createdAt: new Date().toISOString() },
  { id: 'alert-002', type: 'CHURN_RISK', message: 'Carlos Hernández no ha asistido en 14 días', severity: 'MEDIUM', isRead: false, createdAt: new Date().toISOString() },
  { id: 'alert-003', type: 'PAYMENT_OVERDUE', message: 'Roberto Martínez tiene un pago pendiente', severity: 'HIGH', isRead: true, createdAt: new Date().toISOString() },
];

const DEMO_DASHBOARD = {
  members: { total: 5, active: 3, new: 2, newPreviousPeriod: 1, atRisk: 1 },
  retention: { rate: 80, churnRate: 20, churnCount: 1 },
  attendance: { today: 4, last30Days: 87, avgPerMember: 5.8 },
  revenue: { currentMonth: 8500, lastMonth: 7200, projected: 12000, currency: 'MXN' },
};

// ---------------------------------------------------------------------------
// Route: GET /api/health
// ---------------------------------------------------------------------------
async function handleHealth(req, res) {
  const envInfo = {};
  const relevantKeys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'AI_PROVIDER', 'GROQ_API_KEY'];
  for (const key of relevantKeys) {
    const value = process.env[key];
    if (!value) {
      envInfo[key] = '(empty)';
    } else if (value.length > 50) {
      envInfo[key] = value.substring(0, 20) + '...(' + value.length + ' chars)';
    } else {
      envInfo[key] = value;
    }
  }

  let dbStatus = { connected: false };
  if (IS_DEMO_MODE) {
    dbStatus = { connected: false, mode: 'demo', message: 'SUPABASE_URL not configured — running in demo mode' };
  } else {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.from('Tenant').select('id').limit(1);
      if (error) throw error;
      dbStatus = { connected: true, tenantRowsFound: data?.length ?? 0 };
    } catch (err) {
      dbStatus = { connected: false, error: err.message };
    }
  }

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: IS_DEMO_MODE ? 'demo' : 'production',
    relevantEnvVars: envInfo,
    database: dbStatus,
    node: process.version,
  });
}

// ---------------------------------------------------------------------------
// Route: POST /api/auth/login
// ---------------------------------------------------------------------------
async function handleAuthLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
  }

  // Demo credentials work always (no DB needed)
  if (
    email.toLowerCase() === 'demo@gymfideliza.com' &&
    password === 'Demo2026!'
  ) {
    return res.status(200).json({
      access_token: 'demo-token-gymfideliza',
      token_type: 'bearer',
      user: { id: 'demo-user-001', email: 'demo@gymfideliza.com' },
      tenants: [{ id: 'demo-tenant-001', name: 'GymFit Demo', role: 'OWNER' }],
      currentTenant: { id: 'demo-tenant-001', name: 'GymFit Demo', role: 'OWNER' },
      isDemo: true,
    });
  }

  // Admin credentials work with the seeded tenant (no Supabase Auth needed)
  if (
    email.toLowerCase() === 'admin@gymfit.com' &&
    password === 'Admin123!@#'
  ) {
    return res.status(200).json({
      access_token: 'admin-token-gymfideliza',
      token_type: 'bearer',
      user: { id: 'admin-user-001', email: 'admin@gymfit.com' },
      tenants: [{ id: '00000000-0000-0000-0000-000000000001', name: 'GymFit Centro', role: 'OWNER' }],
      currentTenant: { id: '00000000-0000-0000-0000-000000000001', name: 'GymFit Centro', role: 'OWNER' },
    });
  }

  // Demo mode if no Supabase configured
  if (IS_DEMO_MODE) {
    return res.status(401).json({
      error: 'Credenciales inválidas',
      hint: 'Usa demo@gymfideliza.com / Demo2026! o admin@gymfit.com / Admin123!@#',
    });
  }

  // Production: try Supabase Auth (optional)
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      return res.status(401).json({
        error: 'Credenciales inválidas',
        hint: 'Usa demo@gymfideliza.com / Demo2026! o admin@gymfit.com / Admin123!@#',
      });
    }

    const { session, user } = data;

    const { data: userTenants } = await supabase
      .from('UserTenant')
      .select('tenantId, role, Tenant(id, name)')
      .eq('userId', user.id);

    if (!userTenants || userTenants.length === 0) {
      // User exists in Auth but not linked to tenant - link to default
      return res.status(200).json({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: 'bearer',
        user: { id: user.id, email: user.email },
        tenants: [{ id: '00000000-0000-0000-0000-000000000001', name: 'GymFit Centro', role: 'OWNER' }],
        currentTenant: { id: '00000000-0000-0000-0000-000000000001', name: 'GymFit Centro', role: 'OWNER' },
      });
    }

    const currentTenant = userTenants[0];

    return res.status(200).json({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      user: { id: user.id, email: user.email },
      tenants: userTenants.map((ut) => ({
        id: ut.Tenant?.id ?? ut.tenantId,
        name: ut.Tenant?.name ?? '',
        role: ut.role,
      })),
      currentTenant: {
        id: currentTenant.Tenant?.id ?? currentTenant.tenantId,
        name: currentTenant.Tenant?.name ?? '',
        role: currentTenant.role,
      },
    });
  } catch (err) {
    return res.status(401).json({
      error: 'Credenciales inválidas',
      hint: 'Usa demo@gymfideliza.com / Demo2026! o admin@gymfit.com / Admin123!@#',
    });
  }
}

// ---------------------------------------------------------------------------
// Route: GET /api/dashboard
// ---------------------------------------------------------------------------
async function handleDashboard(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    return res.status(200).json({ ...DEMO_DASHBOARD, generatedAt: new Date().toISOString() });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

  const [
    { count: totalMembers },
    { count: newMembers },
    { count: newMembersPrev },
    { count: atRiskMembers },
    { count: attendanceLast30 },
    { count: attendanceToday },
    { data: activeMemberships },
    { data: revenueThisMonthRows },
    { data: revenueLastMonthRows },
  ] = await Promise.all([
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('isActive', true),
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).gte('createdAt', thirtyDaysAgo),
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).gte('createdAt', sixtyDaysAgo).lt('createdAt', thirtyDaysAgo),
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('isActive', true).eq('riskLevel', 'HIGH'),
    supabase.from('Attendance').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).gte('timestamp', thirtyDaysAgo),
    supabase.from('Attendance').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).gte('timestamp', startOfToday),
    supabase.from('Membership').select('memberId').eq('tenantId', tenantId).eq('status', 'ACTIVE').gte('endDate', now.toISOString()),
    supabase.from('Payment').select('amount').eq('tenantId', tenantId).gte('paymentDate', startOfMonth).eq('status', 'PAID').eq('isVoided', false),
    supabase.from('Payment').select('amount').eq('tenantId', tenantId).gte('paymentDate', startOfLastMonth).lte('paymentDate', endOfLastMonth).eq('status', 'PAID').eq('isVoided', false),
  ]);

  const uniqueActiveMembers = new Set((activeMemberships || []).map((m) => m.memberId)).size;
  const currentRevenue = (revenueThisMonthRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const lastMonthRev = (revenueLastMonthRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedRevenue = dayOfMonth > 0 ? Math.round((currentRevenue / dayOfMonth) * daysInMonth * 100) / 100 : 0;
  const avgPerMember = uniqueActiveMembers > 0 ? Math.round(((attendanceLast30 || 0) / uniqueActiveMembers) * 10) / 10 : 0;

  return res.status(200).json({
    members: {
      total: totalMembers || 0,
      active: uniqueActiveMembers,
      new: newMembers || 0,
      newPreviousPeriod: newMembersPrev || 0,
      atRisk: atRiskMembers || 0,
    },
    retention: { rate: 0, churnRate: 0, churnCount: 0 },
    attendance: {
      today: attendanceToday || 0,
      last30Days: attendanceLast30 || 0,
      avgPerMember,
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

// ---------------------------------------------------------------------------
// Route: GET/POST /api/members
// ---------------------------------------------------------------------------
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

async function handleMembers(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') {
      return res.status(200).json({ data: DEMO_MEMBERS, pagination: { total: DEMO_MEMBERS.length, page: 1, limit: 20, totalPages: 1 } });
    }
    if (req.method === 'POST') {
      const { firstName, lastName, phone } = req.body || {};
      if (!firstName || !lastName || !phone) return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
      return res.status(201).json({ id: `member-${Date.now()}`, firstName, lastName, phone, isActive: true, pointsBalance: 0, createdAt: new Date().toISOString(), memberships: [] });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { search = '', page = '1', limit = '20', active } = req.query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('Member')
      .select('*, Membership(status, Plan(name, price, currency))', { count: 'exact' })
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false })
      .range(from, to);

    if (active !== undefined) query = query.eq('isActive', active === 'true');
    if (search && search.trim()) {
      const term = search.trim();
      query = query.or(`firstName.ilike.%${term}%,lastName.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
    }

    const { data: members, count, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      data: members || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  }

  if (req.method === 'POST') {
    const adminUser = await requireRole(req, res, ['OWNER', 'ADMIN']);
    if (!adminUser) return;

    const { firstName, lastName, phone, email, dateOfBirth, marketingConsent } = req.body || {};
    if (!firstName || !lastName || !phone) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    // Check for duplicate phone within tenant
    const { data: existing } = await supabase
      .from('Member')
      .select('id')
      .eq('tenantId', tenantId)
      .eq('phone', phone)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: 'Ya existe un socio con este teléfono' });

    const { data: member, error } = await supabase
      .from('Member')
      .insert({
        tenantId,
        firstName,
        lastName,
        phone,
        email: email || null,
        dateOfBirth: dateOfBirth || null,
        marketingConsent: !!marketingConsent,
        marketingConsentDate: marketingConsent ? new Date().toISOString() : null,
        marketingConsentChannel: marketingConsent ? 'REGISTRATION' : null,
        referralCode: generateReferralCode(),
        isActive: true,
        pointsBalance: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(member);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/plans
// ---------------------------------------------------------------------------
async function handlePlans(req, res) {
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: DEMO_PLANS });
    if (req.method === 'POST') {
      const { name, durationDays, price, currency = 'MXN' } = req.body || {};
      if (!name || !durationDays || price === undefined) return res.status(400).json({ error: 'Faltan campos requeridos' });
      return res.status(201).json({ id: `plan-${Date.now()}`, name, durationDays: parseInt(durationDays), price: parseFloat(price), currency, isArchived: false });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { data: plans, error } = await supabase
      .from('Plan')
      .select('*, Membership(id)')
      .eq('tenantId', tenantId)
      .eq('isArchived', false)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    // Attach active membership count
    const enriched = (plans || []).map((p) => ({
      ...p,
      membershipCount: (p.Membership || []).length,
      Membership: undefined,
    }));

    return res.status(200).json({ data: enriched });
  }

  if (req.method === 'POST') {
    const { name, description, durationDays, price, currency = 'MXN' } = req.body || {};
    if (!name || !durationDays || price === undefined) {
      return res.status(400).json({ error: 'Nombre, duración y precio son requeridos' });
    }

    const { data: plan, error } = await supabase
      .from('Plan')
      .insert({
        tenantId,
        name,
        description: description || null,
        durationDays: parseInt(durationDays),
        price: parseFloat(price),
        currency,
        isArchived: false,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(plan);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/attendances
// ---------------------------------------------------------------------------
async function handleAttendances(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: [] });
    if (req.method === 'POST') {
      const { memberId } = req.body || {};
      const member = DEMO_MEMBERS.find((m) => m.id === memberId) || DEMO_MEMBERS[0];
      return res.status(201).json({ id: `att-${Date.now()}`, memberId: member.id, timestamp: new Date().toISOString(), method: 'MANUAL', member: { firstName: member.firstName, lastName: member.lastName } });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'POST') {
    const { memberId, qrCode } = req.body || {};

    let memberQuery = supabase.from('Member').select('id, firstName, lastName').eq('tenantId', tenantId).eq('isActive', true);
    if (memberId) memberQuery = memberQuery.eq('id', memberId);
    else if (qrCode) memberQuery = memberQuery.eq('qrCode', qrCode);
    else return res.status(400).json({ error: 'memberId o qrCode requerido' });

    const { data: member } = await memberQuery.maybeSingle();
    if (!member) return res.status(404).json({ error: 'Socio no encontrado o inactivo' });

    // Get attendance window from tenant settings (default 30 min)
    const { data: tenant } = await supabase.from('Tenant').select('attendanceWindowMinutes').eq('id', tenantId).maybeSingle();
    const windowMinutes = tenant?.attendanceWindowMinutes || 30;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    const { data: recent } = await supabase
      .from('Attendance')
      .select('id')
      .eq('tenantId', tenantId)
      .eq('memberId', member.id)
      .gte('timestamp', windowStart)
      .maybeSingle();

    if (recent) {
      return res.status(409).json({ error: `Ya se registró asistencia en los últimos ${windowMinutes} minutos` });
    }

    const { data: attendance, error } = await supabase
      .from('Attendance')
      .insert({
        tenantId,
        memberId: member.id,
        timestamp: new Date().toISOString(),
        method: qrCode ? 'QR' : 'MANUAL',
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ ...attendance, member: { firstName: member.firstName, lastName: member.lastName } });
  }

  if (req.method === 'GET') {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { data: attendances, error } = await supabase
      .from('Attendance')
      .select('*, Member(firstName, lastName)')
      .eq('tenantId', tenantId)
      .gte('timestamp', startOfToday.toISOString())
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) throw error;
    return res.status(200).json({ data: attendances || [] });
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/campaigns
// ---------------------------------------------------------------------------
async function handleCampaigns(req, res) {
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: DEMO_CAMPAIGNS, pagination: { total: DEMO_CAMPAIGNS.length } });
    if (req.method === 'POST') {
      const { name, objective, type, templateName, frequency, startAt } = req.body || {};
      if (!name || !type) return res.status(400).json({ error: 'Faltan campos requeridos' });
      return res.status(201).json({ id: `camp-${Date.now()}`, name, objective, type, templateName, frequency, startAt, status: 'DRAFT', createdAt: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { data: campaigns, error } = await supabase
      .from('Campaign')
      .select('*, Segment(id, name), CampaignExecution(id)')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const enriched = (campaigns || []).map((c) => ({
      ...c,
      segment: c.Segment || null,
      executionCount: (c.CampaignExecution || []).length,
      Segment: undefined,
      CampaignExecution: undefined,
    }));

    return res.status(200).json({ data: enriched, pagination: { total: enriched.length } });
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

    const { data: campaign, error } = await supabase
      .from('Campaign')
      .insert({
        tenantId,
        name,
        objective,
        type,
        segmentId: segmentId || null,
        templateName,
        templateLanguage,
        frequency,
        startAt,
        endAt: endAt || null,
        attributionDays: parseInt(attributionDays),
        config: config || null,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(campaign);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/segments
// ---------------------------------------------------------------------------
async function handleSegments(req, res) {
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: DEMO_SEGMENTS });
    if (req.method === 'POST') {
      const { name, criteria } = req.body || {};
      if (!name) return res.status(400).json({ error: 'Nombre requerido' });
      return res.status(201).json({ id: `seg-${Date.now()}`, name, criteria: criteria || {}, createdAt: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { data: segments, error } = await supabase
      .from('Segment')
      .select('*, Campaign(id)')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    const enriched = (segments || []).map((s) => ({
      ...s,
      campaignCount: (s.Campaign || []).length,
      Campaign: undefined,
    }));

    return res.status(200).json({ data: enriched });
  }

  if (req.method === 'POST') {
    const { name, criteria } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });

    const { data: segment, error } = await supabase
      .from('Segment')
      .insert({ tenantId, name, criteria: criteria || {} })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(segment);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/payments
// ---------------------------------------------------------------------------
async function handlePayments(req, res) {
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: DEMO_PAYMENTS, pagination: { total: DEMO_PAYMENTS.length } });
    if (req.method === 'POST') {
      const { memberId, amount, currency = 'MXN' } = req.body || {};
      if (!memberId || amount === undefined) return res.status(400).json({ error: 'memberId y amount son requeridos' });
      return res.status(201).json({ id: `pay-${Date.now()}`, memberId, amount: parseFloat(amount), currency, status: 'PAID', paymentDate: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { page = '1', limit = '20', memberId } = req.query || {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('Payment')
      .select('*, Member(firstName, lastName)', { count: 'exact' })
      .eq('tenantId', tenantId)
      .order('paymentDate', { ascending: false })
      .range(from, to);

    if (memberId) query = query.eq('memberId', memberId);

    const { data: payments, count, error } = await query;
    if (error) throw error;

    return res.status(200).json({
      data: payments || [],
      pagination: {
        total: count || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((count || 0) / limitNum),
      },
    });
  }

  if (req.method === 'POST') {
    const { memberId, membershipId, amount, currency = 'MXN', paymentMethod, notes } = req.body || {};
    if (!memberId || amount === undefined) {
      return res.status(400).json({ error: 'memberId y amount son requeridos' });
    }

    const { data: payment, error } = await supabase
      .from('Payment')
      .insert({
        tenantId,
        memberId,
        membershipId: membershipId || null,
        amount: parseFloat(amount),
        currency,
        paymentMethod: paymentMethod || 'CASH',
        notes: notes || null,
        status: 'PAID',
        paymentDate: new Date().toISOString(),
        isVoided: false,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(payment);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET/POST /api/rewards
// ---------------------------------------------------------------------------
async function handleRewards(req, res) {
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    if (req.method === 'GET') return res.status(200).json({ data: DEMO_REWARDS });
    if (req.method === 'POST') {
      const { name, description, pointsCost, stock } = req.body || {};
      if (!name || pointsCost === undefined) return res.status(400).json({ error: 'Nombre y costo en puntos son requeridos' });
      return res.status(201).json({ id: `rew-${Date.now()}`, name, description, pointsCost: parseInt(pointsCost), stock: stock ?? null, isActive: true, createdAt: new Date().toISOString() });
    }
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  if (req.method === 'GET') {
    const { data: rewards, error } = await supabase
      .from('Reward')
      .select('*')
      .eq('tenantId', tenantId)
      .order('createdAt', { ascending: false });

    if (error) throw error;
    return res.status(200).json({ data: rewards || [] });
  }

  if (req.method === 'POST') {
    const { name, description, pointsCost, stock, imageUrl } = req.body || {};
    if (!name || pointsCost === undefined) {
      return res.status(400).json({ error: 'Nombre y costo en puntos son requeridos' });
    }

    const { data: reward, error } = await supabase
      .from('Reward')
      .insert({
        tenantId,
        name,
        description: description || null,
        pointsCost: parseInt(pointsCost),
        stock: stock !== undefined ? parseInt(stock) : null,
        imageUrl: imageUrl || null,
        isActive: true,
      })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json(reward);
  }

  return res.status(405).json({ error: 'Método no permitido' });
}

// ---------------------------------------------------------------------------
// Route: GET /api/alerts
// ---------------------------------------------------------------------------
async function handleAlerts(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (IS_DEMO_MODE || user.isDemo) {
    return res.status(200).json({ data: DEMO_ALERTS, unreadCount: DEMO_ALERTS.filter((a) => !a.isRead).length });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  const { data: alerts, error } = await supabase
    .from('Alert')
    .select('*')
    .eq('tenantId', tenantId)
    .order('createdAt', { ascending: false })
    .limit(50);

  if (error) throw error;

  const unreadCount = (alerts || []).filter((a) => !a.isRead).length;
  return res.status(200).json({ data: alerts || [], unreadCount });
}

// ---------------------------------------------------------------------------
// AI Routes
// ---------------------------------------------------------------------------

// --- GET /api/ai/insights ---
const DEMO_AI_INSIGHTS = {
  summary: 'Tu gimnasio tiene un buen desempeño general. La retención está en 80% y los ingresos crecieron 18% respecto al mes anterior.',
  insights: [
    { type: 'retention', title: 'Retención estable', description: 'El 80% de los socios renuevan su membresía. El promedio del sector es 72%.', impact: 'positive', priority: 1 },
    { type: 'attendance', title: 'Asistencia en descenso los lunes', description: 'Los lunes tienen 35% menos asistencia que el promedio semanal. Considera una promoción especial.', impact: 'warning', priority: 2 },
    { type: 'revenue', title: 'Oportunidad de upsell', description: '3 socios del plan Básico asisten más de 20 veces al mes. Son candidatos ideales para el plan Premium.', impact: 'opportunity', priority: 3 },
    { type: 'churn', title: 'Socios en riesgo', description: '1 socio no ha asistido en más de 14 días y tiene membresía activa. Acción recomendada: mensaje de reactivación.', impact: 'negative', priority: 4 },
  ],
  recommendations: [
    'Lanza una campaña de reactivación para socios inactivos esta semana',
    'Ofrece upgrade al plan Premium a los socios de alto uso',
    'Implementa una clase especial los lunes para aumentar asistencia',
  ],
  generatedAt: new Date().toISOString(),
  isDemo: true,
};

async function handleAIInsights(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(200).json({ ...DEMO_AI_INSIGHTS, generatedAt: new Date().toISOString() });
  }

  if (IS_DEMO_MODE || user.isDemo) {
    return res.status(200).json({ ...DEMO_AI_INSIGHTS, generatedAt: new Date().toISOString() });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalMembers },
    { count: activeMembers },
    { count: atRiskMembers },
    { count: attendanceLast30 },
    { data: revenueRows },
  ] = await Promise.all([
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId),
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('isActive', true),
    supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('riskLevel', 'HIGH'),
    supabase.from('Attendance').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).gte('timestamp', thirtyDaysAgo),
    supabase.from('Payment').select('amount').eq('tenantId', tenantId).gte('paymentDate', thirtyDaysAgo).eq('status', 'PAID').eq('isVoided', false),
  ]);

  const totalRevenue = (revenueRows || []).reduce((s, r) => s + Number(r.amount || 0), 0);

  const systemPrompt = `Eres un analista experto en gimnasios y programas de fidelización. Analiza los datos del gimnasio y genera insights accionables en español mexicano. Responde con un objeto JSON con esta estructura exacta:
{
  "summary": "string (resumen ejecutivo de 2-3 oraciones)",
  "insights": [
    {
      "type": "retention|attendance|revenue|churn|opportunity",
      "title": "string (max 60 chars)",
      "description": "string (max 200 chars)",
      "impact": "positive|negative|warning|opportunity",
      "priority": number (1-5, 1=más urgente)
    }
  ],
  "recommendations": ["array de 3-5 acciones concretas y ejecutables"]
}`;

  const userPrompt = `Datos del gimnasio (últimos 30 días):
- Total socios: ${totalMembers || 0}
- Socios activos: ${activeMembers || 0}
- Socios en riesgo alto: ${atRiskMembers || 0}
- Asistencias totales: ${attendanceLast30 || 0}
- Ingresos totales: $${totalRevenue.toFixed(2)} MXN

Genera 4-6 insights relevantes y 3-5 recomendaciones accionables.`;

  const result = await callAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 1500, jsonMode: true });
  return res.status(200).json({ ...result, generatedAt: now.toISOString() });
}

// --- POST /api/ai/campaign-assistant ---
const AI_CAMPAIGN_SYSTEM_PROMPT = `Eres un experto en marketing para gimnasios y programas de fidelización. Tu tarea es diseñar campañas de WhatsApp efectivas para gimnasios mexicanos.

Responde con un objeto JSON con esta estructura exacta:
{
  "campaignName": "string (nombre atractivo, max 60 chars)",
  "objective": "string (objetivo claro y medible, max 150 chars)",
  "targetSegment": {
    "name": "string (nombre del segmento)",
    "criteria": "string (descripción de los criterios)",
    "estimatedSize": "string (rango estimado, ej: '20-40 socios')"
  },
  "messages": [
    {
      "variant": "A|B|C",
      "tone": "string (ej: 'motivacional', 'urgente', 'amigable')",
      "text": "string (mensaje WhatsApp completo, max 300 chars, usar {{firstName}} para personalizar)",
      "cta": "string (llamada a la acción clara)"
    }
  ],
  "timing": {
    "bestDay": "string (ej: 'Lunes o Martes')",
    "bestHour": "string (ej: '10:00')",
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
- Las predicciones deben ser realistas (no exagerar)`;

async function handleAICampaignAssistant(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
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

  let totalMembers = 0, activeMemberships = 0, recentCampaigns = [];

  if (!IS_DEMO_MODE && !user.isDemo) {
    const supabase = getSupabase();
    const tenantId = user.tenantId;
    const [tm, am, rc] = await Promise.all([
      supabase.from('Member').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('isActive', true),
      supabase.from('Membership').select('*', { count: 'exact', head: true }).eq('tenantId', tenantId).eq('status', 'ACTIVE'),
      supabase.from('Campaign').select('name, type, status').eq('tenantId', tenantId).order('createdAt', { ascending: false }).limit(5),
    ]);
    totalMembers = tm.count || 0;
    activeMemberships = am.count || 0;
    recentCampaigns = rc.data || [];
  } else {
    totalMembers = 5; activeMemberships = 4;
    recentCampaigns = [{ name: 'Reactivación', type: 'REMINDER', status: 'DRAFT' }];
  }

  const userPrompt = `Contexto del gimnasio:
- Total socios activos: ${totalMembers}
- Membresías activas: ${activeMemberships}
- Campañas recientes: ${recentCampaigns.map((c) => `${c.name} (${c.type})`).join(', ') || 'ninguna'}

Petición del administrador:
"${description}"

Genera la propuesta de campaña en formato JSON.`;

  const result = await callAI(AI_CAMPAIGN_SYSTEM_PROMPT, userPrompt, { temperature: 0.7, maxTokens: 2000, jsonMode: true });
  return res.status(200).json({ success: true, proposal: result, context: { totalMembers, activeMemberships } });
}

// --- POST /api/ai/churn-analysis ---
const AI_CHURN_SYSTEM_PROMPT = `Eres un analista de retención de gimnasios experto. Tu tarea es analizar perfiles de socios y predecir su riesgo de abandono.

Para cada socio, responde con un objeto JSON con esta estructura:
{
  "riskScore": number (0-100),
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "topReasons": ["array de 2-3 razones principales del riesgo, máximo 80 chars cada una"],
  "recommendedActions": [
    {
      "action": "string (acción concreta)",
      "priority": "alta" | "media" | "baja",
      "expectedImpact": "string (impacto esperado)"
    }
  ],
  "personalizedMessage": "string (mensaje WhatsApp personalizado de retención, max 250 chars)",
  "estimatedLifetimeValue": "string (valor proyectado si se retiene, ej: '$8,500 MXN/año')",
  "urgencyDays": number (días en los que actuar, 1-30)
}`;

async function handleAIChurnAnalysis(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'IA no configurada', hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel' });
  }

  const { memberId } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId requerido' });

  if (IS_DEMO_MODE || user.isDemo) {
    const member = DEMO_MEMBERS.find((m) => m.id === memberId) || DEMO_MEMBERS[0];
    return res.status(200).json({
      success: true,
      member: { id: member.id, name: `${member.firstName} ${member.lastName}`, currentRiskLevel: member.riskLevel },
      analysis: { riskScore: 65, riskLevel: 'MEDIUM', topReasons: ['No ha asistido en 10 días', 'Membresía vence pronto'], recommendedActions: [{ action: 'Enviar mensaje de reactivación', priority: 'alta', expectedImpact: 'Reduce riesgo 40%' }], personalizedMessage: `Hola ${member.firstName}, te extrañamos en el gym. ¡Vuelve esta semana y te damos una clase gratis!`, estimatedLifetimeValue: '$8,500 MXN/año', urgencyDays: 7 },
    });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  const { data: member, error: memberError } = await supabase
    .from('Member')
    .select('*, Membership(*, Plan(*)), Attendance(timestamp, method), PointMovement(*), Redemption(*, Reward(name, pointsCost))')
    .eq('id', memberId)
    .eq('tenantId', tenantId)
    .maybeSingle();

  if (memberError || !member) return res.status(404).json({ error: 'Socio no encontrado' });

  const now = new Date();
  const attendances = member.Attendance || [];
  const lastAttendance = attendances[0]?.timestamp;
  const daysSinceLastAttendance = lastAttendance
    ? Math.floor((now.getTime() - new Date(lastAttendance).getTime()) / 86400000)
    : null;
  const last30Days = attendances.filter((a) => new Date(a.timestamp).getTime() > now.getTime() - 30 * 86400000).length;
  const activeMembership = (member.Membership || []).find((m) => m.status === 'ACTIVE');
  const daysToExpiry = activeMembership
    ? Math.floor((new Date(activeMembership.endDate).getTime() - now.getTime()) / 86400000)
    : null;
  const memberAgeDays = Math.floor((now.getTime() - new Date(member.createdAt).getTime()) / 86400000);

  const profile = {
    nombre: `${member.firstName} ${member.lastName}`,
    diasComoSocio: memberAgeDays,
    diasSinAsistir: daysSinceLastAttendance,
    asistenciasUltimos30Dias: last30Days,
    membresiaActiva: activeMembership ? { plan: activeMembership.Plan?.name, diasRestantes: daysToExpiry } : null,
    saldoPuntos: member.pointsBalance,
    canjesRealizados: (member.Redemption || []).length,
    consentimientoMarketing: member.marketingConsent,
  };

  const userPrompt = `Analiza este perfil de socio y predice su riesgo de abandono:\n\n${JSON.stringify(profile, null, 2)}\n\nGenera el análisis en formato JSON según el schema indicado.`;
  const analysis = await callAI(AI_CHURN_SYSTEM_PROMPT, userPrompt, { temperature: 0.4, maxTokens: 1500, jsonMode: true });

  // Persist risk score back to DB
  if (analysis.riskScore !== undefined && analysis.riskLevel) {
    const validLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(analysis.riskLevel)
      ? analysis.riskLevel
      : analysis.riskLevel === 'CRITICAL' ? 'HIGH' : 'LOW';
    await supabase.from('Member').update({
      riskScore: Math.min(100, Math.max(0, analysis.riskScore)),
      riskLevel: validLevel,
      riskScoreDate: new Date().toISOString(),
    }).eq('id', memberId);
  }

  return res.status(200).json({
    success: true,
    member: { id: member.id, name: `${member.firstName} ${member.lastName}`, currentRiskScore: member.riskScore, currentRiskLevel: member.riskLevel },
    analysis,
    profile,
  });
}

// --- POST /api/ai/reward-recommendations ---
const AI_REWARD_SYSTEM_PROMPT = `Eres un experto en programas de fidelización de gimnasios. Tu tarea es recomendar recompensas personalizadas para cada socio basándote en su comportamiento y perfil.

Responde con un objeto JSON con esta estructura:
{
  "recommendations": [
    {
      "rewardName": "string (nombre de la recompensa, max 80 chars)",
      "pointsCost": number (entre 50 y 1000),
      "category": "experiencia" | "descuento" | "producto" | "exclusivo",
      "matchScore": number (0-100),
      "reasoning": "string (por qué esta recompensa, max 150 chars)",
      "expectedEngagement": "string (impacto esperado)"
    }
  ],
  "memberInsights": {
    "profile": "string (resumen del socio, max 200 chars)",
    "preferredActivities": ["array de strings"],
    "engagementLevel": "alto" | "medio" | "bajo",
    "loyaltyStage": "nuevo" | "establecido" | "leal" | "embajador"
  },
  "personalizedOffer": {
    "title": "string (oferta especial, max 60 chars)",
    "message": "string (mensaje WhatsApp con la oferta, max 250 chars, usar {{firstName}})",
    "validityDays": number (7-30)
  }
}`;

async function handleAIRewardRecommendations(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const user = await requireRole(req, res, ['OWNER', 'ADMIN']);
  if (!user) return;

  if (!isAIEnabled()) {
    return res.status(503).json({ error: 'IA no configurada', hint: 'Configura OPENAI_API_KEY en las variables de entorno de Vercel' });
  }

  const { memberId } = req.body || {};
  if (!memberId) return res.status(400).json({ error: 'memberId requerido' });

  if (IS_DEMO_MODE || user.isDemo) {
    const member = DEMO_MEMBERS.find((m) => m.id === memberId) || DEMO_MEMBERS[0];
    return res.status(200).json({
      success: true,
      member: { id: member.id, name: `${member.firstName} ${member.lastName}`, pointsBalance: member.pointsBalance },
      recommendations: [{ rewardName: 'Clase de yoga gratis', pointsCost: 150, category: 'experiencia', matchScore: 92, reasoning: 'Asiste frecuentemente en horario matutino', expectedEngagement: 'Aumenta visitas 20%' }],
      memberInsights: { profile: 'Socio activo con buen historial de asistencia', preferredActivities: ['cardio', 'pesas'], engagementLevel: 'alto', loyaltyStage: 'establecido' },
      personalizedOffer: { title: 'Oferta especial para ti', message: `Hola ${member.firstName}, tienes ${member.pointsBalance} puntos. ¡Canjéalos por una clase gratis esta semana!`, validityDays: 7 },
    });
  }

  const supabase = getSupabase();
  const tenantId = user.tenantId;

  const [{ data: member }, { data: availableRewards }] = await Promise.all([
    supabase.from('Member').select('*, Membership(status, Plan(name)), Attendance(timestamp), Redemption(*, Reward(name, pointsCost)), PointMovement(*)').eq('id', memberId).eq('tenantId', tenantId).maybeSingle(),
    supabase.from('Reward').select('*').eq('tenantId', tenantId).eq('isActive', true).order('pointsCost', { ascending: true }),
  ]);

  if (!member) return res.status(404).json({ error: 'Socio no encontrado' });

  const now = new Date();
  const attendances = member.Attendance || [];
  const attendanceHours = attendances.map((a) => new Date(a.timestamp).getHours());
  const avgHour = attendanceHours.length > 0 ? Math.round(attendanceHours.reduce((a, b) => a + b, 0) / attendanceHours.length) : null;

  const profile = {
    nombre: member.firstName,
    saldoPuntos: member.pointsBalance,
    asistenciasRecientes: attendances.length,
    horarioPreferido: avgHour ? `~${avgHour}:00 hrs` : 'desconocido',
    planActual: (member.Membership || []).find((m) => m.status === 'ACTIVE')?.Plan?.name,
    diasComoSocio: Math.floor((now.getTime() - new Date(member.createdAt).getTime()) / 86400000),
    canjesAnteriores: (member.Redemption || []).map((r) => ({ recompensa: r.Reward?.name, costoPuntos: r.pointsSpent })),
  };

  const userPrompt = `Genera recomendaciones de recompensas para este socio:\n\n${JSON.stringify(profile, null, 2)}\n\nRecompensas disponibles:\n${(availableRewards || []).map((r) => `- ${r.name} (${r.pointsCost} pts, stock: ${r.stock ?? 'ilimitado'})`).join('\n') || 'ninguna'}\n\nGenera la respuesta en formato JSON según el schema indicado.`;

  const recommendations = await callAI(AI_REWARD_SYSTEM_PROMPT, userPrompt, { temperature: 0.8, maxTokens: 2000, jsonMode: true });

  return res.status(200).json({
    success: true,
    member: { id: member.id, name: `${member.firstName} ${member.lastName}`, pointsBalance: member.pointsBalance },
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
    if (path === '/attendances' || path.startsWith('/attendances/')) return await handleAttendances(req, res);

    // Campaigns
    if (path === '/campaigns' || path.startsWith('/campaigns/')) return await handleCampaigns(req, res);

    // Segments
    if (path === '/segments' || path.startsWith('/segments/')) return await handleSegments(req, res);

    // Payments
    if (path === '/payments' || path.startsWith('/payments/')) return await handlePayments(req, res);

    // Rewards
    if (path === '/rewards' || path.startsWith('/rewards/')) return await handleRewards(req, res);

    // Alerts
    if (path === '/alerts' || path.startsWith('/alerts/')) return await handleAlerts(req, res);

    // AI routes
    if (path === '/ai/insights') return await handleAIInsights(req, res);
    if (path === '/ai/campaign-assistant') return await handleAICampaignAssistant(req, res);
    if (path === '/ai/churn-analysis') return await handleAIChurnAnalysis(req, res);
    if (path === '/ai/reward-recommendations') return await handleAIRewardRecommendations(req, res);

    // 404 fallback
    return res.status(404).json({ error: 'Ruta no encontrada', path });
  } catch (err) {
    console.error(`API error [${path}]:`, err);
    return res.status(500).json({ error: 'Error interno del servidor', message: err?.message });
  }
}
