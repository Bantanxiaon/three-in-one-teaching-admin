import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authorizeCredentials } from "@/lib/credential-auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/rbac";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  trustHost: true,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/zh/login"
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      authorize: (credentials, request) => authorizeCredentials(credentials, request)
    })
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role ?? "STUDENT") as Role;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }

      return session;
    }
  }
});
