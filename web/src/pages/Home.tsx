import { Link } from "react-router-dom";
import { useAuth } from "../auth";

/** Authenticated home page with navigation to competition pages. */
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

  const roles = user.roles.length > 0 ? user.roles.join(", ") : "No roles yet";

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
        <h2>Welcome, {user.name}</h2>
        <p className="sub">
          Join the competition and help reduce energy consumption in your household.
        </p>

        {/* Navigation cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "14px",
            margin: "24px 0",
          }}
        >
          <Link
            to="/app/leaderboard"
            style={{
              padding: "16px",
              backgroundColor: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.backgroundColor = "var(--brand-soft)";
              el.style.borderColor = "var(--brand)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.backgroundColor = "var(--panel-2)";
              el.style.borderColor = "var(--border)";
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>
              📊 Leaderboard
            </h3>
            <p style={{ margin: "0", fontSize: "0.85rem", color: "var(--muted)" }}>
              See how your household ranks
            </p>
          </Link>

          <Link
            to="/app/profile"
            style={{
              padding: "16px",
              backgroundColor: "var(--panel-2)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              textDecoration: "none",
              color: "inherit",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.backgroundColor = "var(--brand-soft)";
              el.style.borderColor = "var(--brand)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.backgroundColor = "var(--panel-2)";
              el.style.borderColor = "var(--border)";
            }}
          >
            <h3 style={{ margin: "0 0 4px", fontSize: "1rem" }}>👤 Profile</h3>
            <p style={{ margin: "0", fontSize: "0.85rem", color: "var(--muted)" }}>
              View your stats and history
            </p>
          </Link>
        </div>

        {/* User info */}
        <div className="session-grid" style={{ marginTop: "24px" }}>
          <div className="stat">
            <div className="k">Name</div>
            <div className="v">{user.name}</div>
          </div>
          <div className="stat">
            <div className="k">Email</div>
            <div className="v">{user.email}</div>
          </div>
          <div className="stat" style={{ gridColumn: "1 / -1" }}>
            <div className="k">Roles</div>
            <div className="v">{roles}</div>
          </div>
        </div>

        <button
          className="btn-primary"
          type="button"
          onClick={() => {
            void signOut();
          }}
          style={{ width: "auto", marginTop: "16px" }}
        >
          Sign out
        </button>
      </main>

      <footer>
        Postgres + ERN (Express · React · Node · TypeScript) · Prisma ·
        deployable on Vercel
      </footer>
    </div>
  );
}
