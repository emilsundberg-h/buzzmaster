/**
 * Script to delete a user from the database
 * Usage: DATABASE_URL="<railway-public-url>" npx tsx scripts/delete-user.ts <email-or-username>
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteUser(identifier: string) {
  try {
    console.log(`🔍 Looking for user: ${identifier}`);

    // Find user by email, username, or clerkId
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier },
          { clerkId: identifier },
        ],
      },
      select: {
        id: true,
        username: true,
        clerkId: true,
      },
    });

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log(`\n📋 Found user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Clerk ID: ${user.clerkId}`);

    console.log('\n🗑️  Deleting user data...\n');

    // Delete Dream Eleven data first (has foreign keys)
    const userTeam = await prisma.userTeam.findUnique({
      where: { userId: user.id },
    });

    if (userTeam) {
      const deletedPositions = await prisma.teamPosition.deleteMany({
        where: { teamId: userTeam.id },
      });
      console.log(`   ✓ Deleted ${deletedPositions.count} team positions`);

      await prisma.userTeam.delete({ where: { id: userTeam.id } });
      console.log(`   ✓ Deleted user team`);
    }

    // Delete all related data in a transaction
    const result = await prisma.$transaction([
      prisma.userPlayer.deleteMany({ where: { userId: user.id } }),
      prisma.messageRead.deleteMany({ where: { userId: user.id } }),
      prisma.message.deleteMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
      }),
      prisma.poke.deleteMany({
        where: {
          OR: [{ senderId: user.id }, { receiverId: user.id }],
        },
      }),
      prisma.press.deleteMany({ where: { userId: user.id } }),
      prisma.answer.deleteMany({ where: { userId: user.id } }),
      prisma.roomMembership.deleteMany({ where: { userId: user.id } }),
      prisma.trophyWin.deleteMany({ where: { userId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    console.log(`   ✓ Deleted ${result[0].count} owned players`);
    console.log(`   ✓ Deleted ${result[1].count} message reads`);
    console.log(`   ✓ Deleted ${result[2].count} messages`);
    console.log(`   ✓ Deleted ${result[3].count} pokes`);
    console.log(`   ✓ Deleted ${result[4].count} presses`);
    console.log(`   ✓ Deleted ${result[5].count} answers`);
    console.log(`   ✓ Deleted ${result[6].count} room memberships`);
    console.log(`   ✓ Deleted ${result[7].count} trophy wins`);
    console.log(`   ✓ Deleted user`);

    console.log('\n✅ User deleted successfully!\n');
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get identifier from command line
const identifier = process.argv[2];

if (!identifier) {
  console.log('Usage: DATABASE_URL="<url>" npx tsx scripts/delete-user.ts <username-or-clerkId>');
  console.log('\nExample:');
  console.log('  DATABASE_URL="postgresql://..." npx tsx scripts/delete-user.ts "TestUser"');
  process.exit(1);
}

deleteUser(identifier);
