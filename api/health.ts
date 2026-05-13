import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    '';

  const env = {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasPostgresUrl: !!process.env.POSTGRES_URL,
    hasPostgresPrismaUrl: !!process.env.POSTGRES_PRISMA_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasPostgresUrlNonPooling: !!process.env.POSTGRES_URL_NON_POOLING,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasJwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
    nodeEnv: process.env.NODE_ENV || 'not-set',
    node: process.version,
    resolvedUrlSource: databaseUrl
      ? process.env.DATABASE_URL
        ? 'DATABASE_URL'
        : process.env.POSTGRES_URL
        ? 'POSTGRES_URL'
        : 'POSTGRES_PRISMA_URL'
      : 'NONE',
  };

  let dbStatus: any = { connected: false };
  if (databaseUrl) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });
      const result = await prisma.$queryRaw`SELECT 1 as ok`;
      const userCount = await prisma.user.count().catch(() => -1);
      dbStatus = { connected: true, result, userCount };
      await prisma.$disconnect();
    } catch (err: any) {
      dbStatus = {
        connected: false,
        error: err.message,
        code: err.code,
        name: err.name,
      };
    }
  } else {
    dbStatus = { connected: false, error: 'No database URL configured' };
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env,
    database: dbStatus,
  });
}
