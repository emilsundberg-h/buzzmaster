import { PrismaClient, PlayerPosition, PlayerType, PlayerCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Load name-values.json
interface PlayerData {
  correctName: string;
  fileName: string;
  position: string;
  value: number;
}

const nameValuesPath = path.join(__dirname, '../name-values.json');
const nameValuesData: PlayerData[] = JSON.parse(fs.readFileSync(nameValuesPath, 'utf-8'));

// Create map for quick lookup by filename
const nameValuesMap = new Map<string, PlayerData>();
nameValuesData.forEach(player => {
  nameValuesMap.set(player.fileName, player);
});

// Get player data from name-values.json by filename
function getPlayerData(filename: string): { name: string; position: PlayerPosition } | null {
  if (!filename.endsWith('.webp')) return null;
  
  const playerData = nameValuesMap.get(filename);
  if (!playerData) {
    console.warn(`⚠️  No data found in name-values.json for: ${filename}`);
    return null;
  }
  
  let position: PlayerPosition;
  switch (playerData.position.toUpperCase()) {
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
      console.warn(`⚠️  Invalid position for ${filename}: ${playerData.position}`);
      return null;
  }
  
  return { name: playerData.correctName, position };
}

async function seedPlayers() {
  console.log('🌱 Seeding players...\n');
  
  // Clear existing players (CASCADE will handle related records)
  // First delete junction tables
  await prisma.teamPosition.deleteMany();
  await prisma.userPlayer.deleteMany();
  await prisma.userTeam.deleteMany();
  // Then delete players (this will cascade to simulator submissions via onDelete: Cascade)
  await prisma.player.deleteMany();
  
  const startingPackPath = path.join(__dirname, '../public/starting_pack');
  const footballersPath = path.join(__dirname, '../public/footballers');
  
  // Seed starting pack
  console.log('📦 Adding starting pack players...');
  const startingPackFiles = fs.readdirSync(startingPackPath);
  let startingCount = 0;
  
  for (const file of startingPackFiles) {
    const playerData = getPlayerData(file);
    if (!playerData) continue;
    
    await prisma.player.create({
      data: {
        name: playerData.name,
        position: playerData.position,
        imageKey: `starting_pack/${file}`,
        type: PlayerType.FOOTBALLER,
        category: PlayerCategory.STARTER,
      },
    });
    
    startingCount++;
    console.log(`  ✓ ${playerData.name} (${playerData.position})`);
  }
  
  console.log(`\n✅ Added ${startingCount} starting pack players\n`);
  
  // Seed award footballers
  console.log('🏆 Adding award footballers...');
  const footballerFiles = fs.readdirSync(footballersPath).filter(f => f !== '.DS_Store');
  let awardCount = 0;
  
  for (const file of footballerFiles) {
    const playerData = getPlayerData(file);
    if (!playerData) continue;
    
    await prisma.player.create({
      data: {
        name: playerData.name,
        position: playerData.position,
        imageKey: `footballers/${file}`,
        type: PlayerType.FOOTBALLER,
        category: PlayerCategory.AWARD,
      },
    });
    
    awardCount++;
    console.log(`  ✓ ${playerData.name} (${playerData.position})`);
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
