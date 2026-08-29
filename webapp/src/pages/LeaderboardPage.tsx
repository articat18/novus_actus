import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  RoomLeaderboardResponse,
} from "../../shared/types";
import { Brand } from "../components/Brand";
import { useAuth } from "../context/AuthContext";
import { ApiError, apiRequest } from "../lib/api";

type LeaderboardView = "households" | "rooms";

const periodOptions: Array<{ value: LeaderboardPeriod; label: string }> = [
  { value: "yearly", label: "Yearly" },
  { value: "monthly", label: "Monthly" },
  { value: "daily", label: "Daily" },
];

export function LeaderboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<LeaderboardView>("households");
  const [period, setPeriod] = useState<LeaderboardPeriod>("monthly");
  const [householdData, setHouseholdData] = useState<LeaderboardResponse | null>(null);
  const [roomData, setRoomData] = useState<RoomLeaderboardResponse | null>(null);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    setLoading(true);
    setError("");

    async function loadLeaderboard() {
      try {
        if (view === "households") {
          const response = await apiRequest<LeaderboardResponse>(
            `/api/leaderboard?period=${period}`,
            { signal: controller.signal },
          );
          setHouseholdData(response);
        } else {
          const query = new URLSearchParams({ period });
          if (selectedHouseholdId) query.set("householdId", selectedHouseholdId);
          const response = await apiRequest<RoomLeaderboardResponse>(
            `/api/leaderboard/rooms?${query.toString()}`,
            { signal: controller.signal },
          );
          setRoomData(response);
          setSelectedHouseholdId((current) => current || response.household?.id || "");
        }
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
        if (caughtError instanceof ApiError && caughtError.status === 401) {
          navigate("/", { replace: true });
          return;
        }
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load the leaderboard.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadLeaderboard();
    return () => controller.abort();
  }, [navigate, period, selectedHouseholdId, user, view]);

  const householdSummary = useMemo(() => {
    const entries = householdData?.entries || [];
    const average = entries.length
      ? entries.reduce((total, entry) => total + entry.kwhPerPax, 0) / entries.length
      : 0;
    return { leader: entries[0], average };
  }, [householdData]);

  const roomSummary = useMemo(() => {
    const entries = roomData?.entries || [];
    const average = entries.length
      ? entries.reduce((total, entry) => total + entry.kwhPerPax, 0) / entries.length
      : 0;
    return { leader: entries[0], average };
  }, [roomData]);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  function selectView(nextView: LeaderboardView) {
    if (nextView === view) return;
    setLoading(true);
    setError("");
    setView(nextView);
  }

  const activeData = view === "households" ? householdData : roomData;
  const activeSummary = view === "households" ? householdSummary : roomSummary;
  const activeEntryCount = view === "households"
    ? householdData?.entries.length || 0
    : roomData?.entries.length || 0;

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="topbar__inner">
          <Brand compact />
          <nav aria-label="Primary navigation">
            <a className="nav-link nav-link--active" href="#leaderboard">Leaderboard</a>
          </nav>
          <div className="profile">
            <button
              className="profile__button"
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
              <span className="profile__identity">
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <span className="profile__chevron" aria-hidden="true">⌄</span>
            </button>
            {menuOpen && (
              <div className="profile__menu" role="menu">
                <button type="button" role="menuitem" onClick={handleSignOut}>Sign out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dashboard__main" id="leaderboard">
        <div className="leaderboard-view-tabs" role="tablist" aria-label="Leaderboard view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "households"}
            className={view === "households" ? "active" : ""}
            onClick={() => selectView("households")}
          >
            Households
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "rooms"}
            className={view === "rooms" ? "active" : ""}
            onClick={() => selectView("rooms")}
          >
            Rooms
          </button>
        </div>

        <section className="dashboard-heading">
          <div>
            <p className="eyebrow">
              {view === "households" ? "Community standings" : "Your household standings"}
            </p>
            <h1>{view === "households" ? "Household energy leaderboard" : "Room energy leaderboard"}</h1>
            <p>
              {view === "households"
                ? "Less energy per person means a higher place. Every thoughtful choice counts."
                : "Compare rooms inside a household you belong to, without exposing resident identities."}
            </p>
          </div>
          <div className="dashboard-filters">
            {view === "rooms" && (
              <label className="household-picker">
                <span>Household</span>
                <select
                  value={selectedHouseholdId}
                  onChange={(event) => setSelectedHouseholdId(event.target.value)}
                  disabled={loading || !roomData?.households.length}
                >
                  {!roomData?.households.length && <option value="">No households available</option>}
                  {roomData?.households.map((household) => (
                    <option key={household.id} value={household.id}>{household.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="period-tabs" role="group" aria-label="Leaderboard period">
              {periodOptions.map((option) => (
                <button
                  key={option.value}
                  className={period === option.value ? "active" : ""}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  aria-pressed={period === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="summary-grid" aria-label="Leaderboard summary">
          <article className="summary-card summary-card--hero">
            <span className="summary-card__icon">✦</span>
            <div>
              <span>{view === "households" ? "Leading household" : "Leading room"}</span>
              <strong>
                {loading
                  ? "—"
                  : view === "households"
                    ? householdSummary.leader?.householdName || "No data yet"
                    : roomSummary.leader?.roomName || "No data yet"}
              </strong>
              <small>{activeData?.periodLabel || "Current period"}</small>
            </div>
          </article>
          <article className="summary-card">
            <span className="summary-card__icon summary-card__icon--pale">⌁</span>
            <div>
              <span>{view === "households" ? "Community average" : "Household room average"}</span>
              <strong>{loading ? "—" : formatNumber(activeSummary.average)} <em>kWh / pax</em></strong>
              <small>Across {activeEntryCount} {view === "households" ? "households" : "rooms"}</small>
            </div>
          </article>
          <article className="privacy-card">
            <span className="lock-icon" aria-hidden="true">●</span>
            <div>
              <strong>{view === "households" ? "Household-level only" : "Members-only room view"}</strong>
              <span>
                {view === "households"
                  ? "Room and individual usage stays private."
                  : "Only room names appear, and only for your households."}
              </span>
            </div>
          </article>
        </section>

        <section className="leaderboard-card" aria-busy={loading}>
          <div className="leaderboard-card__heading">
            <div>
              <h2>{periodOptions.find((option) => option.value === period)?.label} standings</h2>
              <p>
                {activeData?.periodLabel || "Loading period…"} · Lower usage per occupant ranks higher
                {view === "rooms" && roomData?.household ? ` · ${roomData.household.name}` : ""}
              </p>
            </div>
            {activeData && (
              <span className="updated-at">
                Updated {new Date(activeData.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          {error && <div className="notice notice--error table-notice" role="alert">{error}</div>}

          {loading ? (
            <div className="table-loading" role="status">
              <span className="spinner spinner--green" /> Gathering {view === "households" ? "household" : "room"} totals…
            </div>
          ) : view === "households" ? (
            householdData?.entries.length ? (
              <LeaderboardTable entries={householdData.entries} />
            ) : (
              <EmptyLeaderboard view="households" hasMemberships />
            )
          ) : roomData?.entries.length ? (
            <RoomLeaderboardTable entries={roomData.entries} />
          ) : (
            <EmptyLeaderboard view="rooms" hasMemberships={Boolean(roomData?.households.length)} />
          )}
        </section>

        <p className="dashboard-footnote">
          {view === "households"
            ? "Household rankings use combined kWh ÷ total occupants. Individual rooms remain private."
            : "Room rankings use room kWh ÷ room occupants and are visible only to members of that household."}
        </p>
      </main>
    </div>
  );
}

function LeaderboardTable({ entries }: { entries: LeaderboardResponse["entries"] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Household</th>
            <th scope="col">Usage per pax</th>
            <th scope="col">Total usage</th>
            <th scope="col">Occupants</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.householdId} className={entry.rank <= 3 ? `rank-${entry.rank}` : ""}>
              <td data-label="Rank"><RankBadge rank={entry.rank} /></td>
              <td data-label="Household"><span className="entity-name">{entry.householdName}</span></td>
              <td data-label="Usage per pax">
                <strong className="usage-value">{formatNumber(entry.kwhPerPax)}</strong>
                <span className="unit"> kWh / pax</span>
              </td>
              <td data-label="Total usage">{formatNumber(entry.totalKwh)} <span className="unit">kWh</span></td>
              <td data-label="Occupants">{entry.totalPax}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoomLeaderboardTable({ entries }: { entries: RoomLeaderboardResponse["entries"] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Room</th>
            <th scope="col">Usage per pax</th>
            <th scope="col">Total usage</th>
            <th scope="col">Occupants</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.roomId} className={entry.rank <= 3 ? `rank-${entry.rank}` : ""}>
              <td data-label="Rank"><RankBadge rank={entry.rank} /></td>
              <td data-label="Room"><span className="entity-name">{entry.roomName}</span></td>
              <td data-label="Usage per pax">
                <strong className="usage-value">{formatNumber(entry.kwhPerPax)}</strong>
                <span className="unit"> kWh / pax</span>
              </td>
              <td data-label="Total usage">{formatNumber(entry.totalKwh)} <span className="unit">kWh</span></td>
              <td data-label="Occupants">{entry.pax}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyLeaderboard({
  view,
  hasMemberships,
}: {
  view: LeaderboardView;
  hasMemberships: boolean;
}) {
  const noMemberships = view === "rooms" && !hasMemberships;

  return (
    <div className="empty-state">
      <span>♧</span>
      <h3>{noMemberships ? "No household memberships yet" : `No ${view === "rooms" ? "room" : "household"} usage yet`}</h3>
      <p>
        {noMemberships
          ? "Room standings appear after your account is registered to a household room."
          : "Run the sample seed to fill this leaderboard with presentation data."}
      </p>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return <span className={`rank-badge rank-badge--${rank}`} aria-label={`Rank ${rank}`}>{rank}</span>;
  }
  return <span className="rank-number">{rank}</span>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}
