import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  '';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

let prisma;
export function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }
  return prisma;
}

export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function verifyAuth(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function requireAuth(req, res) {
  const user = verifyAuth(req);
  if (!user) {
    res.status(401).json({ error: 'No autenticado' });
    return null;
  }
  return user;
}

export function requireRole(req, res, allowedRoles) {
  const user = requireAuth(req, res);
  if (!user) return null;
  if (!allowedRoles.includes(user.role)) {
    res.status(403).json({ error: 'Permiso insuficiente' });
    return null;
  }
  return user;
}
