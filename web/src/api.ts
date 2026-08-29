import type {
  AuthUser,
  SessionResponse,
  SignInRequest,
  SignUpRequest,
} from "@energy/shared";

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
    return request("POST", "/api/v1/auth/sign-up", { body });
  },
  signIn(body: SignInRequest): Promise<SessionResponse> {
    return request("POST", "/api/v1/auth/sign-in", { body });
  },
  me(token: string): Promise<AuthUser> {
    return request("GET", "/api/v1/auth/me", { token });
  },
  signOut(token: string): Promise<void> {
    return request("POST", "/api/v1/auth/sign-out", { token });
  },
};
