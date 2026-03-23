import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";

const DEV_MODE =
  process.env.NODE_ENV === "development" && process.env.DEV_MODE === "true";

export async function requireUser() {
  if (DEV_MODE) {
    try {
      const headersList = await headers();
      const devUserId = headersList.get("x-dev-user-id");
      if (devUserId) return devUserId;
    } catch {
      // headers() not available
    }
    return "dev-user-id";
  }

  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function requireAdmin() {
  if (DEV_MODE) {
    return { userId: "dev-admin-id", email: "emil.sundberg@stena.com" };
  }

  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");

  let email = sessionClaims?.email as string | undefined;

  if (!email) {
    try {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      email = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress;
    } catch (error) {
      console.error("Failed to fetch user from Clerk:", error);
    }
  }

  if (!email || !isAdmin(email)) throw new Error("Forbidden");
  return { userId, email };
}

export function isAdmin(email: string): boolean {
  const allowlist = process.env.ADMIN_EMAIL_ALLOWLIST?.split(",") || [];
  return allowlist.includes(email);
}
