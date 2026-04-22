import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { TextStreamChatTransport, type UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUp,
  BookOpen,
  Bot,
  Compass,
  FolderOpen,
  LibraryBig,
  LoaderCircle,
  MessageSquarePlus,
  Mic,
  MoreHorizontal,
  PanelLeft,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  buildApiUrl,
  getErrorMessage,
  sessionsApi,
  type HistoryMessage,
  type Hit,
  type SessionSummary,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "rag-web-session-id";

const starterPrompts = [
  "总结公司知识库里最重要的三条信息",
  "根据现有文档梳理一个结构化概览",
  "如果文档没提到，直接给我一个专业建议",
  "帮我解释最近上传资料里的关键概念",
];

const sidebarItems = [
  { icon: MessageSquarePlus, label: "新聊天" },
  { icon: Search, label: "搜索对话" },
  { icon: LibraryBig, label: "库" },
  { icon: Compass, label: "应用" },
  { icon: FolderOpen, label: "项目" },
];

function mapHistoryToMessages(history: HistoryMessage[]): UIMessage[] {
  return history.map((item) => ({
    id: crypto.randomUUID(),
    role: item.role,
    parts: [{ type: "text", text: item.content }],
  }));
}

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function buildSessionTitle(session: SessionSummary) {
  const preview = session.last_message_preview?.trim();
  if (preview) {
    return preview.slice(0, 28);
  }
  return "未命名会话";
}

function Composer({
  input,
  isSending,
  onChange,
  onSubmit,
  onKeyDown,
  compact = false,
}: {
  input: string;
  isSending: boolean;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  compact?: boolean;
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
  );
}

export default function App() {
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [latestSummary, setLatestSummary] = useState<string | null>(null);
  const [latestHits, setLatestHits] = useState<Hit[]>([]);
  const [taskState, setTaskState] = useState<Record<string, unknown>>({});
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const transport = useMemo(
    () =>
      new TextStreamChatTransport({
        api: buildApiUrl("/ask"),
        prepareSendMessagesRequest: ({ body, messages }) => ({
          body: {
            ...body,
            messages,
            session_id: sessionId,
            k: 4,
          },
        }),
      }),
    [sessionId],
  );

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
        return;
      }
      void (async () => {
        try {
          const data = await sessionsApi.get(sessionId);
          setMessages(mapHistoryToMessages(data.history));
          setLatestSummary(data.latest_summary ?? null);
          setLatestHits(data.latest_hits ?? []);
          setTaskState(data.task_state ?? {});
          await loadSessions(sessionId);
        } catch (loadError) {
          setError(getErrorMessage(loadError));
        }
      })();
    },
    onError: (streamError) => {
      setError(streamError.message);
    },
  });

  const isSending = status === "submitted" || status === "streaming";
  const hasConversation = messages.length > 0;
  const combinedError = error ?? chatError?.message ?? null;

  async function loadSessions(preferredSessionId?: string | null) {
    setSessionsLoading(true);
    try {
      const data = await sessionsApi.list();
      setSessions(data);

      const nextSessionId = preferredSessionId ?? sessionId;
      if (nextSessionId && !data.some((item) => item.session_id === nextSessionId)) {
        setSessionId(null);
        setMessages([]);
        setLatestSummary(null);
        setLatestHits([]);
        setTaskState({});
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setSessionsLoading(false);
    }
  }

  async function loadSessionDetail(targetSessionId: string) {
    const data = await sessionsApi.get(targetSessionId);
    setSessionId(data.session_id);
    setMessages(mapHistoryToMessages(data.history));
    setLatestSummary(data.latest_summary ?? null);
    setLatestHits(data.latest_hits ?? []);
    setTaskState(data.task_state ?? {});
    window.localStorage.setItem(STORAGE_KEY, data.session_id);
  }

  async function createSession() {
    const data = await sessionsApi.create({ history: [] });
    setSessionId(data.session_id);
    setMessages([]);
    setLatestSummary(data.latest_summary ?? null);
    setLatestHits(data.latest_hits ?? []);
    setTaskState(data.task_state ?? {});
    window.localStorage.setItem(STORAGE_KEY, data.session_id);
    await loadSessions(data.session_id);
    return data.session_id;
  }

  useEffect(() => {
    const savedSessionId = window.localStorage.getItem(STORAGE_KEY);
    void (async () => {
      await loadSessions(savedSessionId);
      if (savedSessionId) {
        try {
          await loadSessionDetail(savedSessionId);
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }
    })();
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: isSending ? "auto" : "smooth" });
  }, [messages, isSending]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError(null);
    clearError();

    let activeSessionId = sessionId;
    try {
      if (!activeSessionId) {
        activeSessionId = await createSession();
      }

      setSessionId(activeSessionId);
      setLatestHits([]);
      setInput("");
      await sendMessage(
        { text: trimmed },
        {
          body: {
            session_id: activeSessionId,
            k: 4,
          },
        },
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError) || "请求失败，请检查后端服务是否正常运行。");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendQuestion(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(input);
    }
  }

  async function handleNewChat() {
    if (isSending) {
      return;
    }
    setError(null);
    try {
      await createSession();
    } catch (createError) {
      setError(getErrorMessage(createError));
    }
  }

  async function handleSelectSession(targetSessionId: string) {
    if (targetSessionId === sessionId || isSending) {
      return;
    }
    setError(null);
    clearError();
    try {
      await loadSessionDetail(targetSessionId);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f5f2_0%,#fbfbf8_100%)] text-foreground">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "hidden border-r border-black/6 bg-[#f3f2ee]/90 transition-all duration-300 lg:flex",
            sidebarOpen ? "w-[260px]" : "w-[88px]",
          )}
        >
          <div className="flex h-full w-full flex-col px-3 pb-3 pt-4">
            <div className="mb-4 flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                {sidebarOpen ? <span className="text-sm font-semibold">Workspace</span> : null}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen((open) => !open)}
                className="h-8 w-8"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.label === "新聊天" ? () => void handleNewChat() : undefined}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-white/80"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {sidebarOpen ? <span>{item.label}</span> : null}
                </button>
              ))}
            </div>

            <div className={cn("mt-6", !sidebarOpen && "hidden")}>
              <div className="flex items-center justify-between px-3">
                <p className="text-xs font-medium text-muted-foreground">最近会话</p>
                {sessionsLoading ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>
              <div className="mt-3 space-y-1">
                {sessions.length ? (
                  sessions.map((session) => (
                    <button
                      key={session.session_id}
                      type="button"
                      onClick={() => void handleSelectSession(session.session_id)}
                      className={cn(
                        "w-full rounded-2xl px-3 py-2 text-left transition hover:bg-white/80",
                        session.session_id === sessionId
                          ? "bg-white shadow-sm"
                          : "text-foreground/90",
                      )}
                    >
                      <p className="truncate text-sm font-medium">{buildSessionTitle(session)}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {session.message_count} 条消息
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl px-3 py-2 text-sm text-muted-foreground">
                    还没有历史会话
                  </div>
                )}
              </div>
            </div>

            <div className="mt-auto space-y-3">
              {sidebarOpen ? (
                <div className="rounded-[1.5rem] border border-black/8 bg-white/90 p-3 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Session
                  </p>
                  <p className="mt-2 break-all text-xs leading-5 text-foreground/70">
                    {sessionId ?? "未创建会话"}
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-full border border-black/8 bg-white px-3 py-3 text-sm shadow-sm transition hover:bg-white/80"
              >
                <User className="h-4 w-4" />
                {sidebarOpen ? <span>邀请团队成员</span> : null}
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-1 flex-col">
          <header className="flex items-center justify-between px-5 py-4 lg:px-8">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen((open) => !open)}
                className="h-9 w-9 lg:hidden"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-xl font-semibold tracking-tight"
              >
                ChatGPT
                <span className="text-sm text-muted-foreground">RAG</span>
              </button>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/8 bg-white/80 text-muted-foreground transition hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </header>

          {!hasConversation ? (
            <div className="flex flex-1 flex-col px-5 pb-10 pt-6 lg:px-10">
              <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[2.5rem]">
                <div className="pointer-events-none absolute inset-x-[18%] top-[18%] h-44 rounded-full bg-[radial-gradient(circle,rgba(0,0,0,0.06),transparent_70%)] blur-3xl" />
                <div className="relative z-10 w-full max-w-[980px] text-center">
                  <div className="mb-8">
                    <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground">
                      KNOWLEDGE ASSISTANT
                    </p>
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
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-black/8 bg-white/85 px-4 py-2.5 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
                    >
                      <BookOpen className="h-4 w-4" />
                      公司知识库
                    </button>
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="rounded-full border border-black/7 bg-white/65 px-4 py-2.5 text-sm text-foreground/80 transition hover:bg-white"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {combinedError ? (
                    <p className="mt-6 text-sm text-red-600">{combinedError}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-1 gap-6 px-5 pb-40 pt-2 lg:px-8">
                <section className="min-w-0 flex-1">
                  <ScrollArea className="h-[calc(100vh-220px)] pr-2">
                    <div className="mx-auto flex w-full max-w-4xl flex-col gap-12 pb-12 pt-4">
                      {messages.map((message, index) => {
                        const content = getMessageText(message);
                        const isStreamingAssistant =
                          message.role === "assistant" &&
                          message.id === messages[messages.length - 1]?.id &&
                          isSending;
                        const hits =
                          message.role === "assistant" && index === messages.length - 1
                            ? latestHits
                            : [];

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
                                  {isStreamingAssistant ? (
                                    <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground">
                                      {content}
                                    </div>
                                  ) : (
                                    <div className="prose prose-slate max-w-none text-[15px] leading-8 prose-headings:font-semibold prose-p:my-0 prose-pre:rounded-2xl prose-pre:bg-[#f3f2ef]">
                                      <ReactMarkdown>{content}</ReactMarkdown>
                                    </div>
                                  )}
                                  {isStreamingAssistant ? (
                                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                                      <LoaderCircle className="h-4 w-4 animate-spin" />
                                      正在生成
                                    </div>
                                  ) : null}
                                  {hits.length ? (
                                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                                      {hits.map((hit) => (
                                        <div
                                          key={`${message.id}-${hit.rank}`}
                                          className="rounded-[1.5rem] border border-black/7 bg-white/85 p-4 shadow-sm"
                                        >
                                          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                            <BookOpen className="h-3.5 w-3.5" />
                                            来源 {hit.rank}
                                          </div>
                                          <p className="truncate text-sm font-medium">
                                            {hit.source}
                                          </p>
                                          <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
                                            {hit.content_preview}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <div className="max-w-[720px] rounded-[1.75rem] bg-[#ecebe6] px-5 py-4 text-[15px] leading-7 text-foreground shadow-sm">
                                {content}
                              </div>
                            )}
                          </article>
                        );
                      })}
                      <div ref={messageEndRef} />
                    </div>
                  </ScrollArea>
                </section>

                <aside className="hidden w-[320px] xl:block">
                  <div className="sticky top-6 rounded-[2rem] border border-black/7 bg-white/75 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          Context
                        </p>
                        <h2 className="mt-2 text-lg font-semibold">知识命中</h2>
                      </div>
                      <div className="rounded-full bg-[#f3f2ee] px-3 py-1 text-xs text-muted-foreground">
                        {latestHits.length} 条
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {latestSummary ? (
                        <div className="rounded-[1.5rem] bg-[#f7f6f2] p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Summary
                          </p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/80">
                            {latestSummary}
                          </p>
                        </div>
                      ) : null}

                      {Object.keys(taskState).length ? (
                        <div className="rounded-[1.5rem] bg-[#f7f6f2] p-4">
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Task State
                          </p>
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-foreground/75">
                            {JSON.stringify(taskState, null, 2)}
                          </pre>
                        </div>
                      ) : null}

                      {latestHits.length ? (
                        latestHits.map((hit) => (
                          <div
                            key={`latest-${hit.rank}`}
                            className="rounded-[1.5rem] bg-[#f7f6f2] p-4"
                          >
                            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                              Source {hit.rank}
                            </p>
                            <p className="mt-2 truncate text-sm font-medium">{hit.source}</p>
                            <p className="mt-2 line-clamp-5 text-sm leading-6 text-muted-foreground">
                              {hit.content_preview}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[1.5rem] border border-dashed border-black/10 bg-[#faf9f6] p-5 text-sm leading-6 text-muted-foreground">
                          当前回答没有展示可用来源。你可以继续追问，或从左侧最近话题快速发起新问题。
                        </div>
                      )}
                    </div>
                  </div>
                </aside>
              </div>

              <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(180deg,rgba(251,251,248,0),rgba(251,251,248,0.92)_18%,rgba(251,251,248,1)_60%)] px-5 pb-6 pt-12 lg:px-8">
                <div className="pointer-events-auto mx-auto max-w-4xl">
                  {combinedError ? (
                    <p className="mb-3 text-sm text-red-600">{combinedError}</p>
                  ) : null}
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
        </main>
      </div>
    </div>
  );
}
