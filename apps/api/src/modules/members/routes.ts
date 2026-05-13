import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requireAdmin, requireAny } from '../../middleware/rbac.js';
import prisma from '../../lib/prisma.js';
import { generateReferralCode } from '../../lib/crypto.js';
import { z } from 'zod';

const createMemberSchema = z.object({
  firstName: z.string().min(1, 'Nombre requerido').max(100),
  lastName: z.string().min(1, 'Apellido requerido').max(100),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Teléfono inválido. Formato: +521234567890'),
  email: z.string().email('Correo inválido').optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  documentId: z.string().max(30).optional().nullable(),
  marketingConsent: z.boolean().default(false),
  referredByCode: z.string().optional().nullable(),
});

const updateMemberSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  email: z.string().email().optional().nullable(),
  dateOfBirth: z.coerce.date().optional().nullable(),
  documentId: z.string().max(30).optional().nullable(),
  marketingConsent: z.boolean().optional(),
});

export async function memberRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);

  // GET / - List/search members (all roles, paginated)
  app.get('/', { preHandler: [requireAny()] }, async (request) => {
    const { search, page = '1', limit = '20', active } = request.query as Record<string, string>;
    const tenantId = request.tenantId!;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { tenantId };
    if (active !== undefined) {
      where.isActive = active === 'true';
    }
    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
        { documentId: { contains: term } },
      ];
    }

    const [members, total] = await Promise.all([
      prisma.member.findMany({
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
          tags: true,
        },
      }),
      prisma.member.count({ where }),
    ]);

    return {
      data: members,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // POST / - Create member (admin+)
  app.post('/', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const parsed = createMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    // Check duplicate phone
    const existing = await prisma.member.findUnique({
      where: { tenantId_phone: { tenantId, phone: body.phone } },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Ya existe un socio con este número de teléfono' });
    }

    // Handle referral
    let referredById: string | undefined;
    if (body.referredByCode) {
      const referrer = await prisma.member.findFirst({
        where: { tenantId, referralCode: body.referredByCode, isActive: true },
      });
      if (!referrer) {
        return reply.status(400).send({ error: 'Código de referido inválido o inactivo' });
      }
      referredById = referrer.id;
    }

    const member = await prisma.member.create({
      data: {
        tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        phone: body.phone,
        email: body.email ?? undefined,
        dateOfBirth: body.dateOfBirth ?? undefined,
        documentId: body.documentId ?? undefined,
        marketingConsent: body.marketingConsent,
        marketingConsentDate: body.marketingConsent ? new Date() : undefined,
        marketingConsentChannel: body.marketingConsent ? 'REGISTRATION' : undefined,
        referralCode: generateReferralCode(),
        referredById,
        isReferred: !!referredById,
      },
    });

    return reply.status(201).send(member);
  });

  // GET /:id - Get member detail (all roles)
  app.get('/:id', { preHandler: [requireAny()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const member = await prisma.member.findFirst({
      where: { id, tenantId: request.tenantId! },
      include: {
        memberships: { include: { plan: true }, orderBy: { startDate: 'desc' } },
        tags: true,
        attendances: { orderBy: { timestamp: 'desc' }, take: 10 },
        pointMovements: { orderBy: { createdAt: 'desc' }, take: 10 },
        referrals: { select: { id: true, firstName: true, lastName: true, createdAt: true } },
      },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }
    return member;
  });

  // PUT /:id - Update member (admin+)
  app.put('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateMemberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors });
    }
    const body = parsed.data;
    const tenantId = request.tenantId!;

    const existing = await prisma.member.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }

    // Check phone duplicate if changing
    if (body.phone && body.phone !== existing.phone) {
      const dup = await prisma.member.findUnique({
        where: { tenantId_phone: { tenantId, phone: body.phone } },
      });
      if (dup) {
        return reply.status(409).send({ error: 'Ya existe un socio con este número de teléfono' });
      }
    }

    // Handle marketing consent change
    const updateData: any = { ...body };
    if (body.marketingConsent !== undefined && body.marketingConsent !== existing.marketingConsent) {
      if (body.marketingConsent) {
        updateData.marketingConsentDate = new Date();
        updateData.marketingConsentChannel = 'UPDATE';
      } else {
        updateData.marketingConsentDate = null;
        updateData.marketingConsentChannel = null;
      }
    }

    const member = await prisma.member.update({ where: { id }, data: updateData });
    return member;
  });

  // DELETE /:id - Deactivate member (admin+)
  app.delete('/:id', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.member.findFirst({ where: { id, tenantId: request.tenantId! } });
    if (!existing) {
      return reply.status(404).send({ error: 'Socio no encontrado' });
    }
    if (!existing.isActive) {
      return reply.status(400).send({ error: 'El socio ya está dado de baja' });
    }

    await prisma.member.update({
      where: { id },
      data: { isActive: false, deactivatedAt: new Date() },
    });

    return { message: 'Socio dado de baja exitosamente' };
  });

  // POST /import - Upload CSV/XLSX for bulk import (admin+)
  app.post('/import', { preHandler: [requireAdmin()] }, async (request, reply) => {
    const tenantId = request.tenantId!;
    const file = await request.file();

    if (!file) {
      return reply.status(400).send({ error: 'Archivo requerido' });
    }

    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
      return reply.status(400).send({ error: 'Formato de archivo no soportado. Use CSV o XLSX.' });
    }

    const buffer = await file.toBuffer();
    const content = buffer.toString('utf-8');
    const lines = content.split('\n').filter((l) => l.trim());

    if (lines.length < 2) {
      return reply.status(400).send({ error: 'El archivo debe contener al menos una fila de datos además del encabezado' });
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const requiredHeaders = ['nombre', 'apellido', 'telefono'];
    const missing = requiredHeaders.filter((h) => !headers.includes(h));
    if (missing.length > 0) {
      return reply.status(400).send({ error: `Columnas requeridas faltantes: ${missing.join(', ')}` });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });

      const firstName = row['nombre'];
      const lastName = row['apellido'];
      const phone = row['telefono'];

      if (!firstName || !lastName || !phone) {
        results.errors.push(`Fila ${i + 1}: datos incompletos`);
        results.skipped++;
        continue;
      }

      // Check duplicate
      const existing = await prisma.member.findUnique({
        where: { tenantId_phone: { tenantId, phone } },
      });
      if (existing) {
        results.skipped++;
        continue;
      }

      try {
        await prisma.member.create({
          data: {
            tenantId,
            firstName,
            lastName,
            phone,
            email: row['email'] || undefined,
            documentId: row['documento'] || undefined,
            referralCode: generateReferralCode(),
          },
        });
        results.created++;
      } catch (err: any) {
        results.errors.push(`Fila ${i + 1}: ${err.message || 'Error desconocido'}`);
        results.skipped++;
      }
    }

    return {
      message: `Importación completada: ${results.created} creados, ${results.skipped} omitidos`,
      ...results,
    };
  });
}
