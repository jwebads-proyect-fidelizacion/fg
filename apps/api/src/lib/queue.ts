import { Queue, Worker, QueueEvents } from 'bullmq';
import redis from './redis.js';

const connection = { connection: redis };

export const campaignSchedulerQueue = new Queue('campaign-scheduler', connection);
export const campaignSenderQueue = new Queue('campaign-sender', connection);
export const riskCalculatorQueue = new Queue('risk-calculator', connection);
export const membershipExpiryQueue = new Queue('membership-expiry', connection);
export const metricsQueue = new Queue('metrics-aggregator', connection);
export const importQueue = new Queue('import-processor', connection);
export const pointsQueue = new Queue('points-processor', connection);

export { Queue, Worker, QueueEvents };
