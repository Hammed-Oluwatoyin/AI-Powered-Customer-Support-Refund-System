import type { ApiErrorBody } from './types.ts'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/**
 * Calls the backend on the same origin (nginx or the Vite dev server proxies
 * /api), turning any failure into an ApiError with a readable message.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiError(
      0,
      "We couldn't reach the server. Check your connection and try again.",
    )
  }

  if (!response.ok) {
    throw new ApiError(response.status, await errorMessage(response))
  }
  return (await response.json()) as T
}

async function errorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return "You're sending messages too quickly. Please wait a minute and try again."
  }
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message
    if (message) return message
  } catch {
    // The body was not JSON; fall through to a generic message.
  }
  return `Something went wrong (error ${response.status}). Please try again.`
}
