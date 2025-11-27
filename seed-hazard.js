const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Set database URL with absolute path
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function seedHazard() {
  console.log('🌱 Seeding Eden Hazard...\n');
  
  const player = {
    name: 'Eden Hazard',
    position: 'MID',
    imageKey: 'footballers/hazard_mid.webp'
  };
  
  // Check if player already exists
  const existing = await prisma.player.findFirst({
    where: { name: player.name }
  });
  
  if (existing) {
    console.log(`⏭️  ${player.name} already exists`);
    console.log(`   ID: ${existing.id}`);
    console.log(`   Position: ${existing.position}`);
    console.log(`   ImageKey: ${existing.imageKey}`);
    return;
  }
  
  try {
    const created = await prisma.player.create({
      data: {
        name: player.name,
        position: player.position,
        imageKey: player.imageKey,
        type: 'FOOTBALLER',
        category: 'AWARD'
      }
    });
    
    console.log(`✅ Added: ${player.name} (${player.position})`);
    console.log(`   ID: ${created.id}`);
    console.log(`   ImageKey: ${created.imageKey}`);
    console.log(`\n🎉 Eden Hazard is now available as a trophy and for the simulator!`);
  } catch (error) {
    console.error(`❌ Failed to add ${player.name}:`, error.message);
  }
}

seedHazard()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
