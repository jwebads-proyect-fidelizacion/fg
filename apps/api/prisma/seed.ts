import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create tenant (gym)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'GymFit Centro',
      timezone: 'America/Mexico_City',
      attendanceWindowMinutes: 30,
      optOutKeywords: ['BAJA', 'STOP'],
    },
  });
  console.log(`✅ Tenant created: ${tenant.name}`);

  // Create admin user
  const passwordHash = await argon2.hash('Admin123!@#', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const user = await prisma.user.create({
    data: {
      email: 'admin@gymfit.com',
      passwordHash,
    },
  });

  await prisma.userTenant.create({
    data: {
      userId: user.id,
      tenantId: tenant.id,
      role: 'OWNER',
    },
  });
  console.log(`✅ Admin user created: admin@gymfit.com / Admin123!@#`);

  // Create plans
  const plans = await Promise.all([
    prisma.plan.create({
      data: {
        tenantId: tenant.id,
        name: 'Mensual Básico',
        description: 'Acceso al gimnasio de lunes a viernes',
        durationDays: 30,
        price: 599,
        currency: 'MXN',
      },
    }),
    prisma.plan.create({
      data: {
        tenantId: tenant.id,
        name: 'Mensual Premium',
        description: 'Acceso completo + clases grupales',
        durationDays: 30,
        price: 899,
        currency: 'MXN',
      },
    }),
    prisma.plan.create({
      data: {
        tenantId: tenant.id,
        name: 'Trimestral',
        description: 'Acceso completo por 3 meses con descuento',
        durationDays: 90,
        price: 2299,
        currency: 'MXN',
      },
    }),
    prisma.plan.create({
      data: {
        tenantId: tenant.id,
        name: 'Anual VIP',
        description: 'Acceso ilimitado + clases + nutriólogo',
        durationDays: 365,
        price: 7999,
        currency: 'MXN',
      },
    }),
  ]);
  console.log(`✅ ${plans.length} plans created`);

  // Create point rules
  await Promise.all([
    prisma.pointRule.create({
      data: { tenantId: tenant.id, event: 'ATTENDANCE', points: 10, isEnabled: true },
    }),
    prisma.pointRule.create({
      data: { tenantId: tenant.id, event: 'PAYMENT', points: 50, isEnabled: true },
    }),
    prisma.pointRule.create({
      data: { tenantId: tenant.id, event: 'REFERRAL', points: 200, isEnabled: true },
    }),
    prisma.pointRule.create({
      data: { tenantId: tenant.id, event: 'NPS_RESPONSE', points: 25, isEnabled: true },
    }),
  ]);
  console.log('✅ Point rules created');

  // Create sample members
  const members = await Promise.all([
    prisma.member.create({
      data: {
        tenantId: tenant.id,
        firstName: 'María',
        lastName: 'González',
        phone: '+5215512345678',
        email: 'maria@email.com',
        dateOfBirth: new Date('1990-03-15'),
        referralCode: 'MARIA001',
        marketingConsent: true,
        marketingConsentDate: new Date(),
        marketingConsentChannel: 'REGISTRATION',
        pointsBalance: 150,
      },
    }),
    prisma.member.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Carlos',
        lastName: 'Hernández',
        phone: '+5215587654321',
        email: 'carlos@email.com',
        dateOfBirth: new Date('1985-07-22'),
        referralCode: 'CARLO002',
        marketingConsent: true,
        marketingConsentDate: new Date(),
        marketingConsentChannel: 'REGISTRATION',
        pointsBalance: 320,
      },
    }),
    prisma.member.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Ana',
        lastName: 'López',
        phone: '+5215511223344',
        email: 'ana@email.com',
        dateOfBirth: new Date('1995-11-08'),
        referralCode: 'ANALO003',
        marketingConsent: true,
        marketingConsentDate: new Date(),
        marketingConsentChannel: 'REGISTRATION',
        pointsBalance: 80,
      },
    }),
    prisma.member.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Roberto',
        lastName: 'Martínez',
        phone: '+5215599887766',
        email: 'roberto@email.com',
        dateOfBirth: new Date('1988-01-30'),
        referralCode: 'ROBER004',
        marketingConsent: false,
        pointsBalance: 0,
      },
    }),
    prisma.member.create({
      data: {
        tenantId: tenant.id,
        firstName: 'Laura',
        lastName: 'Ramírez',
        phone: '+5215544556677',
        email: 'laura@email.com',
        dateOfBirth: new Date('1992-06-12'),
        referralCode: 'LAURA005',
        marketingConsent: true,
        marketingConsentDate: new Date(),
        marketingConsentChannel: 'REGISTRATION',
        pointsBalance: 500,
        riskLevel: 'HIGH',
        riskScore: 78,
        riskScoreDate: new Date(),
      },
    }),
  ]);
  console.log(`✅ ${members.length} sample members created`);

  // Create memberships for some members
  const now = new Date();
  await Promise.all([
    prisma.membership.create({
      data: {
        tenantId: tenant.id,
        memberId: members[0].id,
        planId: plans[1].id,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        status: 'ACTIVE',
      },
    }),
    prisma.membership.create({
      data: {
        tenantId: tenant.id,
        memberId: members[1].id,
        planId: plans[2].id,
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 2, 0),
        status: 'ACTIVE',
      },
    }),
    prisma.membership.create({
      data: {
        tenantId: tenant.id,
        memberId: members[2].id,
        planId: plans[0].id,
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0),
        status: 'ACTIVE',
      },
    }),
  ]);
  console.log('✅ Memberships assigned');

  // Create sample attendances (last 7 days)
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

    for (const member of members.slice(0, 3)) {
      if (Math.random() > 0.3) {
        await prisma.attendance.create({
          data: {
            tenantId: tenant.id,
            memberId: member.id,
            timestamp: date,
            method: Math.random() > 0.5 ? 'QR' : 'MANUAL',
          },
        });
      }
    }
  }
  console.log('✅ Sample attendances created');

  // Create rewards
  await Promise.all([
    prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: 'Clase de yoga gratis',
        pointsCost: 100,
        stock: 20,
        startDate: new Date(),
        endDate: new Date(now.getFullYear(), now.getMonth() + 3, 0),
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: '10% descuento en renovación',
        pointsCost: 250,
        stock: null,
        startDate: new Date(),
        endDate: new Date(now.getFullYear() + 1, 0, 1),
        isActive: true,
      },
    }),
    prisma.reward.create({
      data: {
        tenantId: tenant.id,
        name: 'Playera GymFit',
        pointsCost: 500,
        stock: 10,
        startDate: new Date(),
        endDate: new Date(now.getFullYear(), now.getMonth() + 6, 0),
        isActive: true,
      },
    }),
  ]);
  console.log('✅ Rewards created');

  // Create a segment
  await prisma.segment.create({
    data: {
      tenantId: tenant.id,
      name: 'Socios Inactivos (7+ días)',
      criteria: {
        lastAttendanceDaysAgo: 7,
        membershipStatus: 'ACTIVE',
      },
    },
  });
  console.log('✅ Sample segment created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('   Email: admin@gymfit.com');
  console.log('   Password: Admin123!@#');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
