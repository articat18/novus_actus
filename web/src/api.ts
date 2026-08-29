import type {
  AccountResponse,
  AccountSessionResponse,
  AddMemberRequest,
  ChallengeResponse,
  ChallengeVerification,
  ChangeMemberRoleRequest,
  CreateOrganizationRequest,
  OrganizationListResponse,
  OrganizationMemberResponse,
  OrganizationResponse,
  OrganizationSummaryResponse,
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

/**
 * Email + password accounts and the organization system. Separate from `api`
 * above, which drives the passwordless university demo.
 */
export const accounts = {
  register(body: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<AccountSessionResponse> {
    return request("POST", "/api/v1/auth/register", { body });
  },
  login(body: { email: string; password: string }): Promise<AccountSessionResponse> {
    return request("POST", "/api/v1/auth/login", { body });
  },
  logout(token: string): Promise<unknown> {
    return request("POST", "/api/v1/auth/logout", { token });
  },
  me(token: string): Promise<AccountResponse> {
    return request("GET", "/api/v1/me", { token });
  },
};

export const organizations = {
  list(token: string): Promise<OrganizationListResponse> {
    return request("GET", "/api/v1/organizations", { token });
  },
  create(
    body: CreateOrganizationRequest,
    token: string,
  ): Promise<OrganizationSummaryResponse> {
    return request("POST", "/api/v1/organizations", { body, token });
  },
  detail(organizationId: string, token: string): Promise<OrganizationResponse> {
    return request("GET", `/api/v1/organizations/${organizationId}`, { token });
  },
  addMember(
    organizationId: string,
    body: AddMemberRequest,
    token: string,
  ): Promise<OrganizationMemberResponse> {
    return request("POST", `/api/v1/organizations/${organizationId}/members`, {
      body,
      token,
    });
  },
  changeRole(
    organizationId: string,
    accountId: string,
    body: ChangeMemberRoleRequest,
    token: string,
  ): Promise<OrganizationMemberResponse> {
    return request(
      "PATCH",
      `/api/v1/organizations/${organizationId}/members/${accountId}`,
      { body, token },
    );
  },
  removeMember(
    organizationId: string,
    accountId: string,
    token: string,
  ): Promise<unknown> {
    return request(
      "DELETE",
      `/api/v1/organizations/${organizationId}/members/${accountId}`,
      { token },
    );
  },
};
