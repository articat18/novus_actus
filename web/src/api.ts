import type {
  AuthUser,
  SessionResponse,
  SignInRequest,
  SignUpRequest,
} from "@energy/shared";

/**
 * MOCK MODE: Set to true to use mock data for frontend development.
 * Set to false to use the real backend API.
 * When true, sign in/up with any email and password (min 6 chars).
 */
const USE_MOCKS = true;

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  body?: unknown;
  token?: string;
}

async function request<T>(
  method: string,
  path: string,
  { body, token }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  if (token !== undefined) {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const message =
      typeof data.error === "string" ? data.error : response.statusText;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export const api = {
  signUp(body: SignUpRequest): Promise<SessionResponse> {
    if (USE_MOCKS) {
      return (async () => {
        await delay();
        if (body.password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        return {
          accessToken: "mock-token-" + Math.random(),
          tokenType: "bearer" as const,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user: {
            id: "u_1",
            name: body.name,
            email: body.email,
            roles: ["participant"],
          },
        };
      })();
    }
    return request("POST", "/api/v1/auth/sign-up", { body });
  },
  signIn(body: SignInRequest): Promise<SessionResponse> {
    if (USE_MOCKS) {
      return (async () => {
        await delay();
        if (!body.email.includes("@")) {
          throw new Error("That email doesn't look right.");
        }
        if (body.password.length < 6) {
          throw new Error("Password is at least 6 characters.");
        }
        return {
          accessToken: "mock-token-" + Math.random(),
          tokenType: "bearer" as const,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          user: {
            id: "u_1",
            name: body.email.split("@")[0],
            email: body.email,
            roles: ["participant"],
          },
        };
      })();
    }
    return request("POST", "/api/v1/auth/sign-in", { body });
  },
  me(token: string): Promise<AuthUser> {
    if (USE_MOCKS) {
      return (async () => {
        await delay(300);
        return {
          id: "u_1",
          name: "Suan Hao",
          email: "suan@u.nus.edu",
          roles: ["participant"],
        };
      })();
    }
    return request("GET", "/api/v1/auth/me", { token });
  },
  signOut(token: string): Promise<void> {
    if (USE_MOCKS) {
      return (async () => {
        await delay(200);
        // Mock always succeeds
      })();
    }
    return request("POST", "/api/v1/auth/sign-out", { token });
  },
};
