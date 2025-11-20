import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTrophies() {
  console.log('🏆 Creating trophies from AWARD players...\n');
  
  // Get all AWARD category players
  const awardPlayers = await prisma.player.findMany({
    where: {
      category: 'AWARD',
      type: 'FOOTBALLER'
    }
  });

  console.log(`Found ${awardPlayers.length} AWARD players to convert to trophies\n`);

  let createdCount = 0;

  for (const player of awardPlayers) {
    // Check if trophy already exists
    const existing = await prisma.trophy.findFirst({
      where: {
        name: player.name
      }
    });

    if (existing) {
      console.log(`  ⏭️  ${player.name} already exists as trophy`);
      continue;
    }

    // Create trophy from player
    await prisma.trophy.create({
      data: {
        name: player.name,
        imageKey: player.imageKey,
        description: `${player.position} - Fotbollsspelare`
      }
    });

    createdCount++;
    console.log(`  ✓ ${player.name} (${player.position})`);
  }

  console.log(`\n✅ Created ${createdCount} new trophies from AWARD players`);
  console.log(`🎉 Total trophies available: ${createdCount + (awardPlayers.length - createdCount)}`);
}

seedTrophies()
  .catch((e) => {
    console.error('❌ Error seeding trophies:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
