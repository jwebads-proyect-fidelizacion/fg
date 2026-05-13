// Stub: BullMQ no está disponible en Vercel serverless.
// Para producción con campañas programadas, usa Railway/Render con un worker persistente.
const stubQueue = {
  add: async (_name: string, _data: any) => ({ id: 'stub-job-id' }),
};

export const campaignSchedulerQueue = stubQueue;
export const campaignSenderQueue = stubQueue;
export const riskCalculatorQueue = stubQueue;
export const membershipExpiryQueue = stubQueue;
export const metricsQueue = stubQueue;
export const importQueue = stubQueue;
export const pointsQueue = stubQueue;
