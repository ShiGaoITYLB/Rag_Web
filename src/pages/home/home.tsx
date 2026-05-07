import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { useChat } from "@ai-sdk/react"
import { TextStreamChatTransport, type UIMessage } from "ai"
import {
  ArrowUp,
  BookOpen,
  Bot,
  LoaderCircle,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  Sparkles,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useNavigate } from "react-router-dom"

import { AppSidebar } from "@/components/app-sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Textarea } from "@/components/ui/textarea"
import {
  buildApiUrl,
  getErrorMessage,
  isNotFoundError,
  sessionsApi,
  type HistoryMessage,
  type Hit,
  type SessionSummary,
} from "@/lib/api"
import { getAuthHeaders, logoutUser } from "@/lib/auth"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "rag-web-session-id"

const starterPrompts = [
  "总结公司知识库里最重要的三条信息",
  "根据现有文档梳理一个结构化概览",
  "如果文档没提到，直接给我一个专业建议",
  "帮我解释最近上传资料里的关键概念",
]

function mapHistoryToMessages(history: HistoryMessage[]): UIMessage[] {
  return history.map((item) => ({
    id: crypto.randomUUID(),
    role: item.role,
    parts: [{ type: "text", text: item.content }],
  }))
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
}

function Composer({
  input,
  isSending,
  onChange,
  onSubmit,
  onKeyDown,
  compact = false,
}: {
  input: string
  isSending: boolean
  onChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  compact?: boolean
}) {
  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "mx-auto w-full overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_18px_70px_rgba(15,23,42,0.10)] transition",
        compact ? "max-w-4xl" : "max-w-[740px]",
      )}
    >
      <div className="px-5 pt-5">
        <Textarea
          value={input}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="有问题，尽管问"
          className={cn(
            "resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-7 text-foreground shadow-none placeholder:text-muted-foreground/90 focus-visible:ring-0",
            compact ? "min-h-[84px]" : "min-h-[96px]",
          )}
        />
      </div>
      <div className="flex items-center justify-between px-5 pb-4 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-sm text-foreground transition hover:bg-muted"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            进阶思考
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
          >
            <Mic className="h-4 w-4" />
          </button>
          <Button
            type="submit"
            size="icon"
            disabled={isSending || !input.trim()}
            className="h-11 w-11 bg-foreground text-white hover:bg-foreground/90"
          >
            {isSending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </form>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { currentUser, setCurrentUser } = useAuth()
  const [input, setInput] = useState("")
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [sessionsError, setSessionsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [latestSummary, setLatestSummary] = useState<string | null>(null)
  const [latestHits, setLatestHits] = useState<Hit[]>([])
  const [taskState, setTaskState] = useState<Record<string, unknown>>({})
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: buildApiUrl("/ask"),
        prepareSendMessagesRequest: async ({ body, messages, headers }) => {
          const requestHeaders = new Headers(headers)
          const authHeaders = await getAuthHeaders()
          const requestBody = body && typeof body === "object" ? (body as Record<string, unknown>) : {}
          const requestSessionId =
            typeof requestBody.session_id === "string" && requestBody.session_id.trim()
              ? requestBody.session_id
              : sessionId

          Object.entries(authHeaders).forEach(([key, value]) => {
            requestHeaders.set(key, value)
          })

          return {
            headers: requestHeaders,
            body: {
              ...requestBody,
              messages,
              session_id: requestSessionId,
              k: 4,
            },
          }
        },
      }),
    [sessionId],
  )

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    error: chatError,
    clearError,
  } = useChat({
    transport,
    onFinish: () => {
      if (!sessionId) {
        return
      }

      void (async () => {
        try {
          const data = await sessionsApi.get(sessionId)
          setMessages(mapHistoryToMessages(data.history))
          setLatestSummary(data.latest_summary ?? null)
          setLatestHits(data.latest_hits ?? [])
          setTaskState(data.task_state ?? {})
          await loadSessions(sessionId)
        } catch (loadError) {
          setError(getErrorMessage(loadError))
        }
      })()
    },
    onError: (streamError) => {
      setError(streamError.message)
    },
  })

  const isSending = status === "submitted" || status === "streaming"
  const hasConversation = messages.length > 0
  const combinedError = error ?? chatError?.message ?? null

  async function loadSessions(preferredSessionId?: string | null) {
    setSessionsLoading(true)
    setSessionsError(null)
    try {
      const data = await sessionsApi.list()
      setSessions(data)

      const nextSessionId = preferredSessionId === undefined ? sessionId : preferredSessionId
      if (nextSessionId && !data.some((item) => item.session_id === nextSessionId)) {
        setSessionId(null)
        setMessages([])
        setLatestSummary(null)
        setLatestHits([])
        setTaskState({})
        window.localStorage.removeItem(STORAGE_KEY)
      }
    } catch (loadError) {
      setSessionsError(getErrorMessage(loadError))
      setError(getErrorMessage(loadError))
    } finally {
      setSessionsLoading(false)
    }
  }

  async function loadSessionDetail(targetSessionId: string) {
    const data = await sessionsApi.get(targetSessionId)
    setSessionId(data.session_id)
    setMessages(mapHistoryToMessages(data.history))
    setLatestSummary(data.latest_summary ?? null)
    setLatestHits(data.latest_hits ?? [])
    setTaskState(data.task_state ?? {})
    window.localStorage.setItem(STORAGE_KEY, data.session_id)
    if (window.location.hash !== `#${data.session_id}`) {
      window.history.replaceState(null, "", `#${data.session_id}`)
    }
  }

  async function createSession() {
    const data = await sessionsApi.create({ history: [] })
    setSessionId(data.session_id)
    setMessages([])
    setLatestSummary(data.latest_summary ?? null)
    setLatestHits(data.latest_hits ?? [])
    setTaskState(data.task_state ?? {})
    window.localStorage.setItem(STORAGE_KEY, data.session_id)
    window.history.replaceState(null, "", `#${data.session_id}`)
    await loadSessions(data.session_id)
    return data.session_id
  }

  async function handleSelectSession(targetSessionId: string) {
    if (targetSessionId === sessionId || isSending) {
      return
    }

    setError(null)
    clearError()
    try {
      await loadSessionDetail(targetSessionId)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    }
  }

  async function handleDeleteSession(targetSessionId: string) {
    if (isSending) {
      return
    }

    setError(null)
    clearError()
    try {
      await sessionsApi.delete(targetSessionId)
      setSessions((current) => current.filter((item) => item.session_id !== targetSessionId))

      if (targetSessionId === sessionId) {
        setSessionId(null)
        setMessages([])
        setLatestSummary(null)
        setLatestHits([])
        setTaskState({})
        window.localStorage.removeItem(STORAGE_KEY)
        if (window.location.hash) {
          window.history.replaceState(null, "", window.location.pathname)
        }
      }

      await loadSessions(targetSessionId === sessionId ? null : sessionId)
    } catch (deleteError) {
      setError(getErrorMessage(deleteError))
    }
  }

  function handleNewChat() {
    if (isSending) {
      return
    }

    setSessionId(null)
    setInput("")
    setMessages([])
    setLatestSummary(null)
    setLatestHits([])
    setTaskState({})
    setError(null)
    clearError()
    window.localStorage.removeItem(STORAGE_KEY)
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname)
    }
  }

  useEffect(() => {
    const hashSessionId = window.location.hash.replace(/^#/, "").trim()
    const savedSessionId = window.localStorage.getItem(STORAGE_KEY)
    const initialSessionId = hashSessionId || savedSessionId

    void (async () => {
      await loadSessions(initialSessionId)
      if (!initialSessionId) {
        return
      }

      try {
        await loadSessionDetail(initialSessionId)
      } catch (loadError) {
        if (isNotFoundError(loadError)) {
          window.localStorage.removeItem(STORAGE_KEY)
          if (window.location.hash) {
            window.history.replaceState(null, "", window.location.pathname)
          }
          return
        }
        setError(getErrorMessage(loadError))
      }
    })()
  }, [])

  useEffect(() => {
    const handleHashChange = () => {
      const targetSessionId = window.location.hash.replace(/^#/, "").trim()
      if (!targetSessionId || targetSessionId === sessionId || isSending) {
        return
      }

      void (async () => {
        setError(null)
        clearError()
        try {
          await loadSessionDetail(targetSessionId)
        } catch (loadError) {
          setError(getErrorMessage(loadError))
        }
      })()
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [clearError, isSending, sessionId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: isSending ? "auto" : "smooth" })
  }, [isSending, messages])

  async function sendQuestion(question: string) {
    const trimmed = question.trim()
    if (!trimmed || isSending) {
      return
    }

    setError(null)
    clearError()

    let activeSessionId = sessionId
    try {
      if (!activeSessionId) {
        activeSessionId = await createSession()
      }

      setSessionId(activeSessionId)
      setLatestHits([])
      setInput("")
      await sendMessage(
        { text: trimmed },
        {
          body: {
            session_id: activeSessionId,
            k: 4,
          },
        },
      )
    } catch (requestError) {
      setError(getErrorMessage(requestError) || "请求失败，请检查后端服务是否正常运行。")
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendQuestion(input)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void sendQuestion(input)
    }
  }

  async function handleLogout() {
    await logoutUser()
    setSessionId(null)
    setSessions([])
    setInput("")
    setMessages([])
    setLatestSummary(null)
    setLatestHits([])
    setTaskState({})
    setError(null)
    setSessionsError(null)
    window.localStorage.removeItem(STORAGE_KEY)
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname)
    }
    setCurrentUser(null)
    navigate("/login", { replace: true })
  }

  function handleLogin() {
    navigate("/login")
  }

  return (
    <SidebarProvider>
      <AppSidebar
        sessions={sessions}
        isLoading={sessionsLoading}
        hasError={Boolean(sessionsError)}
        activeSessionId={sessionId}
        user={
          currentUser
            ? {
                name: currentUser.name,
                email: currentUser.email,
                avatar: currentUser.image,
              }
            : undefined
        }
        onLogin={handleLogin}
        onLogout={handleLogout}
        onSelectSession={(targetSessionId) => {
          void handleSelectSession(targetSessionId)
        }}
        onDeleteSession={(targetSessionId) => {
          void handleDeleteSession(targetSessionId)
        }}
        onNewChat={handleNewChat}
      />
      <SidebarInset className="h-screen overflow-hidden bg-[linear-gradient(180deg,#f6f5f2_0%,#fbfbf8_100%)] text-foreground">
        <header className="flex items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9" />

          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full bg-white/80 text-muted-foreground shadow-sm"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </header>

        {!hasConversation ? (
          <div className="flex flex-1 flex-col px-5 pb-10 pt-6 lg:px-10">
            <Card className="relative flex flex-1 flex-col items-center justify-center overflow-hidden border-black/5 bg-transparent shadow-none">
              <div className="pointer-events-none absolute inset-x-[18%] top-[18%] h-44 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_70%)] blur-3xl" />
              <div className="relative z-10 w-full max-w-[980px] text-center">
                <div className="mb-8">
                  <Badge variant="outline" className="border-black/8 bg-white/80 px-3 py-1 tracking-[0.24em] text-muted-foreground">
                    KNOWLEDGE ASSISTANT
                  </Badge>
                  <h1 className="mt-5 text-[40px] font-semibold tracking-tight text-foreground lg:text-[52px]">
                    我们先从哪里开始呢？
                  </h1>
                </div>

                <Composer
                  input={input}
                  isSending={isSending}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onKeyDown={handleKeyDown}
                />

                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/85 shadow-sm"
                  >
                    <BookOpen className="h-4 w-4" />
                    公司知识库
                  </Button>
                  {starterPrompts.map((prompt) => (
                    <Button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      variant="outline"
                      className="rounded-full border-black/7 bg-white/65 text-foreground/80"
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>

                {combinedError ? <p className="mt-6 text-sm text-red-600">{combinedError}</p> : null}
              </div>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex flex-1 gap-6 px-5 pb-40 pt-2 lg:px-8">
              <section className="min-w-0 flex-1">
                <ScrollArea className="h-[calc(100vh-220px)] pr-2">
                  <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 pb-12 pt-4">
                    {messages.map((message, index) => {
                      const content = getMessageText(message)
                      const isStreamingAssistant =
                        message.role === "assistant" &&
                        message.id === messages[messages.length - 1]?.id &&
                        isSending
                      const hits =
                        message.role === "assistant" && index === messages.length - 1
                          ? latestHits
                          : []

                      return (
                        <article
                          key={message.id}
                          className={cn(
                            "flex gap-4",
                            message.role === "user" ? "justify-end" : "justify-start",
                          )}
                        >
                          {message.role === "assistant" ? (
                            <>
                              <Avatar className="mt-1 h-9 w-9 border border-black/8 bg-white shadow-sm">
                                <AvatarFallback>
                                  <Bot className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 max-w-[780px]">
                                <Card className="border-black/6 bg-white/70 shadow-sm backdrop-blur-sm">
                                  <CardContent className="p-5">
                                    {isStreamingAssistant ? (
                                      <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
                                        {content}
                                      </div>
                                    ) : (
                                      <div className="prose prose-slate max-w-none text-[15px] leading-8 prose-headings:font-semibold prose-p:my-0 prose-pre:rounded-2xl prose-pre:bg-[#f3f2ef]">
                                        <ReactMarkdown>{content}</ReactMarkdown>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                                {isStreamingAssistant ? (
                                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                    正在生成
                                  </div>
                                ) : null}
                                {hits.length ? (
                                  <div className="mt-6 grid gap-3 md:grid-cols-2">
                                    {hits.map((hit) => (
                                      <Card
                                        key={`${message.id}-${hit.rank}`}
                                        className="border-black/7 bg-white/85 shadow-sm"
                                      >
                                        <CardHeader className="pb-3">
                                          <CardDescription className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]">
                                            <BookOpen className="h-3.5 w-3.5" />
                                            来源 {hit.rank}
                                          </CardDescription>
                                          <CardTitle className="truncate text-sm">{hit.source}</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <p className="line-clamp-4 text-sm leading-6 text-muted-foreground">
                                            {hit.content_preview}
                                          </p>
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <Card className="max-w-[720px] border-0 bg-[#ecebe6] shadow-sm">
                              <CardContent className="px-5 py-4 text-[15px] leading-7">{content}</CardContent>
                            </Card>
                          )}
                        </article>
                      )
                    })}
                    <div ref={messageEndRef} />
                  </div>
                </ScrollArea>
              </section>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,rgba(251,251,248,0),rgba(251,251,248,0.92)_18%,rgba(251,251,248,1)_60%)] px-5 pb-6 pt-12 lg:px-8">
              <div className="pointer-events-auto mx-auto max-w-4xl">
                {combinedError ? <p className="mb-3 text-sm text-red-600">{combinedError}</p> : null}
                <Composer
                  input={input}
                  isSending={isSending}
                  onChange={setInput}
                  onSubmit={handleSubmit}
                  onKeyDown={handleKeyDown}
                  compact
                />
              </div>
            </div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}
