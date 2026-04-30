"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { MoreHorizontalIcon, FolderIcon, ArrowRightIcon, Trash2Icon } from "lucide-react"

export function NavProjects({
  label = "Projects",
  projects,
  emptyMessage = "No projects",
  activeProjectId,
}: {
  label?: string
  projects: {
    id: string
    name: string
    icon: React.ReactNode
    onSelect?: () => void
  }[]
  emptyMessage?: string
  activeProjectId?: string | null
}) {
  const { isMobile } = useSidebar()
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {projects.length === 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-sidebar-foreground/70"
              disabled
            >
              <span>{emptyMessage}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
        {projects.map((item) => (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              isActive={item.id === activeProjectId}
              onClick={item.onSelect}
            >
              {item.icon}
              <span>{item.name}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuAction
                    showOnHover
                    className="aria-expanded:bg-muted"
                  />
                }
              >
                <MoreHorizontalIcon
                />
                <span className="sr-only">More</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-48 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <FolderIcon className="text-muted-foreground" />
                  <span>View {label.slice(0, -1) || label}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <ArrowRightIcon className="text-muted-foreground" />
                  <span>Share {label.slice(0, -1) || label}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Trash2Icon className="text-muted-foreground" />
                  <span>Delete {label.slice(0, -1) || label}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
        {projects.length > 0 && (
          <SidebarMenuItem>
            <SidebarMenuButton className="text-sidebar-foreground/70">
              <MoreHorizontalIcon className="text-sidebar-foreground/70" />
              <span>More</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
