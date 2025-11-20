import { PrismaClient, PlayerPosition, PlayerType, PlayerCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Parse player name and position from filename
function parsePlayerFile(filename: string): { name: string; position: PlayerPosition } | null {
  if (!filename.endsWith('.webp')) return null;
  
  const nameWithoutExt = filename.replace('.webp', '');
  const parts = nameWithoutExt.split('_');
  
  if (parts.length < 2) return null;
  
  const positionStr = parts[parts.length - 1].toUpperCase();
  const name = parts.slice(0, -1).join(' ');
  
  let position: PlayerPosition;
  switch (positionStr) {
    case 'GK':
      position = PlayerPosition.GK;
      break;
    case 'DEF':
      position = PlayerPosition.DEF;
      break;
    case 'MID':
      position = PlayerPosition.MID;
      break;
    case 'FWD':
      position = PlayerPosition.FWD;
      break;
    default:
      return null;
  }
  
  // Capitalize name properly
  const capitalizedName = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  return { name: capitalizedName, position };
}

async function seedPlayers() {
  console.log('🌱 Seeding players...\n');
  
  // Clear existing players
  await prisma.teamPosition.deleteMany();
  await prisma.userPlayer.deleteMany();
  await prisma.userTeam.deleteMany();
  await prisma.player.deleteMany();
  
  const startingPackPath = path.join(process.cwd(), '../public/starting_pack');
  const footballersPath = path.join(process.cwd(), '../public/footballers');
  
  // Seed starting pack
  console.log('📦 Adding starting pack players...');
  const startingPackFiles = fs.readdirSync(startingPackPath);
  let startingCount = 0;
  
  for (const file of startingPackFiles) {
    const parsed = parsePlayerFile(file);
    if (!parsed) continue;
    
    await prisma.player.create({
      data: {
        name: parsed.name,
        position: parsed.position,
        imageKey: `starting_pack/${file}`,
        type: PlayerType.FOOTBALLER,
        category: PlayerCategory.STARTER,
      },
    });
    
    startingCount++;
    console.log(`  ✓ ${parsed.name} (${parsed.position})`);
  }
  
  console.log(`\n✅ Added ${startingCount} starting pack players\n`);
  
  // Seed award footballers
  console.log('🏆 Adding award footballers...');
  const footballerFiles = fs.readdirSync(footballersPath).filter(f => f !== '.DS_Store');
  let awardCount = 0;
  
  for (const file of footballerFiles) {
    const parsed = parsePlayerFile(file);
    if (!parsed) continue;
    
    await prisma.player.create({
      data: {
        name: parsed.name,
        position: parsed.position,
        imageKey: `footballers/${file}`,
        type: PlayerType.FOOTBALLER,
        category: PlayerCategory.AWARD,
      },
    });
    
    awardCount++;
    console.log(`  ✓ ${parsed.name} (${parsed.position})`);
  }
  
  console.log(`\n✅ Added ${awardCount} award footballers\n`);
  console.log(`🎉 Total players seeded: ${startingCount + awardCount}`);
}

seedPlayers()
  .catch((e) => {
    console.error('❌ Error seeding players:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
