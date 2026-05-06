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
import { AudioLinesIcon, TerminalIcon, TerminalSquareIcon, BotIcon, BookOpenIcon, Settings2Icon, MessageSquareIcon, Loader2Icon, MessageSquarePlusIcon } from "lucide-react"

// This is sample data.
const data = {
  user: {
    name: "请登录",
    email: "",
    avatar: "",
  },
  teams: [
    {
      name: "知识库助手",
      logo: (
        <AudioLinesIcon
        />
      ),
      plan: "标准版",
    },
    {
      name: "研发工作台",
      logo: (
        <TerminalIcon
        />
      ),
      plan: "免费版",
    },
  ],
  navMain: [
    {
      title: "对话工作台",
      url: "#",
      icon: (
        <TerminalSquareIcon
        />
      ),
      isActive: true,
      items: [
        {
          title: "历史记录",
          url: "#",
        },
        {
          title: "收藏会话",
          url: "#",
        },
        {
          title: "对话设置",
          url: "#",
        },
      ],
    },
    {
      title: "模型",
      url: "#",
      icon: (
        <BotIcon
        />
      ),
      items: [
        {
          title: "通用模型",
          url: "#",
        },
        {
          title: "探索模型",
          url: "#",
        },
        {
          title: "推理模型",
          url: "#",
        },
      ],
    },
    {
      title: "文档",
      url: "#",
      icon: (
        <BookOpenIcon
        />
      ),
      items: [
        {
          title: "产品介绍",
          url: "#",
        },
        {
          title: "快速开始",
          url: "#",
        },
        {
          title: "使用教程",
          url: "#",
        },
        {
          title: "更新日志",
          url: "#",
        },
      ],
    },
    {
      title: "设置",
      url: "#",
      icon: (
        <Settings2Icon
        />
      ),
      items: [
        {
          title: "通用设置",
          url: "#",
        },
        {
          title: "团队管理",
          url: "#",
        },
        {
          title: "账单",
          url: "#",
        },
        {
          title: "额度限制",
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
  onDeleteSession,
  onNewChat,
  user,
  onLogin,
  onLogout,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  sessions?: SessionSummary[]
  isLoading?: boolean
  hasError?: boolean
  activeSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onNewChat?: () => void
  user?: {
    name: string
    email: string
    avatar?: string | null
  }
  onLogin?: () => void
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
        onDelete: () => onDeleteSession?.(session.session_id),
      })),
    [onDeleteSession, onSelectSession, sessions]
  )

  const navMainItems = React.useMemo(
    () => [
      {
        title: "新聊天",
        url: "#",
        icon: <MessageSquarePlusIcon />,
        onClick: onNewChat,
      },
      ...data.navMain,
    ],
    [onNewChat]
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
  const sidebarUser = user ?? data.user

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavProjects
          label="历史对话"
          projects={sessionProjects}
          emptyMessage={hasError ? "Sessions unavailable" : "No sessions"}
          activeProjectId={activeSessionId}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={sidebarUser}
          isLoggedIn={Boolean(user)}
          onLogin={onLogin}
          onLogout={onLogout}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
