// Show all users and their avatarKeys
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      avatarKey: true,
      clerkId: true
    }
  })
  
  console.log('All users:')
  users.forEach(user => {
    console.log(`- ${user.username} (${user.clerkId}): ${user.avatarKey}`)
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
