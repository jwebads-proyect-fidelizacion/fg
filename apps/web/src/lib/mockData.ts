// Simulated gym data for demo purposes
export const mockTenant = {
  id: 'tenant-001',
  name: 'GymFit Centro',
  timezone: 'America/Mexico_City',
  role: 'OWNER',
};

export const mockUser = {
  id: 'user-001',
  email: 'admin@gymfit.com',
};

export const mockMembers = [
  {
    id: 'member-001',
    firstName: 'María',
    lastName: 'González',
    phone: '+5215512345678',
    email: 'maria@email.com',
    dateOfBirth: '1990-03-15',
    isActive: true,
    pointsBalance: 150,
    riskLevel: 'LOW',
    riskScore: 22,
    referralCode: 'MARIA001',
    marketingConsent: true,
    createdAt: '2024-01-15T10:00:00Z',
    memberships: [{ id: 'ms-001', planId: 'plan-002', status: 'ACTIVE', startDate: '2025-05-01', endDate: '2025-05-31', plan: { name: 'Mensual Premium', price: 899, currency: 'MXN' } }],
    tags: [{ tag: 'VIP' }],
  },
  {
    id: 'member-002',
    firstName: 'Carlos',
    lastName: 'Hernández',
    phone: '+5215587654321',
    email: 'carlos@email.com',
    dateOfBirth: '1985-07-22',
    isActive: true,
    pointsBalance: 320,
    riskLevel: 'MEDIUM',
    riskScore: 45,
    referralCode: 'CARLO002',
    marketingConsent: true,
    createdAt: '2024-02-10T10:00:00Z',
    memberships: [{ id: 'ms-002', planId: 'plan-003', status: 'ACTIVE', startDate: '2025-04-01', endDate: '2025-06-30', plan: { name: 'Trimestral', price: 2299, currency: 'MXN' } }],
    tags: [],
  },
