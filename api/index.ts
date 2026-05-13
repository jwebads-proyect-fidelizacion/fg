import type { VercelRequest, VercelResponse } from '@vercel/node';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { authRoutes } from '../apps/api/src/modules/auth/routes.js';
import { memberRoutes } from '../apps/api/src/modules/members/routes.js';
import { planRoutes } from '../apps/api/src/modules/plans/routes.js';
import { membershipRoutes } from '../apps/api/src/modules/memberships/routes.js';
import { paymentRoutes } from '../apps/api/src/modules/payments/routes.js';
import { attendanceRoutes } from '../apps/api/src/modules/attendance/routes.js';
import { campaignRoutes } from '../apps/api/src/modules/campaigns/routes.js';
import { segmentRoutes } from '../apps/api/src/modules/segments/routes.js';
import { pointRoutes } from '../apps/api/src/modules/points/routes.js';
import { rewardRoutes } from '../apps/api/src/modules/rewards/routes.js';
import { dashboardRoutes } from '../apps/api/src/modules/dashboard/routes.js';
import { alertRoutes } from '../apps/api/src/modules/alerts/routes.js';

let app: FastifyInstance | null = null;

async function buildApp() {
  if (app) return app;

  app = Fastify({ logger: false });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(memberRoutes, { prefix: '/api/members' });
  await app.register(planRoutes, { prefix: '/api/plans' });
  await app.register(membershipRoutes, { prefix: '/api/memberships' });
  await app.register(paymentRoutes, { prefix: '/api/payments' });
  await app.register(attendanceRoutes, { prefix: '/api/attendances' });
  await app.register(campaignRoutes, { prefix: '/api/campaigns' });
  await app.register(segmentRoutes, { prefix: '/api/segments' });
  await app.register(pointRoutes, { prefix: '/api/points' });
  await app.register(rewardRoutes, { prefix: '/api/rewards' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(alertRoutes, { prefix: '/api/alerts' });

  await app.ready();
  return app;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fastifyApp = await buildApp();
  fastifyApp.server.emit('request', req, res);
}
