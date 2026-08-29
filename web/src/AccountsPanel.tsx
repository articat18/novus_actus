/**
 * Email + password sign-in and the organization system (families and
 * companies). No OAuth, by design.
 */
import type {
  AccountResponse,
  OrganizationKindName,
  OrganizationResponse,
  OrganizationRoleName,
  OrganizationSummaryResponse,
} from "@energy/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { accounts, ApiError, organizations } from "./api";

const TOKEN_KEY = "energy.accountToken";

function messageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

/** Owners and admins may manage members; plain members may not. */
function manages(role: OrganizationRoleName | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function AccountsPanel() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [account, setAccount] = useState<AccountResponse | null>(null);
  const [mode, setMode] = useState<"signin" | "register">("signin");

  const [email, setEmail] = useState("parent@family.test");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [orgs, setOrgs] = useState<OrganizationSummaryResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<OrganizationResponse | null>(null);

  const [newKind, setNewKind] = useState<OrganizationKindName>("family");
  const [newName, setNewName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrganizationRoleName>("member");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signOutLocally = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAccount(null);
    setOrgs([]);
    setSelectedId(null);
    setDetail(null);
  }, []);

  // Validate a stored token on load so a refresh keeps you signed in.
  useEffect(() => {
    if (token === null) {
      return;
    }
    let cancelled = false;
    accounts
      .me(token)
      .then((me) => {
        if (!cancelled) {
          setAccount(me);
        }
      })
      .catch(() => {
        if (!cancelled) {
          signOutLocally();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, signOutLocally]);

  const refreshOrgs = useCallback(
    async (activeToken: string) => {
      const list = await organizations.list(activeToken);
      setOrgs(list.organizations);
      return list.organizations;
    },
    [],
  );

  useEffect(() => {
    if (token === null || account === null) {
      return;
    }
    refreshOrgs(token).catch((err: unknown) => setError(messageOf(err)));
  }, [token, account, refreshOrgs]);

  useEffect(() => {
    if (token === null || selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    organizations
      .detail(selectedId, token)
      .then((value) => {
        if (!cancelled) {
          setDetail(value);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(messageOf(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, selectedId]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const session =
        mode === "register"
          ? await accounts.register({
              email: email.trim(),
              password,
              displayName: displayName.trim(),
            })
          : await accounts.login({ email: email.trim(), password });
      localStorage.setItem(TOKEN_KEY, session.accessToken);
      setToken(session.accessToken);
      setAccount(session.account);
      setPassword("");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    const current = token;
    signOutLocally();
    if (current !== null) {
      await accounts.logout(current).catch(() => undefined);
    }
  }

  async function createOrganization(event: FormEvent) {
    event.preventDefault();
    if (token === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const created = await organizations.create(
        { kind: newKind, name: newName.trim() },
        token,
      );
      setNewName("");
      await refreshOrgs(token);
      setSelectedId(created.organizationId);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function invite(event: FormEvent) {
    event.preventDefault();
    if (token === null || selectedId === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await organizations.addMember(
        selectedId,
        { email: inviteEmail.trim(), role: inviteRole },
        token,
      );
      setInviteEmail("");
      setDetail(await organizations.detail(selectedId, token));
      await refreshOrgs(token);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(accountId: string) {
    if (token === null || selectedId === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await organizations.removeMember(selectedId, accountId, token);
      const remaining = await refreshOrgs(token);
      if (accountId === account?.accountId) {
        // We just left; the organization is no longer readable.
        setSelectedId(remaining[0]?.organizationId ?? null);
      } else {
        setDetail(await organizations.detail(selectedId, token));
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(accountId: string, role: OrganizationRoleName) {
    if (token === null || selectedId === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await organizations.changeRole(selectedId, accountId, { role }, token);
      setDetail(await organizations.detail(selectedId, token));
      await refreshOrgs(token);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  if (account === null) {
    return (
      <div className="layout">
        <main className="card">
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === "signin"}
              className={mode === "signin" ? "active" : ""}
              onClick={() => {
                setMode("signin");
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === "register"}
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setError(null);
              }}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submitAuth}>
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <p className="sub">
              Email and password only — no OAuth, no third-party sign-in.
            </p>

            <div className="field">
              <label htmlFor="account-email">Email</label>
              <input
                id="account-email"
                type="email"
                value={email}
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {mode === "register" && (
              <div className="field">
                <label htmlFor="account-name">Display name</label>
                <input
                  id="account-name"
                  type="text"
                  value={displayName}
                  autoComplete="name"
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Sam Tan"
                  required
                />
              </div>
            )}

            <div className="field">
              <label htmlFor="account-password">Password</label>
              <input
                id="account-password"
                type="password"
                value={password}
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              {mode === "register" && (
                <small className="hint-inline">At least 10 characters.</small>
              )}
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading
                ? "Working…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          {error !== null && <div className="error">{error}</div>}
        </main>

        <aside>
          <div className="card aside">
            <h3>What you get</h3>
            <ul className="roadmap">
              <li className="done">
                <span className="mark">✓</span>Households and organizations
              </li>
              <li className="done">
                <span className="mark">✓</span>Owner, admin, and member roles
              </li>
              <li className="done">
                <span className="mark">✓</span>Invite by email
              </li>
              <li>
                <span className="mark">○</span>Nudges (Android app)
              </li>
              <li>
                <span className="mark">○</span>Energy leaderboard
              </li>
            </ul>
          </div>
        </aside>
      </div>
    );
  }

  const canManage = manages(detail?.role);

  return (
    <div className="layout">
      <main className="card">
        <h2>
          {account.displayName} <span className="badge">signed in</span>
        </h2>
        <p className="sub">{account.email}</p>

        <h3 style={{ marginTop: 24 }}>Your groups</h3>
        {orgs.length === 0 && (
          <p className="sub">
            You don't belong to a group yet. Create a family or an organization
            below.
          </p>
        )}
        {orgs.length > 0 && (
          <div className="org-list">
            {orgs.map((org) => (
              <button
                type="button"
                key={org.organizationId}
                className={`org-row${org.organizationId === selectedId ? " active" : ""}`}
                onClick={() => setSelectedId(org.organizationId)}
              >
                <span className="org-name">{org.name}</span>
                <span className="tag">{org.kind}</span>
                <span className="tag">{org.role}</span>
                <span className="org-count">
                  {org.memberCount} member{org.memberCount === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        )}

        {detail !== null && (
          <div className="org-detail">
            <h3>
              {detail.name} <span className="badge">{detail.role}</span>
            </h3>
            <p className="sub">
              <code>{detail.slug}</code> · {detail.kind}
            </p>
            <table className="members">
              <tbody>
                {detail.members.map((member) => (
                  <tr key={member.accountId}>
                    <td>
                      {member.displayName}
                      {member.email !== undefined && (
                        <small className="hint-inline"> {member.email}</small>
                      )}
                    </td>
                    <td>
                      {canManage ? (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            changeRole(
                              member.accountId,
                              e.target.value as OrganizationRoleName,
                            )
                          }
                          disabled={loading}
                          aria-label={`Role for ${member.displayName}`}
                        >
                          <option value="owner">owner</option>
                          <option value="admin">admin</option>
                          <option value="member">member</option>
                        </select>
                      ) : (
                        <span className="tag">{member.role}</span>
                      )}
                    </td>
                    <td>
                      {(canManage || member.accountId === account.accountId) && (
                        <button
                          type="button"
                          className="btn-ghost"
                          disabled={loading}
                          onClick={() => removeMember(member.accountId)}
                        >
                          {member.accountId === account.accountId
                            ? "leave"
                            : "remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={invite}>
                <div className="field">
                  <label htmlFor="invite-email">Add a member by email</label>
                  <div className="btn-row">
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="kim@family.test"
                      required
                    />
                    <select
                      value={inviteRole}
                      onChange={(e) =>
                        setInviteRole(e.target.value as OrganizationRoleName)
                      }
                      aria-label="Role for the new member"
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                      {detail.role === "owner" && (
                        <option value="owner">owner</option>
                      )}
                    </select>
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={loading}
                      style={{ width: "auto" }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        )}

        {error !== null && <div className="error">{error}</div>}
        <button className="btn-ghost" type="button" onClick={signOut}>
          Sign out
        </button>
      </main>

      <aside>
        <div className="card aside">
          <h3>Create a group</h3>
          <form onSubmit={createOrganization}>
            <div className="field">
              <label htmlFor="org-kind">Kind</label>
              <select
                id="org-kind"
                value={newKind}
                onChange={(e) =>
                  setNewKind(e.target.value as OrganizationKindName)
                }
              >
                <option value="family">Family</option>
                <option value="organization">Organization</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="org-name">Name</label>
              <input
                id="org-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="The Tan Family"
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              Create
            </button>
          </form>
        </div>
      </aside>
    </div>
  );
}
