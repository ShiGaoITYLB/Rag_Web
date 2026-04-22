import axios from "axios";

export type Role = "user" | "assistant";

export type HistoryMessage = {
  role: Role;
  content: string;
  timestamp?: string;
};

export type Hit = {
  rank: number;
  source: string;
  content_preview: string;
};

export type SessionSummary = {
  session_id: string;
  message_count: number;
  updated_at?: string | null;
  last_message_preview?: string | null;
};

export type SessionDetail = {
  session_id: string;
  history: HistoryMessage[];
  message_count: number;
  latest_summary?: string | null;
  latest_hits?: Hit[];
  task_state?: Record<string, unknown>;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export const apiClient = axios.create({
  baseURL: API_BASE_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

export function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const detail =
      (typeof error.response?.data === "object" &&
      error.response?.data &&
      "detail" in error.response.data
        ? String(error.response.data.detail)
        : null) ?? null;
    return detail || error.message || "请求失败";
  }
  return error instanceof Error ? error.message : "请求失败";
}

export const sessionsApi = {
  async list() {
    const { data } = await apiClient.get<SessionSummary[]>("/sessions");
    if (!Array.isArray(data)) {
      throw new Error("会话列表接口返回格式错误");
    }
    return data;
  },
  async get(sessionId: string) {
    const { data } = await apiClient.get<SessionDetail>(`/sessions/${sessionId}`);
    return data;
  },
  async create(payload: { history?: HistoryMessage[]; task_state?: Record<string, unknown> }) {
    const { data } = await apiClient.post<SessionDetail>("/sessions", payload);
    return data;
  },
};
