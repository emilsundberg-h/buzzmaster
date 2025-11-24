// Fix TIFF references to PNG in Player table
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Fixing TIFF to PNG references...')
  
  // Find all players with .tiff in their imageKey
  const playersToFix = await prisma.player.findMany({
    where: {
      imageKey: {
        contains: '.tiff'
      }
    }
  })
  
  console.log(`Found ${playersToFix.length} players with .tiff extension`)
  
  // Fix each one
  for (const player of playersToFix) {
    const oldKey = player.imageKey
    const newKey = oldKey.replace('.tiff', '.png')
    
    await prisma.player.update({
      where: { id: player.id },
      data: { imageKey: newKey }
    })
    
    console.log(`Fixed player ${player.name}: ${oldKey} -> ${newKey}`)
  }
  
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
