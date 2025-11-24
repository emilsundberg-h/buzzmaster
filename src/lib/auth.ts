import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

// Dev mode - set to true to bypass authentication
const DEV_MODE =
  process.env.NODE_ENV === "development" && process.env.DEV_MODE === "true";

export async function requireUser() {
  if (DEV_MODE) {
    // In dev mode, try to get userId from header
    try {
      const headersList = await headers();
      const devUserId = headersList.get("x-dev-user-id");
      if (devUserId) {
        return devUserId;
      }
    } catch (error) {
      // Ignore errors when headers() is not available
    }
    // Fallback to default dev user ID
    return "dev-user-id";
  }

  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  return userId;
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
