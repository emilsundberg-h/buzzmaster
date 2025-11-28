import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

// PATCH /api/simulator/submissions/[id] - Update submission status (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !['PENDING', 'APPROVED', 'USED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // TODO: Add admin check here
    // For now, any authenticated user can update

    const { id } = await params;
    const submission = await db.simulatorSubmission.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            username: true,
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
    });

    return NextResponse.json({ submission });
  } catch (error) {
    console.error('Error updating simulator submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/simulator/submissions/[id] - Delete own submission
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { id } = await params;

    // Check if submission belongs to user
    const submission = await db.simulatorSubmission.findUnique({
      where: { id },
    });

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Don't allow deleting approved or used submissions
    if (submission.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Cannot delete submissions that have been approved or used' 
      }, { status: 400 });
    }

    await db.simulatorSubmission.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting simulator submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
