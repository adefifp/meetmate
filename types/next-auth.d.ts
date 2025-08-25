// types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"]; // keeps name/email/image typed
  }

  interface User {
    id: string;
  }
}