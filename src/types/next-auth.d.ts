// Extend NextAuth's built-in Session and JWT types so TypeScript
// knows about our custom fields (id, isAdmin, etc.)
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      isAdmin: boolean;
      onboardingComplete: boolean;
      avatarUrl: string | null;
      displayName: string | null;
    };
  }
}
