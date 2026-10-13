'use server';

import { signIn } from '@/server/users';
import { redirect } from 'next/navigation';
import z from 'zod';
import { authSchema } from '@/helpers/schema';
import { safeRedirectPath } from '@/lib/utils';

export async function authenticate(
  _prevState: string | undefined,
  formData: z.infer<typeof authSchema> & { redirect?: string }
) {
  const result = await signIn(formData.email, formData.password);
  if (!result.success) return result.message;
  const target = formData.redirect;
  redirect(safeRedirectPath(target));
}
