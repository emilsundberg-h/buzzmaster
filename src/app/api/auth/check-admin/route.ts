import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      return NextResponse.json({ isAdmin: false });
    }

    // Try to get email from sessionClaims first
    let email = sessionClaims?.email as string | undefined;

    // If not in sessionClaims, fetch from Clerk API
    if (!email) {
      try {
        const { clerkClient } = await import('@clerk/nextjs/server');
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      } catch (error) {
        console.error('Failed to fetch user from Clerk:', error);
      }
    }

    const isAdminUser = email ? isAdmin(email) : false;

    return NextResponse.json({ 
      isAdmin: isAdminUser,
      userId,
      email 
    });
  } catch (error) {
    console.error("Check admin error:", error);
    return NextResponse.json({ isAdmin: false });
  }
}
