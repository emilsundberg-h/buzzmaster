/**
 * Create admin user in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const adminClerkId = 'user_34YZEwyUER1sRLKYa4YOYoPUkMI'; // From Railway logs
    const adminEmail = 'emil.a.sundberg+admin@gmail.com';
    
    console.log('🔧 Creating admin user...');
    
    // Check if admin already exists
    const existing = await prisma.user.findUnique({
      where: { clerkId: adminClerkId },
    });

    if (existing) {
      console.log('✅ Admin user already exists:', existing.username);
      return;
    }

    // Find captain player (Beckham for avatar 02)
    const captain = await prisma.player.findFirst({
      where: {
        name: 'David Beckham',
        category: 'CAPTAIN',
      },
    });

    if (!captain) {
      console.error('❌ Captain player "David Beckham" not found. Run seed-captains.ts first!');
      process.exit(1);
    }

    console.log('✅ Found captain:', captain.name);

    // Create admin user with captain
    const admin = await prisma.user.create({
      data: {
        clerkId: adminClerkId,
        username: 'Emil',
        avatarKey: '02', // Beckham
        score: 0,
        team: {
          create: {
            formation: 'F442',
            positions: {
              create: [
                {
                  position: 0,
                  playerId: captain.id,
                },
              ],
            },
          },
        },
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Username:', admin.username);
    console.log('   Clerk ID:', admin.clerkId);
    console.log('   Avatar:', admin.avatarKey);
    console.log('   Captain:', captain.name);
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
