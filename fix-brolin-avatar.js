// Quick script to fix Brolin's avatar typo
// Run with: node fix-brolin-avatar.js

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  console.log('Fixing Brolin avatar typo...')
  
  // Find all users with 'borlin' in their avatarKey
  const usersToFix = await prisma.user.findMany({
    where: {
      avatarKey: {
        contains: 'borlin'
      }
    }
  })
  
  console.log(`Found ${usersToFix.length} users with 'borlin' typo`)
  
  // Fix each one
  for (const user of usersToFix) {
    const oldKey = user.avatarKey
    const newKey = oldKey.replace('borlin', 'brolin')
    
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarKey: newKey }
    })
    
    console.log(`Fixed user ${user.username}: ${oldKey} -> ${newKey}`)
  }
  
  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
