/**
 * OpenAPI types for the Rag API.
 * Keep endpoint shapes in sync with the backend OpenAPI schema.
 */

export interface paths {
  "/sessions": {
    get: operations["listSessions"]
    post: operations["createSession"]
  }
  "/sessions/{session_id}": {
    get: operations["getSession"]
    delete: operations["deleteSession"]
  }
  "/ask": {
    post: operations["ask"]
  }
}

export interface components {
  schemas: {
    Role: "user" | "assistant"
    HistoryMessage: {
      role: components["schemas"]["Role"]
      content: string
      timestamp?: string
    }
    Hit: {
      rank: number
      source: string
      content_preview: string
    }
    SessionSummary: {
      session_id: string
      message_count: number
      updated_at?: string | null
      last_message_preview?: string | null
    }
    SessionDetail: {
      session_id: string
      history: components["schemas"]["HistoryMessage"][]
      message_count: number
      latest_summary?: string | null
      latest_hits?: components["schemas"]["Hit"][]
      task_state?: Record<string, unknown>
    }
    CreateSessionPayload: {
      history?: components["schemas"]["HistoryMessage"][]
      task_state?: Record<string, unknown>
    }
    SessionDeleteResponse: {
      session_id: string
      deleted: boolean
    }
    AskRequest: {
      messages: unknown[]
      session_id?: string | null
      k?: number
    }
    AskResponse: {
      session_id?: string
      answer?: string
      summary?: string | null
      hits?: components["schemas"]["Hit"][]
      [key: string]: unknown
    }
    ErrorResponse: {
      detail?: string
      [key: string]: unknown
    }
  }
}

export interface operations {
  listSessions: {
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SessionSummary"][]
        }
      }
      default: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
    }
  }
  createSession: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["CreateSessionPayload"]
      }
    }
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SessionDetail"]
        }
      }
      201: {
        content: {
          "application/json": components["schemas"]["SessionDetail"]
        }
      }
      default: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
    }
  }
  getSession: {
    parameters: {
      path: {
        session_id: string
      }
    }
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SessionDetail"]
        }
      }
      404: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
      default: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
    }
  }
  deleteSession: {
    parameters: {
      path: {
        session_id: string
      }
    }
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["SessionDeleteResponse"]
        }
      }
      404: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
      default: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
    }
  }
  ask: {
    requestBody: {
      content: {
        "application/json": components["schemas"]["AskRequest"]
      }
    }
    responses: {
      200: {
        content: {
          "application/json": components["schemas"]["AskResponse"]
          "text/plain": string
          "text/event-stream": string
        }
      }
      default: {
        content: {
          "application/json": components["schemas"]["ErrorResponse"]
        }
      }
    }
  }
}
