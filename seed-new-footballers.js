const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// New footballers - positions based on actual filenames
const newFootballers = [
  { name: 'Sergio Agüero', position: 'FWD', imageKey: 'footballers/agüero_fwd.webp' },
  { name: 'Marko Arnautović', position: 'FWD', imageKey: 'footballers/arnautovic_fwd.webp' },
  { name: 'Roberto Baggio', position: 'FWD', imageKey: 'footballers/baggio_fwd.webp' },
  { name: 'Gareth Bale', position: 'MID', imageKey: 'footballers/bale_mid.webp' },
  { name: 'Joey Barton', position: 'MID', imageKey: 'footballers/barton_mid.webp' },
  { name: 'Gabriel Batistuta', position: 'FWD', imageKey: 'footballers/batistuta_fwd.webp' },
  { name: 'Nicklas Bendtner', position: 'FWD', imageKey: 'footballers/bendtner_fwd.webp' },
  { name: 'Edgar Davids', position: 'MID', imageKey: 'footballers/davids_mid.webp' },
  { name: 'Alessandro Del Piero', position: 'FWD', imageKey: 'footballers/del_piero_fwd.webp' },
  { name: 'Edin Džeko', position: 'FWD', imageKey: 'footballers/dzeko_fwd.webp' },
  { name: 'Antoine Griezmann', position: 'MID', imageKey: 'footballers/griezmann_mid.webp' },
  { name: 'José María Gutiérrez', position: 'MID', imageKey: 'footballers/guti_mid.webp' },
  { name: 'Filippo Inzaghi', position: 'FWD', imageKey: 'footballers/inzaghi_fwd.webp' },
  { name: 'David Luiz', position: 'DEF', imageKey: 'footballers/luiz_def.webp' },
  { name: 'Claude Makélélé', position: 'MID', imageKey: 'footballers/makelele_mid.webp' },
  { name: 'Pavel Nedvěd', position: 'MID', imageKey: 'footballers/nedved_mid.webp' },
  { name: 'Raúl González', position: 'FWD', imageKey: 'footballers/raul_fwd.webp' },
  { name: 'Franck Ribéry', position: 'MID', imageKey: 'footballers/ribery_mid.webp' },
  { name: 'Luca Toni', position: 'FWD', imageKey: 'footballers/toni_fwd.webp' }
];

async function seedNewFootballers() {
  console.log('🌱 Seeding new footballers...\n');
  
  let added = 0;
  let skipped = 0;
  
  for (const player of newFootballers) {
    // Check if player already exists
    const existing = await prisma.player.findFirst({
      where: { name: player.name }
    });
    
    if (existing) {
      console.log(`⏭️  ${player.name} already exists, skipping`);
      skipped++;
      continue;
    }
    
    try {
      await prisma.player.create({
        data: {
          name: player.name,
          position: player.position,
          imageKey: player.imageKey,
          type: 'FOOTBALLER',
          category: 'AWARD'
        }
      });
      
      added++;
      console.log(`✅ Added: ${player.name} (${player.position})`);
    } catch (error) {
      console.error(`❌ Failed to add ${player.name}:`, error.message);
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Added: ${added} players`);
  console.log(`   ⏭️  Skipped: ${skipped} players (already exist)`);
  console.log(`   📝 Total in list: ${newFootballers.length}`);
}

seedNewFootballers()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
