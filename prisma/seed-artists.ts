import { PrismaClient, PlayerPosition, PlayerType, PlayerCategory } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Parse artist name from filename
function parseArtistFile(filename: string): string | null {
  // Support .png, .PNG, .webp, .jpg, .jpeg
  const validExtensions = ['.png', '.PNG', '.webp', '.jpg', '.jpeg', '.tiff'];
  const ext = validExtensions.find(e => filename.endsWith(e));
  
  if (!ext) return null;
  
  const nameWithoutExt = filename.replace(ext, '');
  
  // Convert kebab-case or snake_case to Title Case
  const name = nameWithoutExt
    .replace(/[-_]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name;
}

async function seedArtists() {
  console.log('🎵 Seeding artists...\n');
  
  // Delete existing FESTIVAL and ACTOR players
  await prisma.userPlayer.deleteMany({
    where: {
      player: {
        OR: [
          { type: PlayerType.FESTIVAL },
          { type: PlayerType.ACTOR }
        ]
      }
    }
  });
  
  await prisma.player.deleteMany({
    where: {
      OR: [
        { type: PlayerType.FESTIVAL },
        { type: PlayerType.ACTOR }
      ]
    }
  });
  
  const festivalPath = path.join(__dirname, '../public/festival');
  const actorsPath = path.join(__dirname, '../public/actors');
  
  // Seed festival artists (musicians)
  console.log('🎤 Adding festival artists...');
  const festivalFiles = fs.readdirSync(festivalPath).filter(f => f !== '.DS_Store');
  let festivalCount = 0;
  
  for (const file of festivalFiles) {
    const name = parseArtistFile(file);
    if (!name) continue;
    
    await prisma.player.create({
      data: {
        name: name,
        position: PlayerPosition.ANY,
        imageKey: `festival/${file}`,
        type: PlayerType.FESTIVAL,
        category: PlayerCategory.AWARD,
      },
    });
    
    festivalCount++;
    console.log(`  ✓ ${name}`);
  }
  
  console.log(`\n✅ Added ${festivalCount} festival artists\n`);
  
  // Seed actors
  console.log('🎬 Adding actors...');
  const actorFiles = fs.readdirSync(actorsPath).filter(f => f !== '.DS_Store');
  let actorCount = 0;
  
  for (const file of actorFiles) {
    const name = parseArtistFile(file);
    if (!name) continue;
    
    await prisma.player.create({
      data: {
        name: name,
        position: PlayerPosition.ANY,
        imageKey: `actors/${file}`,
        type: PlayerType.ACTOR,
        category: PlayerCategory.AWARD,
      },
    });
    
    actorCount++;
    console.log(`  ✓ ${name}`);
  }
  
  console.log(`\n✅ Added ${actorCount} actors\n`);
  console.log(`🎉 Total artists seeded: ${festivalCount + actorCount}`);
}

seedArtists()
  .catch((e) => {
    console.error('❌ Error seeding artists:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
