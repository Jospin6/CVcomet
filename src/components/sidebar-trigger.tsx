// components/sidebar-trigger.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { useSidebar } from "./sidebar-provider"

export function SidebarTrigger({ 
  className = "",
  children 
}: {
  className?: string
  children?: React.ReactNode
}) {
  const { toggle } = useSidebar()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`hover:bg-transparent hover:text-white ${className}`}
      onClick={toggle}
    >
      {children || <Menu className="h-5 w-5" />}
    </Button>
  )
}