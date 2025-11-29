/**
 * Check all simulator submissions in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSubmissions() {
  try {
    console.log('🎮 Checking all simulator submissions...\n');

    const submissions = await prisma.simulatorSubmission.findMany({
      include: {
        user: {
          select: {
            username: true,
            clerkId: true,
          },
        },
        players: {
          include: {
            player: {
              select: {
                name: true,
                position: true,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    if (submissions.length === 0) {
      console.log('❌ No submissions found in database!');
      return;
    }

    console.log(`Found ${submissions.length} submission(s):\n`);
    console.log('='.repeat(80));

    submissions.forEach((sub, index) => {
      console.log(`\n${index + 1}. ${sub.teamName}`);
      console.log(`   User: ${sub.user.username} (${sub.user.clerkId})`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Formation: ${sub.formation}`);
      console.log(`   Submitted: ${sub.submittedAt.toISOString()}`);
      console.log(`   Players (${sub.players.length}):`);
      
      sub.players.forEach((p) => {
        console.log(`     ${p.position}. ${p.player.name} (${p.player.position})`);
      });
      
      console.log('='.repeat(80));
    });

    // Count by status
    const statusCounts = submissions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('\n📊 Status summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n');
  } catch (error) {
    console.error('Error checking submissions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

checkSubmissions();
