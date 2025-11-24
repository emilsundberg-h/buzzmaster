// Fix Brolin's imageKey in Player table
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Fixing Brolin player imageKey...')
  
  // Find all players with 'borlin' in their imageKey
  const playersToFix = await prisma.player.findMany({
    where: {
      imageKey: {
        contains: 'borlin'
      }
    }
  })
  
  console.log(`Found ${playersToFix.length} players with 'borlin' typo`)
  
  // Fix each one
  for (const player of playersToFix) {
    const oldKey = player.imageKey
    const newKey = oldKey.replace('borlin', 'brolin')
    
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
