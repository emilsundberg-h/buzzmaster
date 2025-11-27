import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

async function fixRevealedFootballers() {
  console.log('🔧 Fixing revealed status for footballers and actors...\n');

  try {
    // Update all UserPlayer records where the player is a FOOTBALLER or ACTOR
    // and revealed is currently false
    const result = await prisma.userPlayer.updateMany({
      where: {
        revealed: false,
        player: {
          type: {
            in: ['FOOTBALLER', 'ACTOR']
          }
        }
      },
      data: {
        revealed: true
      }
    });

    console.log(`✅ Updated ${result.count} player records`);
    console.log('   - Footballers and actors are now visible');
    console.log('   - Festival artists remain hidden\n');

  } catch (error) {
    console.error('❌ Error updating players:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRevealedFootballers()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
