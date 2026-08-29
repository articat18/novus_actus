import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth";

export interface RecentEvent {
  id: string;
  zone: string;
  watts: number;
  idleMinutes: number;
  nudgedBy: string;
  resolvedBy: string;
  resolvedAt: string;
  kwhAvoided: number;
}

export interface ProfileData {
  userId: string;
  username: string;
  email: string;
  householdName: string;
  joinedAt: string;
  points: number;
  nudgesRemaining: number;
  nudgesSent: number;
  resolutions: number;
  kwhAvoided: number;
  streakDays: number;
  recentEvents: RecentEvent[];
}

// Mock data for now
const MOCK_PROFILE: ProfileData = {
  userId: "u_1",
  username: "suan",
  email: "suan@u.nus.edu",
  householdName: "Block C · 07-341",
  joinedAt: "2026-08-04T09:12:00Z",
  points: 1240,
  nudgesRemaining: 2,
  nudgesSent: 34,
  resolutions: 27,
  kwhAvoided: 18.6,
  streakDays: 5,
  recentEvents: [
    {
      id: "e_1",
      zone: "Living room aircon",
      watts: 912,
      idleMinutes: 41,
      nudgedBy: "suan",
      resolvedBy: "wei",
      resolvedAt: "2026-08-28T19:48:00Z",
      kwhAvoided: 0.62,
    },
    {
      id: "e_2",
      zone: "Kitchen kettle base",
      watts: 74,
      idleMinutes: 190,
      nudgedBy: "priya",
      resolvedBy: "suan",
      resolvedAt: "2026-08-28T08:15:00Z",
      kwhAvoided: 0.23,
    },
    {
      id: "e_3",
      zone: "Bedroom 2 aircon",
      watts: 870,
      idleMinutes: 55,
      nudgedBy: "suan",
      resolvedBy: "priya",
      resolvedAt: "2026-08-27T14:02:00Z",
      kwhAvoided: 0.79,
    },
    {
      id: "e_4",
      zone: "Study desk lamp",
      watts: 42,
      idleMinutes: 320,
      nudgedBy: "suan",
      resolvedBy: "wei",
      resolvedAt: "2026-08-26T23:31:00Z",
      kwhAvoided: 0.22,
    },
  ],
};

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Wire in real API endpoint when backend is ready
    // For now, use mock data
    const loadProfile = async () => {
      try {
        // Simulate API call delay
        await new Promise((r) => setTimeout(r, 450));
        setProfile(MOCK_PROFILE);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't load your profile."
        );
      }
    };

    void loadProfile();
  }, []);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

      {error && (
        <div className="card">
          <p
            style={{
              padding: "12px 14px",
              backgroundColor: "var(--danger-soft)",
              color: "var(--danger)",
              borderRadius: "10px",
              fontSize: "0.86rem",
            }}
          >
            {error}
          </p>
        </div>
      )}

      {!profile && !error && (
        <div className="card">
          <p
            style={{
              color: "var(--muted)",
              fontSize: "0.9rem",
              textAlign: "center",
              padding: "40px 20px",
            }}
          >
            Loading your profile…
          </p>
        </div>
      )}

      {profile && (
        <>
          <div className="layout">
            {/* Main profile card */}
            <div className="card">
              <h2>Your Profile</h2>
              <div className="session-grid" style={{ marginTop: "16px" }}>
                <div className="stat">
                  <div className="k">Name</div>
                  <div className="v">{profile.username}</div>
                </div>
                <div className="stat">
                  <div className="k">Email</div>
                  <div className="v">{profile.email}</div>
                </div>
                <div className="stat">
                  <div className="k">Household</div>
                  <div className="v">{profile.householdName}</div>
                </div>
                <div className="stat">
                  <div className="k">Member Since</div>
                  <div className="v">{formatDate(profile.joinedAt)}</div>
                </div>
                <div className="stat">
                  <div className="k">Points</div>
                  <div className="v">{profile.points}</div>
                </div>
                <div className="stat">
                  <div className="k">Streak</div>
                  <div className="v">{profile.streakDays}d</div>
                </div>
              </div>

              <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                <Link to="/app/leaderboard" className="btn-ghost">
                  ← Back to leaderboard
                </Link>
              </div>
            </div>

            {/* Stats sidebar */}
            <div className="card">
              <h3 style={{ margin: "0 0 16px" }}>Stats</h3>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div style={{ backgroundColor: "var(--panel-2)", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                    kWh Avoided
                  </div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      marginTop: "4px",
                    }}
                  >
                    {profile.kwhAvoided.toFixed(1)}
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--panel-2)", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                    Resolutions
                  </div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      marginTop: "4px",
                    }}
                  >
                    {profile.resolutions}
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--panel-2)", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                    Nudges Sent
                  </div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      marginTop: "4px",
                    }}
                  >
                    {profile.nudgesSent}
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--panel-2)", padding: "12px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                    Nudges Left
                  </div>
                  <div
                    style={{
                      fontSize: "1.3rem",
                      fontWeight: "700",
                      marginTop: "4px",
                    }}
                  >
                    {profile.nudgesRemaining}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent events */}
          <div className="card" style={{ marginTop: "22px" }}>
            <h3 style={{ margin: "0 0 16px" }}>Recent Events</h3>

            {profile.recentEvents.length === 0 ? (
              <p
                style={{
                  color: "var(--muted)",
                  fontSize: "0.9rem",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                No recent resolution events yet.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {profile.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: "12px",
                      backgroundColor: "var(--panel-2)",
                      borderRadius: "10px",
                      borderLeft: "4px solid var(--brand)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                      <div>
                        <p style={{ margin: "0", fontWeight: "600" }}>
                          {event.zone}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: "0.8rem",
                            color: "var(--muted)",
                          }}
                        >
                          {event.watts}W · {event.idleMinutes} idle min
                        </p>
                      </div>
                      <div
                        style={{
                          textAlign: "right",
                          fontSize: "0.85rem",
                          fontWeight: "600",
                          color: "var(--brand)",
                        }}
                      >
                        +{event.kwhAvoided.toFixed(2)} kWh
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--muted)",
                        marginTop: "8px",
                        paddingTop: "8px",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      <p style={{ margin: "0 0 2px" }}>
                        Nudged by <strong>{event.nudgedBy}</strong> · Resolved
                        by <strong>{event.resolvedBy}</strong>
                      </p>
                      <p style={{ margin: "0" }}>
                        {formatDate(event.resolvedAt)} at{" "}
                        {formatTime(event.resolvedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <footer style={{ marginTop: "40px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }}>
        Postgres + ERN (Express · React · Node · TypeScript) · Prisma ·
        deployable on Vercel
      </footer>
    </div>
  );
}
