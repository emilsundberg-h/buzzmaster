import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  console.log('Seeding captain avatars as players...')

  // Create 8 captain players matching the 8 avatars (01-08)
  const captains = [
    { key: '01', name: 'Baggio', position: 'FWD', filename: 'baggio_fwd_c' },
    { key: '02', name: 'Beckham', position: 'MID', filename: 'beckham_mid_c' },
    { key: '03', name: 'Brolin', position: 'MID', filename: 'brolin_mid_c' },
    { key: '04', name: 'Giroud', position: 'FWD', filename: 'giroud_fwd_c' },
    { key: '05', name: 'Ronaldinho', position: 'MID', filename: 'ronaldinho_mid_c' },
    { key: '06', name: 'Ronaldo', position: 'FWD', filename: 'ronaldo_fwd_c' },
    { key: '07', name: 'Totti', position: 'MID', filename: 'totti_mid_c' },
    { key: '08', name: 'Zidane', position: 'MID', filename: 'zidane_mid_c' },
  ]

  for (const captain of captains) {
    // Check if captain already exists
    const existing = await db.player.findFirst({
      where: { 
        name: captain.name,
        category: 'CAPTAIN'
      }
    })

    if (existing) {
      console.log(`Captain ${captain.name} already exists`)
      continue
    }

    // Create captain player
    await db.player.create({
      data: {
        name: captain.name,
        position: captain.position,
        type: 'FOOTBALLER',
        category: 'CAPTAIN',
        imageKey: `avatars/${captain.filename}.webp`,
      }
    })

    console.log(`Created captain: ${captain.name} (${captain.filename})`)
  }

  console.log('Captain seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
