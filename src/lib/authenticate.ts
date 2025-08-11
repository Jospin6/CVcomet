'use server';

import { signIn } from './auth';
import { AuthError } from 'next-auth';
import prisma from "../../prisma/prisma";
import { redirect, RedirectType } from 'next/navigation';
import z from 'zod';
import { authSchema } from '@/helpers/schema';


export async function authenticate(
  _prevState: string | undefined,
  formData: z.infer<typeof authSchema> & { redirect?: string }
) {
  const login = authSchema.safeParse(formData);
  if (login.error) return login.error.errors[0].message;
  try {
    await signIn('credentials', {
      redirect: false,
      ...login.data,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return error.cause?.err?.message || 'Invalid email or password';
        default:
          return 'Something went wrong during sign-in.';
      }
    }
    return 'An unexpected error occurred. Please try again.';
  }
  const user = await prisma.user.findFirst({
    where: {
      email: login.data.email as string
    },
  });

  if (user) {
    return redirect('/', RedirectType.replace);
  }
  return 'User not found';  
}
