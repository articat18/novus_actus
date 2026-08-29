import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth";

export interface LeaderboardRow {
  householdId: string;
  name: string;
  rank: number;
  members: number;
  reductionPct: number;
  idleMinutes: number;
  kwhAvoided: number;
  streakDays: number;
  isYou?: boolean;
}

// Mock data for now
const MOCK_LEADERBOARD: LeaderboardRow[] = [
  {
    householdId: "h_1",
    name: "Block C · 04-217",
    rank: 1,
    members: 4,
    reductionPct: 31.4,
    idleMinutes: 42,
    kwhAvoided: 8.7,
    streakDays: 12,
  },
  {
    householdId: "h_2",
    name: "Block A · 11-08",
    rank: 2,
    members: 5,
    reductionPct: 27.9,
    idleMinutes: 58,
    kwhAvoided: 9.2,
    streakDays: 8,
  },
  {
    householdId: "h_3",
    name: "Block C · 07-341",
    rank: 3,
    members: 3,
    reductionPct: 22.1,
    idleMinutes: 61,
    kwhAvoided: 5.4,
    streakDays: 5,
    isYou: true,
  },
  {
    householdId: "h_4",
    name: "Block B · 02-114",
    rank: 4,
    members: 4,
    reductionPct: 18.6,
    idleMinutes: 88,
    kwhAvoided: 6.1,
    streakDays: 3,
  },
  {
    householdId: "h_5",
    name: "Block A · 09-22",
    rank: 5,
    members: 6,
    reductionPct: 14.2,
    idleMinutes: 104,
    kwhAvoided: 7.8,
    streakDays: 2,
  },
  {
    householdId: "h_6",
    name: "Block B · 05-73",
    rank: 6,
    members: 4,
    reductionPct: 9.8,
    idleMinutes: 133,
    kwhAvoided: 3.2,
    streakDays: 1,
  },
  {
    householdId: "h_7",
    name: "Block D · 12-40",
    rank: 7,
    members: 3,
    reductionPct: 4.1,
    idleMinutes: 176,
    kwhAvoided: 1.4,
    streakDays: 0,
  },
];

export function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Wire in real API endpoint when backend is ready
    // For now, use mock data
    const loadLeaderboard = async () => {
      try {
        // Simulate API call delay
        await new Promise((r) => setTimeout(r, 500));
        setRows(MOCK_LEADERBOARD);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't load the leaderboard."
        );
      }
    };

    void loadLeaderboard();
  }, []);

  // Bars are scaled to the leading household so the field stays readable
  // even when everyone's reduction is small.
  const ceiling = rows?.length
    ? Math.max(...rows.map((r) => r.reductionPct), 1)
    : 1;

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

      <main className="card">
        <header style={{ marginBottom: "24px" }}>
          <p className="sub" style={{ margin: "0 0 4px" }}>
            This week
          </p>
          <h2 style={{ marginTop: 0 }}>Household leaderboard</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "8px 0 0" }}>
            Ranked by how much idle runtime each household has cut against its
            own seven-day baseline — so a five-person flat isn't punished for
            being five people.
          </p>
        </header>

        {error && (
          <p
            style={{
              padding: "12px 14px",
              backgroundColor: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: "10px",
              fontSize: "0.86rem",
              margin: "16px 0",
            }}
          >
            {error}
          </p>
        )}
        {!rows && !error && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.9rem",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            Reading meters…
          </p>
        )}

        {rows && rows.length === 0 && (
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.9rem",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            No households have logged a week yet. Yours could be first.
          </p>
        )}

        {rows && rows.length > 0 && (
          <>
            <div style={{ marginTop: "20px" }}>
              {rows.map((row) => (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "50px 1fr 100px",
                    gap: "16px",
                    alignItems: "start",
                    padding: "16px",
                    borderBottom: "1px solid var(--border)",
                    backgroundColor: row.isYou ? "var(--brand-soft)" : undefined,
                    borderRadius: row.isYou ? "10px" : undefined,
                  }}
                  key={row.householdId}
                >
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "700",
                      color: "var(--brand)",
                    }}
                  >
                    {row.rank}
                  </div>

                  <div>
                    <p style={{ margin: "0 0 4px", fontWeight: "600" }}>
                      {row.name}
                      {row.isYou && (
                        <span
                          style={{
                            marginLeft: "8px",
                            padding: "2px 10px",
                            borderRadius: "999px",
                            backgroundColor: "var(--brand)",
                            color: "#fff",
                            fontSize: "0.7rem",
                            fontWeight: "700",
                          }}
                        >
                          You
                        </span>
                      )}
                    </p>
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "0.85rem",
                        color: "var(--muted)",
                      }}
                    >
                      {row.members} residents · {row.idleMinutes} idle min today ·{" "}
                      {row.kwhAvoided.toFixed(1)} kWh saved · {row.streakDays}d
                      streak
                    </p>
                    <div
                      style={{
                        height: "8px",
                        backgroundColor: "var(--panel-2)",
                        borderRadius: "999px",
                        overflow: "hidden",
                      }}
                      role="img"
                      aria-label={`${row.reductionPct.toFixed(1)} percent below baseline`}
                    >
                      <div
                        style={{
                          height: "100%",
                          backgroundColor: "var(--brand)",
                          width: `${(row.reductionPct / ceiling) * 100}%`,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ textAlign: "right", fontSize: "0.95rem" }}>
                    <div style={{ fontWeight: "700", fontSize: "1.1rem" }}>
                      {row.reductionPct.toFixed(1)}%
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                        marginTop: "2px",
                      }}
                    >
                      below base
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--muted)",
                marginTop: "20px",
                textAlign: "center",
              }}
            >
              Baselines reset every Monday. Bars are scaled to the leading
              household.
            </p>
          </>
        )}

        <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
          <Link to="/app/profile" className="btn-ghost">
            View your profile →
          </Link>
        </div>
      </main>

      <footer style={{ marginTop: "40px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
        Postgres + ERN (Express · React · Node · TypeScript) · Prisma ·
        deployable on Vercel
      </footer>
    </div>
  );
}
