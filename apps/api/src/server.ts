import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { authRoutes } from './modules/auth/routes.js';
import { memberRoutes } from './modules/members/routes.js';
import { planRoutes } from './modules/plans/routes.js';
import { membershipRoutes } from './modules/memberships/routes.js';
import { paymentRoutes } from './modules/payments/routes.js';
import { attendanceRoutes } from './modules/attendance/routes.js';
import { campaignRoutes } from './modules/campaigns/routes.js';
import { segmentRoutes } from './modules/segments/routes.js';
import { pointRoutes } from './modules/points/routes.js';
import { rewardRoutes } from './modules/rewards/routes.js';
import { dashboardRoutes } from './modules/dashboard/routes.js';
import { alertRoutes } from './modules/alerts/routes.js';

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
});
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Health check
app.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Routes
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

// Start
const PORT = parseInt(process.env.PORT || '3001');
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Server running on http://localhost:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export default app;
