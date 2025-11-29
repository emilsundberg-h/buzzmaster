import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

// POST /api/simulator/submissions - Submit Dream Eleven to simulator
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { teamName } = body;

    if (!teamName) {
      return NextResponse.json({ error: 'Team name required' }, { status: 400 });
    }

    // Find user
    const user = await db.user.findUnique({
      where: { clerkId: userId },
      include: {
        team: {
          include: {
            positions: {
              include: { player: true },
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.team || user.team.positions.length !== 11) {
      return NextResponse.json({ 
        error: 'You must have a complete Dream Eleven (11 players) before submitting' 
      }, { status: 400 });
    }

    // Check if user already has any submission (not USED)
    const existingSubmissions = await db.simulatorSubmission.findMany({
      where: {
        userId: user.id,
        status: {
          not: 'USED',
        },
      },
    });

    // Delete all previous non-USED submissions
    if (existingSubmissions.length > 0) {
      await db.simulatorSubmission.deleteMany({
        where: {
          userId: user.id,
          status: {
            not: 'USED',
          },
        },
      });
    }

    // Create new submission (automatically approved)
    const submission = await db.simulatorSubmission.create({
      data: {
        userId: user.id,
        teamName,
        formation: user.team.formation,
        status: 'APPROVED', // Auto-approve submissions
        players: {
          create: user.team.positions.map((pos) => ({
            playerId: pos.playerId,
            position: pos.position,
          })),
        },
      },
      include: {
        players: {
          include: {
            player: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error('Error creating simulator submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/simulator/submissions - Get all submissions (admin) or user's submissions
export async function GET(req: NextRequest) {
  try {
    console.log('🎮 GET /api/simulator/submissions called');
    
    const { userId } = await auth();
    console.log('🎮 Clerk userId:', userId);
    
    if (!userId) {
      console.error('🎮 No userId - unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const userOnly = searchParams.get('userOnly') === 'true';
    console.log('🎮 Query params - status:', status, 'userOnly:', userOnly);

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      console.error('🎮 User not found in database for clerkId:', userId);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('🎮 User found:', user.username);

    const whereClause: any = {};

    if (userOnly) {
      whereClause.userId = user.id;
    }

    if (status) {
      whereClause.status = status;
    }

    console.log('🎮 Querying with whereClause:', JSON.stringify(whereClause));

    const submissions = await db.simulatorSubmission.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            username: true,
            avatarKey: true,
          },
        },
        players: {
          include: {
            player: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        submittedAt: 'desc',
      },
    });

    console.log('🎮 Found', submissions.length, 'submissions');
    return NextResponse.json({ submissions });
  } catch (error) {
    console.error('🎮 Error fetching simulator submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
