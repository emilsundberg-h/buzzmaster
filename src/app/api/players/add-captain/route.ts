import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Endpoint för att ge användare sin captain baserat på avatar
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Hämta användaren
    const user = await db.user.findUnique({
      where: { clerkId: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Map avatarKey till captain namn
    const captainMap: Record<string, string> = {
      '01': 'Roberto Baggio',
      '02': 'David Beckham',
      '03': 'Tomas Brolin',
      '04': 'Oliver Giroud',
      '05': 'Ronaldinho',
      '06': 'Ronaldo',
      '07': 'Francesco Totti',
      '08': 'Zinedine Zidane',
    };

    const captainName = captainMap[user.avatarKey];
    if (!captainName) {
      return NextResponse.json({ error: 'No captain for this avatar' }, { status: 400 });
    }

    // Hitta captain i databasen
    const captain = await db.player.findFirst({
      where: {
        name: captainName,
        category: 'CAPTAIN'
      }
    });

    if (!captain) {
      return NextResponse.json({ 
        error: `Captain ${captainName} not found in database. Run seed script first.` 
      }, { status: 404 });
    }

    // Kolla om användaren redan har captain
    const existing = await db.userPlayer.findFirst({
      where: {
        userId: user.id,
        playerId: captain.id
      }
    });

    if (existing) {
      return NextResponse.json({ 
        message: 'User already has this captain',
        captain: captain.name 
      });
    }

    // Ge captain till användaren
    await db.userPlayer.create({
      data: {
        userId: user.id,
        playerId: captain.id,
        revealed: true, // Captains are footballers and should be visible immediately
      }
    });

    return NextResponse.json({ 
      success: true,
      message: `Added captain ${captain.name} to user ${user.username}`,
      captain: captain.name
    });

  } catch (error) {
    console.error('Error adding captain:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
