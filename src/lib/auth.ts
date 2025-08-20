import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "../../prisma/prisma";
import { nextCookies } from "better-auth/next-js";

 
export const auth = betterAuth({
  socialProviders: {
        google: { 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
        }, 
    },
  database: prismaAdapter(prisma, {
        provider: "postgresql",
         
    }),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expires: 10 * 365 * 24 * 60 * 60, 
    updateAge: 24 * 60 * 60, 
  },
  cookies: {
    sessionCookie: {
      maxAge: 10 * 365 * 24 * 60 * 60,
    }
  },
  plugins: [nextCookies()],
});

