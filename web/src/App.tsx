import type { SessionResponse } from "@energy/shared";
import { useState, type FormEvent } from "react";

import { api, ApiError } from "./api";

type Step = "email" | "verify" | "done";

const DEMO_ACCOUNTS: Array<{ email: string; outcome: string }> = [
  { email: "active@demo.edu", outcome: "participates" },
  { email: "inactive@demo.edu", outcome: "ineligible" },
  { email: "unknown@demo.edu", outcome: "not found" },
];

const ROADMAP: Array<{ label: string; done: boolean }> = [
  { label: "Passwordless identity & sessions", done: true },
  { label: "Tenant isolation & audit", done: true },
  { label: "Competition-window math", done: true },
  { label: "University verification", done: true },
  { label: "Meter ingestion & anomalies", done: false },
  { label: "Per-person usage calculation", done: false },
  { label: "Leaderboards & finalization", done: false },
  { label: "Administration & archival", done: false },
];

function messageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }
  return "Something went wrong.";
}

export function App() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("active@demo.edu");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [username, setUsername] = useState("");
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const issued = await api.requestChallenge(email.trim());
      setChallengeId(issued.challengeId);
      setCode("");
      setStep("verify");
      try {
        const dev = await api.devCode(email.trim());
        setDevCode(dev.code);
      } catch {
        setDevCode(null);
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (challengeId === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const activated = await api.verifyChallenge({
        challengeId,
        code: code.trim(),
        username: username.trim(),
      });
      setSession(activated);
      setRenameValue(activated.username);
      setStep("done");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  async function changeName(event: FormEvent) {
    event.preventDefault();
    if (session === null) {
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await api.changeUsername(
        renameValue.trim(),
        session.accessToken,
      );
      setSession({ ...session, username: result.username });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    setSession(null);
    setChallengeId(null);
    setDevCode(null);
    setCode("");
    setUsername("");
    setError(null);
    setStep("email");
  }

  const stepIndex = step === "email" ? 0 : step === "verify" ? 1 : 2;

  return (
    <div className="app">
      <header className="masthead">
        <div className="logo" aria-hidden="true">
          ⚡
        </div>
        <div>
          <h1>Energy Leaderboard</h1>
          <p>University apartment-energy competition — demo</p>
        </div>
      </header>

      <div className="layout">
        <main className="card">
          <div className="stepper" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`pip${i <= stepIndex ? " active" : ""}`} />
            ))}
          </div>

          {step === "email" && (
            <form onSubmit={sendCode}>
              <h2>Join with your university email</h2>
              <p className="sub">
                Only configured university domains can participate. We send a
                single-use verification code — no passwords.
              </p>
              <div className="field">
                <label htmlFor="email">University email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  autoComplete="email"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@demo.edu"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Sending…" : "Send verification code"}
              </button>
            </form>
          )}

          {step === "verify" && (
            <form onSubmit={verify}>
              <h2>Enter your code</h2>
              <p className="sub">
                Sent to <strong>{email}</strong>.{" "}
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setStep("email")}
                >
                  change
                </button>
              </p>
              {devCode !== null && (
                <div className="hint">
                  Demo inbox — your code is <code>{devCode}</code>{" "}
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setCode(devCode)}
                  >
                    use it
                  </button>
                </div>
              )}
              <div className="field" style={{ marginTop: 16 }}>
                <label htmlFor="code">6-digit code</label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="username">Choose a public username</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="EcoHero"
                  required
                />
              </div>
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify & join"}
              </button>
            </form>
          )}

          {step === "done" && session !== null && (
            <div>
              <h2>
                You're in <span className="badge">{session.roles.join(", ")}</span>
              </h2>
              <p className="sub">
                Your email, room, and university identifiers stay private — only
                your username is public.
              </p>
              <div className="session-grid">
                <div className="stat">
                  <div className="k">Public username</div>
                  <div className="v">{session.username}</div>
                </div>
                <div className="stat">
                  <div className="k">Session expires</div>
                  <div className="v">
                    {new Date(session.expiresAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="stat" style={{ gridColumn: "1 / -1" }}>
                  <div className="k">Access token ({session.tokenType})</div>
                  <div className="v">{session.accessToken.slice(0, 8)}…</div>
                </div>
              </div>
              <form onSubmit={changeName}>
                <div className="field">
                  <label htmlFor="rename">Change username</label>
                  <div className="btn-row">
                    <input
                      id="rename"
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <button
                      className="btn-primary"
                      type="submit"
                      disabled={loading}
                      style={{ width: "auto" }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </form>
              <button className="btn-ghost" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}

          {error !== null && <div className="error">{error}</div>}
        </main>

        <aside>
          <div className="card aside">
            <h3>Demo accounts</h3>
            {DEMO_ACCOUNTS.map((account) => (
              <div className="account" key={account.email}>
                <code>{account.email}</code>
                <span className="tag">{account.outcome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(account.email);
                    setStep("email");
                    setError(null);
                  }}
                >
                  use
                </button>
              </div>
            ))}
          </div>

          <div className="card aside">
            <h3>Platform roadmap</h3>
            <ul className="roadmap">
              {ROADMAP.map((item) => (
                <li key={item.label} className={item.done ? "done" : ""}>
                  <span className="mark">{item.done ? "✓" : "○"}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <footer>
        Postgres + ERN (Express · React · Node · TypeScript) · Prisma ·
        deployable on Vercel
      </footer>
    </div>
  );
}
