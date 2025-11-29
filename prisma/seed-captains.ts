import { PrismaClient, PlayerPosition } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const db = new PrismaClient()

// Load name-values.json
interface PlayerData {
  correctName: string
  fileName: string
  position: string
  value: number
}

const nameValuesPath = path.join(__dirname, '../name-values.json')
const nameValuesData: PlayerData[] = JSON.parse(fs.readFileSync(nameValuesPath, 'utf-8'))

// Create map for quick lookup by filename
const nameValuesMap = new Map<string, PlayerData>()
nameValuesData.forEach(player => {
  nameValuesMap.set(player.fileName, player)
})

async function main() {
  console.log('Seeding captain avatars as players...')

  // Create 8 captain players matching the 8 avatars (01-08)
  // Get data from name-values.json
  const captainFilenames = [
    { key: '01', filename: 'baggio_fwd_c.webp' },
    { key: '02', filename: 'beckham_mid_c.webp' },
    { key: '03', filename: 'brolin_mid_c.webp' },
    { key: '04', filename: 'giroud_fwd_c.webp' },
    { key: '05', filename: 'ronaldinho_mid_c.webp' },
    { key: '06', filename: 'ronaldo_fwd_c.webp' },
    { key: '07', filename: 'totti_mid_c.webp' },
    { key: '08', filename: 'zidane_mid_c.webp' },
  ]

  const captains = captainFilenames.map(c => {
    const data = nameValuesMap.get(c.filename)
    if (!data) {
      console.warn(`⚠️  No data found in name-values.json for captain: ${c.filename}`)
      return null
    }
    
    // Convert position string to enum
    let position: PlayerPosition
    switch (data.position.toUpperCase()) {
      case 'GK':
        position = PlayerPosition.GK
        break
      case 'DEF':
        position = PlayerPosition.DEF
        break
      case 'MID':
        position = PlayerPosition.MID
        break
      case 'FWD':
        position = PlayerPosition.FWD
        break
      default:
        console.warn(`⚠️  Invalid position for ${c.filename}: ${data.position}`)
        return null
    }
    
    return {
      key: c.key,
      name: data.correctName,
      position: position,
      filename: c.filename, // Keep .webp extension
      value: data.value
    }
  }).filter(c => c !== null) as Array<{ key: string; name: string; position: PlayerPosition; filename: string; value: number }>

  for (const captain of captains) {
    // Check if captain already exists
    const existing = await db.player.findFirst({
      where: { 
        name: captain.name,
        category: 'CAPTAIN'
      }
    })

    if (existing) {
      console.log(`Captain ${captain.name} already exists - updating to ensure correct data`)
      // Update existing captain to ensure correct imageKey and position
      await db.player.update({
        where: { id: existing.id },
        data: {
          position: captain.position,
          imageKey: `avatars/${captain.filename}`,
        }
      })
      console.log(`Updated captain: ${captain.name} (${captain.filename}) - Value: ${captain.value}`)
      continue
    }

    // Create captain player
    await db.player.create({
      data: {
        name: captain.name,
        position: captain.position,
        type: 'FOOTBALLER',
        category: 'CAPTAIN',
        imageKey: `avatars/${captain.filename}`,
      }
    })

    console.log(`Created captain: ${captain.name} (${captain.filename}) - Value: ${captain.value}`)
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
