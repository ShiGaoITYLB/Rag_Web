"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { type SessionSummary } from "@/lib/api"
import { AudioLinesIcon, TerminalIcon, TerminalSquareIcon, BotIcon, BookOpenIcon, Settings2Icon, MessageSquareIcon, Loader2Icon } from "lucide-react"

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "",
  },
  teams: [
    // {
    //   name: "Acme Inc",
    //   logo: (
    //     <GalleryVerticalEndIcon
    //     />
    //   ),
    //   plan: "Enterprise",
    // },
    {
      name: "Acme Corp.",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Playground",
      url: "#",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: (
        <BotIcon
        />
      ),
      items: [
        {
          title: "Genesis",
          url: "#",
        },
        {
          title: "Explorer",
          url: "#",
        },
        {
          title: "Quantum",
          url: "#",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: (
        <BookOpenIcon
        />
      ),
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
  ],
}

export function AppSidebar({
  sessions = [],
  isLoading = false,
  hasError = false,
  activeSessionId = null,
  onSelectSession,
  user,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessions?: SessionSummary[]
  isLoading?: boolean
  hasError?: boolean
  activeSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  user?: {
    name: string
    email: string
    avatar?: string | null
  }
  onLogout?: () => void
}) {
  const sessionItems = React.useMemo(
    () =>
      sessions.map((session) => ({
        id: session.session_id,
        name:
          session.last_message_preview?.trim() ||
          `Session ${session.session_id.slice(0, 8)}`,
        icon: <MessageSquareIcon />,
        onSelect: () => onSelectSession?.(session.session_id),
      })),
    [onSelectSession, sessions]
  )

  const sessionProjects = isLoading
    ? [
        {
          id: "loading",
          name: "Loading sessions...",
          icon: <Loader2Icon className="animate-spin" />,
        },
      ]
    : sessionItems

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects
          label="历史对话"
          projects={sessionProjects}
          emptyMessage={hasError ? "Sessions unavailable" : "No sessions"}
          activeProjectId={activeSessionId}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user ?? data.user} onLogout={onLogout} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
