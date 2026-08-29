import type {
  ChallengeResponse,
  ChallengeVerification,
  SessionResponse,
  UsernameResponse,
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

export interface DevCode {
  email: string;
  code: string;
  expiresAt: string;
}

export const api = {
  requestChallenge(email: string): Promise<ChallengeResponse> {
    return request("POST", "/api/v1/auth/challenges", { body: { email } });
  },
  verifyChallenge(payload: ChallengeVerification): Promise<SessionResponse> {
    return request("POST", "/api/v1/auth/challenges/verify", { body: payload });
  },
  changeUsername(username: string, token: string): Promise<UsernameResponse> {
    return request("PATCH", "/api/v1/me/username", { body: { username }, token });
  },
  devCode(email: string): Promise<DevCode> {
    return request(
      "GET",
      `/api/v1/dev/last-code?email=${encodeURIComponent(email)}`,
    );
  },
};
