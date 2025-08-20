// types/better-auth.d.ts
import "better-auth";

declare module "better-auth" {
  interface User {
    role: string;
  }

  interface Session {
    user: User;
  }
}