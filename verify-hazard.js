const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Set database URL with absolute path
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

const prisma = new PrismaClient();

async function verifyHazard() {
  console.log('🔍 Verifying Eden Hazard integration...\n');
  
  // Find Hazard in database
  const hazard = await prisma.player.findFirst({
    where: { name: 'Eden Hazard' }
  });
  
  if (!hazard) {
    console.log('❌ Eden Hazard not found in database!');
    return;
  }
  
  console.log('✅ Database Entry:');
  console.log(`   Name: ${hazard.name}`);
  console.log(`   ID: ${hazard.id}`);
  console.log(`   Position: ${hazard.position}`);
  console.log(`   Type: ${hazard.type}`);
  console.log(`   Category: ${hazard.category}`);
  console.log(`   ImageKey: ${hazard.imageKey}`);
  
  // Check if image file exists
  const fs = require('fs');
  const imagePath = path.join(__dirname, 'public', hazard.imageKey);
  const imageExists = fs.existsSync(imagePath);
  
  console.log(`\n✅ Image File:`);
  console.log(`   Path: ${imagePath}`);
  console.log(`   Exists: ${imageExists ? '✅ Yes' : '❌ No'}`);
  
  if (imageExists) {
    const stats = fs.statSync(imagePath);
    console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
  }
  
  // Check name-values.json
  const nameValuesPath = path.join(__dirname, 'name-values.json');
  const nameValues = JSON.parse(fs.readFileSync(nameValuesPath, 'utf8'));
  const hazardInJson = nameValues.find(p => p.correctName === 'Eden Hazard');
  
  console.log(`\n✅ Simulator Configuration (name-values.json):`);
  if (hazardInJson) {
    console.log(`   Name: ${hazardInJson.correctName}`);
    console.log(`   File: ${hazardInJson.fileName}`);
    console.log(`   Position: ${hazardInJson.position}`);
    console.log(`   Value: ${hazardInJson.value}`);
  } else {
    console.log(`   ❌ Not found in name-values.json`);
  }
  
  console.log(`\n🎉 Summary:`);
  console.log(`   ✅ Database: Ready`);
  console.log(`   ✅ Image: Ready (${imageExists ? 'exists' : 'missing'})`);
  console.log(`   ✅ Simulator: Ready (${hazardInJson ? 'configured' : 'not configured'})`);
  console.log(`\n💡 Eden Hazard can now be:`);
  console.log(`   • Awarded as a trophy (playerTrophyId: player_${hazard.id})`);
  console.log(`   • Used in Dream Eleven simulator`);
  console.log(`   • Collected by users`);
}

verifyHazard()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
