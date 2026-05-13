import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  '';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';

let prisma;
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }
  return prisma;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  if (!databaseUrl) {
    return res.status(500).json({
      error: 'Base de datos no configurada',
      hint: 'Configure DATABASE_URL o POSTGRES_URL en las variables de entorno de Vercel',
    });
  }

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son requeridos' });
    }

    const db = getPrisma();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return res.status(423).json({
        error: `Cuenta bloqueada temporalmente. Intente en ${minutesLeft} minuto(s).`,
      });
    }

    const valid = await argon2.verify(user.passwordHash, password);
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
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: err?.message,
      code: err?.code,
    });
  }
}
