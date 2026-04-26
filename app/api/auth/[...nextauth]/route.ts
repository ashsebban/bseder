// NextAuth v5 catch-all route handler.
// Handles GET and POST for all auth endpoints:
//   /api/auth/signin, /api/auth/callback/google, /api/auth/session, etc.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
