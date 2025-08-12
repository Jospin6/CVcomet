import { Skeleton } from "@/components/ui/skeleton"
import { SidebarProvider } from "../sidebar-provider"
import { SidebarTrigger } from "../sidebar-trigger"

export function AppSkeleton() {
  return (
    <SidebarProvider className="flex">
      {/* Sidebar Skeleton */}
      <div className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 border-r bg-[#1a1a1a] p-4">
        <div className="flex items-center space-x-4 pb-6">
          <Skeleton className="h-8 w-8 rounded-full bg-gray-600" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[120px] bg-gray-600" />
            <Skeleton className="h-3 w-[80px] bg-gray-600" />
          </div>
        </div>
        
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <Skeleton className="h-5 w-5 bg-gray-600" />
              <Skeleton className="h-4 w-[140px] bg-gray-600" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Skeleton */}
      <main className="w-full bg-[#282828] min-h-screen md:ml-64">
        {/* Header */}
        <div className="w-full flex justify-between items-center h-16 px-6 border-b border-gray-700">
          <div className="flex items-center space-x-4 md:hidden">
            <SidebarTrigger>
              <Skeleton className="h-6 w-6 bg-gray-600" />
            </SidebarTrigger>
          </div>
          
          {/* Account Nav Skeleton */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-8 w-8 rounded-full bg-gray-600" />
            <Skeleton className="h-4 w-[100px] bg-gray-600" />
          </div>
        </div>

        {/* Content Area */}
        <div className="md:w-10/12 md:m-auto w-full px-4 md:px-0 py-8">
          {/* Page Title Skeleton */}
          <div className="mb-8">
            <Skeleton className="h-8 w-[200px] bg-gray-600 mb-2" />
            <Skeleton className="h-4 w-[300px] bg-gray-600" />
          </div>
          
          {/* Content Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-700 p-6">
                <Skeleton className="h-5 w-[120px] bg-gray-600 mb-4" />
                <Skeleton className="h-3 w-full bg-gray-600 mb-2" />
                <Skeleton className="h-3 w-4/5 bg-gray-600 mb-2" />
                <Skeleton className="h-3 w-3/5 bg-gray-600 mb-6" />
                <Skeleton className="h-8 w-full bg-gray-600" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}