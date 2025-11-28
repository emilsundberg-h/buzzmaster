import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

// Dev mode - set to true to bypass authentication
const DEV_MODE =
  process.env.NODE_ENV === "development" && process.env.DEV_MODE === "true";

export async function requireUser() {
  console.log('🔐 requireUser called, DEV_MODE:', DEV_MODE);
  console.log('🔐 Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    DEV_MODE: process.env.DEV_MODE,
    hasClerkPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasClerkSecretKey: !!process.env.CLERK_SECRET_KEY,
  });

  if (DEV_MODE) {
    // In dev mode, try to get userId from header
    try {
      const headersList = await headers();
      const devUserId = headersList.get("x-dev-user-id");
      if (devUserId) {
        console.log('🔐 Using dev user ID from header:', devUserId);
        return devUserId;
      }
    } catch (error) {
      console.log('🔐 Error getting headers in dev mode:', error);
      // Ignore errors when headers() is not available
    }
    // Fallback to default dev user ID
    console.log('🔐 Using default dev user ID');
    return "dev-user-id";
  }

  try {
    console.log('🔐 Calling Clerk auth()...');
    const { userId } = await auth();
    console.log('🔐 Clerk auth() returned userId:', userId);

    if (!userId) {
      console.error('🔐 No userId from Clerk auth - user not authenticated');
      throw new Error("Unauthorized");
    }

    console.log('🔐 requireUser successful, userId:', userId);
    return userId;
  } catch (error) {
    console.error('🔐 Error in requireUser:', error);
    throw error;
  }
}

export async function requireAdmin() {
  if (DEV_MODE) {
    return { userId: "dev-admin-id", email: "emil.sundberg@stena.com" };
  }

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    console.log('🔐 requireAdmin check: No userId');
    throw new Error("Unauthorized");
  }

  // Try to get email from sessionClaims first
  let email = sessionClaims?.email as string | undefined;

  // If not in sessionClaims, fetch from Clerk API
  if (!email) {
    console.log('🔐 Email not in sessionClaims, fetching from Clerk API...');
    try {
      const { clerkClient } = await import('@clerk/nextjs/server');
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress;
      console.log('🔐 Fetched email from Clerk:', email);
    } catch (error) {
      console.error('🔐 Failed to fetch user from Clerk:', error);
    }
  }

  console.log('🔐 requireAdmin check:', { 
    userId, 
    email,
    allowlist: process.env.ADMIN_EMAIL_ALLOWLIST 
  });

  if (!email || !isAdmin(email)) {
    console.log('🔐 Admin check failed - email not in allowlist:', email);
    throw new Error("Forbidden");
  }

  console.log('🔐 Admin check passed!');
  return { userId, email };
}

export function isAdmin(email: string): boolean {
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST?.split(",") || [];
  return allowlist.includes(email);
}
