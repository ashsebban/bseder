// NextAuth v5 configuration.
// - Google OAuth: sign in with Google account
// - Credentials: email + bcrypt password
// - JWT sessions: browser auth without relying on NextAuth adapter tables
// - Callbacks: sync app-specific user fields onto the session token
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  findActiveUserByEmail,
  findActiveUserById,
  normalizeEmail,
  releaseDeletedEmailIfNeeded,
} from "@/lib/active-user";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  providers: [
    // ── Google OAuth ───────────────────────────────────────────────────────
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),

    // ── Email + Password ───────────────────────────────────────────────────
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = normalizeEmail(credentials.email as string);

        const user = await findActiveUserByEmail(email);

        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );

        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          image: user.avatarUrl,
        };
      },
    }),
  ],

  session: {
    strategy: "jwt", // JWT sessions work well with Credentials provider
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true;
      if (!user.email) return false;
      const email = normalizeEmail(user.email);

      await releaseDeletedEmailIfNeeded(email);

      const existingUser = await findActiveUserByEmail(email);
      let dbUserId = existingUser?.id;

      if (!existingUser) {
        const createdUser = await db.user.create({
          data: {
            email,
            displayName: user.name ?? undefined,
            avatarUrl: user.image ?? undefined,
            onboardingComplete: false,
          },
        });
        dbUserId = createdUser.id;

        await db.adminEvent.create({
          data: {
            type: "signup",
            userEmail: email,
            details: "Google signup",
          },
        });
      } else if (
        existingUser.displayName !== (user.name ?? null) ||
        existingUser.avatarUrl !== (user.image ?? null)
      ) {
        await db.user.update({
          where: { id: existingUser.id },
          data: {
            displayName: user.name ?? existingUser.displayName,
            avatarUrl: user.image ?? existingUser.avatarUrl,
          },
        });
        dbUserId = existingUser.id;
      }

      if (dbUserId && account.providerAccountId) {
        await db.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
          },
          create: {
            userId: dbUserId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token ?? undefined,
            access_token: account.access_token ?? undefined,
            expires_at: account.expires_at ?? undefined,
            token_type: account.token_type ?? undefined,
            scope: account.scope ?? undefined,
            id_token: account.id_token ?? undefined,
            session_state: typeof account.session_state === "string" ? account.session_state : undefined,
          },
          update: {
            userId: dbUserId,
            type: account.type,
            refresh_token: account.refresh_token ?? undefined,
            access_token: account.access_token ?? undefined,
            expires_at: account.expires_at ?? undefined,
            token_type: account.token_type ?? undefined,
            scope: account.scope ?? undefined,
            id_token: account.id_token ?? undefined,
            session_state: typeof account.session_state === "string" ? account.session_state : undefined,
          },
        });
      }

      return true;
    },
    // Attach app-specific fields to the JWT token on sign-in
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update") {
        const updatedUser = session?.user;

        if (typeof session?.onboardingComplete === "boolean") {
          token.onboardingComplete = session.onboardingComplete;
        } else if (typeof updatedUser?.onboardingComplete === "boolean") {
          token.onboardingComplete = updatedUser.onboardingComplete;
        }

        if (typeof session?.displayName === "string") {
          token.displayName = session.displayName;
          token.name = session.displayName;
        } else if (typeof updatedUser?.displayName === "string") {
          token.displayName = updatedUser.displayName;
          token.name = updatedUser.displayName;
        }

        if (typeof session?.avatarUrl === "string") {
          token.avatarUrl = session.avatarUrl;
          token.picture = session.avatarUrl;
        } else if (typeof updatedUser?.avatarUrl === "string") {
          token.avatarUrl = updatedUser.avatarUrl;
          token.picture = updatedUser.avatarUrl;
        }

        return token;
      }

      if (user) {
        const dbUser = user.email
          ? await findActiveUserByEmail(user.email)
          : user.id
            ? await findActiveUserById(user.id)
            : null;

        if (dbUser) {
          token.id = dbUser.id;
          token.email = dbUser.email;
          token.name = dbUser.displayName ?? user.name ?? null;
          token.picture = dbUser.avatarUrl ?? user.image ?? null;
          token.isAdmin = dbUser.isAdmin;
          token.onboardingComplete = dbUser.onboardingComplete;
          token.avatarUrl = dbUser.avatarUrl ?? null;
          token.displayName = dbUser.displayName ?? null;
        }
      }
      return token;
    },
    // Expose id and isAdmin on the session object used in components
    async session({ session, token }) {
      if (token) {
        session.user.id = (token.id as string) ?? "";
        session.user.isAdmin = Boolean(token.isAdmin);
        session.user.onboardingComplete = Boolean(token.onboardingComplete);
        session.user.avatarUrl = (token.avatarUrl as string | null) ?? null;
        session.user.displayName = (token.displayName as string | null) ?? null;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/sign-in", // auth errors go back to sign-in with ?error=...
  },

  events: {
    async signIn({ user }) {
      const dbUser = user.email
        ? await findActiveUserByEmail(user.email)
        : user.id
          ? await findActiveUserById(user.id)
          : null;

      await db.adminEvent.create({
        data: {
          type: "signin",
          userEmail: user.email ? normalizeEmail(user.email) : undefined,
          userId: dbUser?.id,
        },
      });
    },
  },
});
