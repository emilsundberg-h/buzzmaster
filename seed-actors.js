const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Set database URL with absolute path
const dbPath = path.join(__dirname, 'prisma', 'dev.db')
process.env.DATABASE_URL = `file:${dbPath}`

const db = new PrismaClient()

// Format actor name from filename
function formatActorName(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.png$/, '')
  
  // Replace underscores with spaces
  const nameWithSpaces = nameWithoutExt.replace(/_/g, ' ')
  
  // Split into words and capitalize each
  const words = nameWithSpaces.split(' ')
  
  return words.map(word => {
    // Handle special cases like "DiCaprio"
    if (word === 'diCaprio') return 'DiCaprio'
    if (word === 'l') return 'L.' // For Samuel L. Jackson
    
    // Standard capitalization
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  }).join(' ')
}

async function seedActors() {
  console.log('🎬 Starting actor seeding...')
  
  // Get all files from actors folder
  const actorsPath = path.join(__dirname, 'public', 'actors')
  const files = fs.readdirSync(actorsPath)
    .filter(file => file.match(/\.png$/))
    .filter(file => file !== '.DS_Store')
  
  console.log(`Found ${files.length} actor images`)
  
  let created = 0
  let existing = 0
  
  for (const file of files) {
    const actorName = formatActorName(file)
    const imageKey = `actors/${file}`
    
    // Check if actor already exists
    const existingActor = await db.player.findFirst({
      where: {
        name: actorName,
        type: 'ACTOR'
      }
    })
    
    if (existingActor) {
      console.log(`  ⏭️  ${actorName} already exists`)
      existing++
      continue
    }
    
    // Create new actor
    await db.player.create({
      data: {
        name: actorName,
        position: 'ANY', // Actors don't have positions
        imageKey: imageKey,
        type: 'ACTOR',
        category: 'AWARD' // Actors are won as awards
      }
    })
    
    console.log(`  ✅ Created ${actorName} (${imageKey})`)
    created++
  }
  
  console.log(`\n🎉 Seeding complete!`)
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Existing: ${existing}`)
  console.log(`   📊 Total: ${created + existing}`)
}

seedActors()
  .catch(e => {
    console.error('Error seeding actors:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
