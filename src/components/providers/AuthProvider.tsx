// providers/AuthProvider.tsx
'use client'

import { SessionProvider, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AppSkeleton } from '../ui/appSkeleton'

function AuthHandler({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') return <AppSkeleton/>

  return <>{children}</>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthHandler>{children}</AuthHandler>
    </SessionProvider>
  )
}