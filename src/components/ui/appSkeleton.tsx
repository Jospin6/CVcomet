import { Skeleton } from "@/components/ui/skeleton"
import { SidebarProvider } from "../sidebar-provider"
import { SidebarTrigger } from "../sidebar-trigger"
import { Bot, Search, User } from "lucide-react"

export function AppSkeleton() {
  return (
    <div className="flex h-screen bg-[#282828]">
      {/* Sidebar - #1a1a1a */}
      <div className="hidden md:flex w-64 flex-col gap-8 border-r border-gray-800 bg-[#1a1a1a] p-5">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full bg-gray-800" />
          <Skeleton className="h-5 w-32 bg-gray-800" />
        </div>

        {/* Menu principal */}
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md p-2">
              <Skeleton className="h-5 w-5 bg-gray-800" />
              <Skeleton className="h-4 w-28 bg-gray-800" />
            </div>
          ))}
        </div>

        {/* Section inférieure */}
        <div className="mt-auto space-y-4">
          <Skeleton className="h-10 w-full rounded-md bg-gray-800" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-gray-800" />
            <Skeleton className="h-4 w-20 bg-gray-800" />
          </div>
        </div>
      </div>

      {/* Zone centrale - #282828 */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#282828] px-6">
          <div className="md:hidden">
            <Skeleton className="h-6 w-6 bg-gray-700" />
          </div>
          <Skeleton className="h-6 w-32 bg-gray-700" />
          <Skeleton className="h-8 w-8 rounded-full bg-gray-700" />
        </div>

        {/* Zone de contenu principal - Centré */}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6">
            {/* Champ de recherche central */}
            <div className="relative">
              <Skeleton className="h-14 w-full rounded-lg bg-gray-700" />
              <div className="absolute right-3 top-3">
                <Skeleton className="h-8 w-8 rounded-md bg-gray-800" />
              </div>
            </div>

            {/* Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-sm bg-gray-700" />
                  <Skeleton className="h-4 w-40 bg-gray-700" />
                </div>
              ))}
            </div>

            {/* Message d'aide */}
            <div className="pt-8 text-center">
              <Skeleton className="mx-auto h-4 w-64 bg-gray-800" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}