export default async function handler(req, res) {
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

  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';

  let dbStatus = { connected: false };
  if (databaseUrl) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      });
      const result = await prisma.$queryRaw`SELECT 1 as ok`;
      const userCount = await prisma.user.count().catch((e) => ({ error: e.message }));
      const tenantCount = await prisma.tenant.count().catch((e) => ({ error: e.message }));
      dbStatus = { connected: true, result, userCount, tenantCount };
      await prisma.$disconnect();
    } catch (err) {
      dbStatus = {
        connected: false,
        error: err.message,
        code: err.code,
        name: err.name,
      };
    }
  } else {
    dbStatus = { connected: false, error: 'No database URL found in any env var' };
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    totalEnvVars: allEnvKeys.length,
    relevantEnvVars: envInfo,
    database: dbStatus,
    node: process.version,
  });
}
