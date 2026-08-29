import { useAuth } from "../auth";

/** Minimal authenticated landing — the competition dashboard is future work. */
export function HomePage() {
  const { user, loading, signOut } = useAuth();

  if (user === null) {
    return (
      <div className="auth-shell">
        <main className="card auth-card">
          <p className="sub">
            {loading ? "Loading your account…" : "You are not signed in."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="logo" aria-hidden="true">
          ⚡
        </div>
        <div>
          <h1>Energy Leaderboard</h1>
          <p>University apartment-energy competition</p>
        </div>
      </header>

      <main className="card home-card">
        <h2>Welcome, {user.username}</h2>
        <p className="sub">
          You're signed in. The competition dashboard is on the way.
        </p>
        <div className="session-grid">
          <div className="stat">
            <div className="k">Username</div>
            <div className="v">{user.username}</div>
          </div>
          <div className="stat">
            <div className="k">Email</div>
            <div className="v">{user.email}</div>
          </div>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            void signOut();
          }}
          style={{ width: "auto" }}
        >
          Sign out
        </button>
      </main>

      <footer>
        MongoDB + ERN (Express · React · Node · TypeScript) · deployable on
        Vercel
      </footer>
    </div>
  );
}
