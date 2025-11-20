const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

// Set database URL with absolute path
const dbPath = path.join(__dirname, 'prisma', 'dev.db')
process.env.DATABASE_URL = `file:${dbPath}`

const db = new PrismaClient()

// Format artist name from filename
function formatArtistName(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.(png|PNG|tiff|TIFF)$/, '')
  
  // Special case for e-type (keep hyphen)
  if (nameWithoutExt.toLowerCase() === 'e-type') {
    return 'e-type'
  }
  
  // Remove hyphens and split into words
  const words = nameWithoutExt.replace(/-/g, ' ').split(' ')
  
  // Capitalize each word
  return words.map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ')
}

async function seedArtists() {
  console.log('🎵 Starting artist seeding...')
  
  // Get all files from festival folder
  const festivalPath = path.join(__dirname, 'public', 'festival')
  const files = fs.readdirSync(festivalPath)
    .filter(file => file.match(/\.(png|PNG|tiff|TIFF)$/))
    .filter(file => file !== '.DS_Store')
  
  console.log(`Found ${files.length} artist images`)
  
  let created = 0
  let existing = 0
  
  for (const file of files) {
    const artistName = formatArtistName(file)
    const imageKey = `festival/${file}`
    
    // Check if artist already exists
    const existingArtist = await db.player.findFirst({
      where: {
        name: artistName,
        type: 'FESTIVAL'
      }
    })
    
    if (existingArtist) {
      console.log(`  ⏭️  ${artistName} already exists`)
      existing++
      continue
    }
    
    // Create new artist
    await db.player.create({
      data: {
        name: artistName,
        position: 'ANY', // Festival artists don't have positions
        imageKey: imageKey,
        type: 'FESTIVAL',
        category: 'AWARD' // Artists are won as awards
      }
    })
    
    console.log(`  ✅ Created ${artistName} (${imageKey})`)
    created++
  }
  
  console.log(`\n🎉 Seeding complete!`)
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Existing: ${existing}`)
  console.log(`   📊 Total: ${created + existing}`)
}

seedArtists()
  .catch(e => {
    console.error('Error seeding artists:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
