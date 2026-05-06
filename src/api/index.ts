import createClient from "openapi-fetch"
import type { SWRConfiguration } from "swr"
import {
  createImmutableHook,
  createInfiniteHook,
  createMutateHook,
  createQueryHook,
} from "swr-openapi"

import { getJwtToken } from "@/lib/auth"
import type { components, paths } from "./schema"

export type Role = components["schemas"]["Role"]
export type HistoryMessage = components["schemas"]["HistoryMessage"]
export type Hit = components["schemas"]["Hit"]
export type SessionSummary = components["schemas"]["SessionSummary"]
export type SessionDetail = components["schemas"]["SessionDetail"]
export type CreateSessionPayload = components["schemas"]["CreateSessionPayload"]
export type SessionDeleteResponse = components["schemas"]["SessionDeleteResponse"]

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? ""

export function buildApiUrl(path: string) {
  if (!API_BASE_URL) {
    return path
  }
  return `${API_BASE_URL}${path}`
}

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isMatch(target: unknown, source: unknown): boolean {
  if (Object.is(target, source)) {
    return true
  }

  if (Array.isArray(target) && Array.isArray(source)) {
    return source.every((item, index) => isMatch(target[index], item))
  }

  if (isPlainObject(target) && isPlainObject(source)) {
    return Object.entries(source).every(([key, value]) => hasOwn(target, key) && isMatch(target[key], value))
  }

  return false
}

export class ApiError extends Error {
  status?: number
  detail?: unknown

  constructor(error: unknown, status?: number) {
    super(readApiErrorMessage(error))
    this.name = "ApiError"
    this.status = status
    this.detail = error
  }
}

function readApiErrorMessage(error: unknown) {
  if (isPlainObject(error) && "detail" in error) {
    return String(error.detail)
  }

  if (error instanceof Error) {
    return error.message
  }

  return "请求失败"
}

export function getErrorMessage(error: unknown) {
  return readApiErrorMessage(error)
}

export function isNotFoundError(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

export const client = createClient<paths>({
  baseUrl: API_BASE_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
})

client.use({
  async onRequest({ request }) {
    const token = await getJwtToken()
    if (token) {
      request.headers.set("Authorization", `Bearer ${token}`)
    }
    return request
  },
})

const prefix = "rag-api"

export const useQuery = createQueryHook(client, prefix)
export const useImmutable = createImmutableHook(client, prefix)
export const useInfinite = createInfiniteHook(client, prefix)
export const useMutate = createMutateHook(client, prefix, isMatch)

async function withAuthRetry<T>(request: () => Promise<{ data?: T; error?: unknown; response: Response }>) {
  let result = await request()
  if (result.error && result.response.status === 401) {
    await getJwtToken({ forceRefresh: true })
    result = await request()
  }
  return result
}

export const sessionsApi = {
  async list() {
    const { data, error, response } = await withAuthRetry(() => client.GET("/sessions"))
    if (error) {
      throw new ApiError(error, response.status)
    }
    if (!Array.isArray(data)) {
      throw new Error("会话列表接口返回格式错误")
    }
    return data
  },

  async get(sessionId: string) {
    const { data, error, response } = await withAuthRetry(() =>
      client.GET("/sessions/{session_id}", {
        params: {
          path: {
            session_id: sessionId,
          },
        },
      }),
    )
    if (error) {
      throw new ApiError(error, response.status)
    }
    if (!data) {
      throw new Error("会话详情接口返回格式错误")
    }
    return data
  },

  async create(payload: CreateSessionPayload) {
    const { data, error, response } = await withAuthRetry(() =>
      client.POST("/sessions", {
        body: payload,
      }),
    )
    if (error) {
      throw new ApiError(error, response.status)
    }
    if (!data) {
      throw new Error("创建会话接口返回格式错误")
    }
    return data
  },

  async delete(sessionId: string) {
    const { data, error, response } = await withAuthRetry(() =>
      client.DELETE("/sessions/{session_id}", {
        params: {
          path: {
            session_id: sessionId,
          },
        },
      }),
    )
    if (error) {
      throw new ApiError(error, response.status)
    }
    if (!data) {
      throw new Error("删除会话接口返回格式错误")
    }
    return data
  },
}

export const sessionKeys = {
  list: ["sessions"] as const,
  detail: (sessionId: string | null) => (sessionId ? (["sessions", sessionId] as const) : null),
}

export function useSessionList(config?: SWRConfiguration<SessionSummary[], unknown>) {
  return useQuery("/sessions", undefined, config as never)
}

export function useSessionDetail(
  sessionId: string | null,
  config?: SWRConfiguration<SessionDetail, unknown>,
) {
  const init = sessionId
    ? {
        params: {
          path: {
            session_id: sessionId,
          },
        },
      }
    : null

  return useQuery("/sessions/{session_id}", init as never, config as never)
}
