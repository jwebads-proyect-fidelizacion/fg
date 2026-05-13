import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const env = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
    nodeEnv: process.env.NODE_ENV || 'not-set',
    node: process.version,
  };

  let dbStatus: any = { connected: false };
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    dbStatus = { connected: true, result };
    await prisma.$disconnect();
  } catch (err: any) {
    dbStatus = { connected: false, error: err.message, code: err.code };
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env,
    database: dbStatus,
  });
}
