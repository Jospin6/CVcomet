"use client";

// Better Auth manages its reactive session without a NextAuth provider.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
