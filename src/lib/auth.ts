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

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: new Headers() });
  return session?.user ?? null;
}












// import NextAuth from 'next-auth';
// import Credentials from 'next-auth/providers/credentials';
// import bcrypt from 'bcryptjs';
// import prisma from "../../prisma/prisma";
// import { User } from '@/redux/user/userSlice';
// import { PrismaAdapter } from "@auth/prisma-adapter"
// import GoogleProvider from "next-auth/providers/google";

// export const BASE_PATH = '/api/auth';

// declare module "next-auth" {
//   interface User {
//     role?: string;
//   }
//   interface Session {
//     user?: {
//       id?: string;
//       email?: string;
//       role?: string;
//       [key: string]: any;
//     };
//   }
// }

// declare module "next-auth" {
//   interface JWT {
//     id?: string;
//     email?: string;
//     role?: string;
//     [key: string]: any;
//   }
// }
 
// export const { handlers, signIn, auth } = NextAuth({
//   adapter: PrismaAdapter(prisma),
//   providers: [
//     GoogleProvider({
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//     }),
//     Credentials({
//       name: 'Credentials',
//       credentials: {
//         email: {},
//         password: {},
//       },
//       async authorize(credentials): Promise<User | null> {
//         try {
//           if (!credentials?.email || !credentials.password) {
//             return null;
//           }

//           const user = await prisma.user.findFirst({
//             where: { email: credentials.email },
//             select: {
//                 id: true,
//                 email: true,
//                 password: true,
//                 role: true,
//                 },
//           });

//           if (!user) {
//             return null;
//           }

//           const isCorrectPassword = await bcrypt.compare(
//             String(credentials.password),
//             user.password ?? ''
//           );
//           if (!isCorrectPassword) {
//             return null;
//           }

//           return {
//             email: user.email ?? '',
//             id: user.id,
//             role: user.role ?? 'USER',
//           };
//         } catch (error) {
//           if (error instanceof Error) {
//             console.error(error.message);
//           }
//           throw error;
//         }
//       },
//     }),
//   ],
//   session: {
//     strategy: 'jwt',
//     maxAge: 30 * 24 * 60 * 60, // 30 days
//     updateAge: 24 * 60 * 60, // 24 hours
//   },
//   callbacks: {
//     authorized({ auth, request: { nextUrl } }) {
//       const isLoggedIn = !!auth?.user;
//       const paths = ['/profil', '/templates', '/g', '/admin'];
//       const isProtected = paths.some((path) =>
//         nextUrl.pathname.startsWith(path)
//       );

//       if (isProtected && !isLoggedIn) {
//         const redirectUrl = new URL('/login', nextUrl.origin);
//         redirectUrl.searchParams.append('callbackUrl', nextUrl.href);
//         return Response.redirect(redirectUrl);
//       }
//       return true;
//     },
//     jwt: ({ token, user }) => {
//       if (user) {
//         return {
//           ...token,
//           id: user.id as string,
//           role: user.role,
//           email: user.email,
//         };
//       }
//       return token;
//     },

//     session: ({ session, token }) => {
//       return {
//         ...session,
//         user: {
//           ...session.user,
//           id: token.id as string,
//           role: token.role as string | undefined,
//           email: token.email,
//         },
//       };
//     },
//   },
//   basePath: BASE_PATH,
//   secret: process.env.NEXTAUTH_SECRET,
// })