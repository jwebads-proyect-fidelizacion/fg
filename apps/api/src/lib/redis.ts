// Stub: Redis no está disponible en Vercel serverless.
// Para producción con colas, usa Upstash Redis o migra a Railway/Render.
export const redis = {
  get: async (_key: string) => null,
  set: async (_key: string, _value: string) => 'OK',
  del: async (_key: string) => 1,
  on: () => {},
};

export default redis;
