// src/app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      server: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER!, 
          pass: process.env.EMAIL_PASS!,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: { strategy: "database" },
  debug: true,
  pages: {
    signIn: "/auth/signin",  
    verifyRequest: "/auth/verify-request",
  },
  logger: {
    error(code, ...rest) {
      console.error("NextAuth error", code, ...rest);
    },
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user){
        session.user.id = user.id
      }
      return session;
    },
  },
};
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
