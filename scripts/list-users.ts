/**
 * Script to list all users in the database
 * Usage: DATABASE_URL="<railway-public-url>" npx tsx scripts/list-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listUsers() {
  try {
    console.log('📋 Fetching all users...\n');

    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        username: true,
        avatarKey: true,
        score: true,
        createdAt: true,
        _count: {
          select: {
            players: true,
            roomMemberships: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (users.length === 0) {
      console.log('No users found.');
      return;
    }

    console.log(`Found ${users.length} users:\n`);
    console.log('─'.repeat(100));

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Clerk ID: ${user.clerkId}`);
      console.log(`   Avatar: ${user.avatarKey}`);
      console.log(`   Score: ${user.score}`);
      console.log(`   Players: ${user._count.players}`);
      console.log(`   Rooms: ${user._count.roomMemberships}`);
      console.log(`   Created: ${user.createdAt.toISOString()}`);
      console.log('─'.repeat(100));
    });

    console.log(`\nTotal: ${users.length} users\n`);
  } catch (error) {
    console.error('❌ Error listing users:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
