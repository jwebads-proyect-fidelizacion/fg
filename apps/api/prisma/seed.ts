import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Use existing tenant if exists, otherwise create
  let tenant = await prisma.tenant.findFirst({ where: { name: 'GymFit Centro' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'GymFit Centro',
        timezone: 'America/Mexico_City',
        attendanceWindowMinutes: 30,
        optOutKeywords: ['BAJA', 'STOP'],
      },
    });
  }
  console.log(`✅ Tenant: ${tenant.name}`);

  // Admin user with bcryptjs (pure JS, no native dependencies)
  const passwordHash = await bcrypt.hash('Admin123!@#', 10);

  let user = await prisma.user.findUnique({ where: { email: 'admin@gymfit.com' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'admin@gymfit.com',
        passwordHash,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, failedAttempts: 0, lockedUntil: null },
    });
  }

  // Ensure UserTenant exists
  const existingUT = await prisma.userTenant.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
  });
  if (!existingUT) {
    await prisma.userTenant.create({
      data: { userId: user.id, tenantId: tenant.id, role: 'OWNER' },
    });
  }
  console.log(`✅ Admin user: admin@gymfit.com / Admin123!@#`);

  // Plans
  const planNames = ['Mensual Básico', 'Mensual Premium', 'Trimestral', 'Anual VIP'];
  const planConfigs = [
    { name: 'Mensual Básico', description: 'Acceso al gimnasio de lunes a viernes', durationDays: 30, price: 599 },
    { name: 'Mensual Premium', description: 'Acceso completo + clases grupales', durationDays: 30, price: 899 },
    { name: 'Trimestral', description: 'Acceso completo por 3 meses con descuento', durationDays: 90, price: 2299 },
    { name: 'Anual VIP', description: 'Acceso ilimitado + clases + nutriólogo', durationDays: 365, price: 7999 },
  ];

  const plans = [];
  for (const config of planConfigs) {
    let plan = await prisma.plan.findFirst({ where: { tenantId: tenant.id, name: config.name } });
    if (!plan) {
      plan = await prisma.plan.create({
        data: {
          tenantId: tenant.id,
          ...config,
          currency: 'MXN',
        },
      });
    }
    plans.push(plan);
  }
  console.log(`✅ ${plans.length} plans`);

  // Point rules
  const pointEvents: Array<{ event: 'ATTENDANCE' | 'PAYMENT' | 'REFERRAL' | 'NPS_RESPONSE'; points: number }> = [
    { event: 'ATTENDANCE', points: 10 },
    { event: 'PAYMENT', points: 50 },
    { event: 'REFERRAL', points: 200 },
    { event: 'NPS_RESPONSE', points: 25 },
  ];
  for (const rule of pointEvents) {
    await prisma.pointRule.upsert({
      where: { tenantId_event: { tenantId: tenant.id, event: rule.event } },
      create: { tenantId: tenant.id, ...rule, isEnabled: true },
      update: { points: rule.points, isEnabled: true },
    });
  }
  console.log('✅ Point rules');

  // Sample members
  const sampleMembers = [
    { firstName: 'María', lastName: 'González', phone: '+5215512345678', email: 'maria@email.com', dateOfBirth: new Date('1990-03-15'), referralCode: 'MARIA001', pointsBalance: 150 },
    { firstName: 'Carlos', lastName: 'Hernández', phone: '+5215587654321', email: 'carlos@email.com', dateOfBirth: new Date('1985-07-22'), referralCode: 'CARLO002', pointsBalance: 320 },
    { firstName: 'Ana', lastName: 'López', phone: '+5215511223344', email: 'ana@email.com', dateOfBirth: new Date('1995-11-08'), referralCode: 'ANALO003', pointsBalance: 80 },
    { firstName: 'Roberto', lastName: 'Martínez', phone: '+5215599887766', email: 'roberto@email.com', dateOfBirth: new Date('1988-01-30'), referralCode: 'ROBER004', pointsBalance: 0 },
    { firstName: 'Laura', lastName: 'Ramírez', phone: '+5215544556677', email: 'laura@email.com', dateOfBirth: new Date('1992-06-12'), referralCode: 'LAURA005', pointsBalance: 500 },
  ];

  const members = [];
  for (const data of sampleMembers) {
    let member = await prisma.member.findUnique({
      where: { tenantId_phone: { tenantId: tenant.id, phone: data.phone } },
    });
    if (!member) {
      member = await prisma.member.create({
        data: {
          tenantId: tenant.id,
          ...data,
          marketingConsent: true,
          marketingConsentDate: new Date(),
          marketingConsentChannel: 'REGISTRATION',
        },
      });
    }
    members.push(member);
  }
  console.log(`✅ ${members.length} sample members`);

  // Memberships
  const now = new Date();
  const memberships = [
    { memberId: members[0].id, planId: plans[1].id, daysOffset: 0 },
    { memberId: members[1].id, planId: plans[2].id, daysOffset: -30 },
    { memberId: members[2].id, planId: plans[0].id, daysOffset: 0 },
  ];
  for (const m of memberships) {
    const exists = await prisma.membership.findFirst({
      where: { memberId: m.memberId, status: 'ACTIVE' },
    });
    if (!exists) {
      const plan = plans.find(p => p.id === m.planId)!;
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() + m.daysOffset);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + plan.durationDays);
      await prisma.membership.create({
        data: {
          tenantId: tenant.id,
          memberId: m.memberId,
          planId: m.planId,
          startDate,
          endDate,
          status: 'ACTIVE',
        },
      });
    }
  }
  console.log('✅ Memberships');

  // Rewards
  const sampleRewards = [
    { name: 'Clase de yoga gratis', pointsCost: 100, stock: 20 },
    { name: '10% descuento en renovación', pointsCost: 250, stock: null },
    { name: 'Playera GymFit', pointsCost: 500, stock: 10 },
  ];
  for (const r of sampleRewards) {
    const exists = await prisma.reward.findFirst({ where: { tenantId: tenant.id, name: r.name } });
    if (!exists) {
      await prisma.reward.create({
        data: {
          tenantId: tenant.id,
          ...r,
          startDate: new Date(),
          endDate: new Date(now.getFullYear(), now.getMonth() + 6, 0),
          isActive: true,
        },
      });
    }
  }
  console.log('✅ Rewards');

  console.log('\n🎉 Seed completed successfully!\n');
  console.log('📋 Login credentials:');
  console.log('   Email: admin@gymfit.com');
  console.log('   Password: Admin123!@#\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
