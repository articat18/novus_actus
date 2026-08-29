/**
 * Application shell. Email + password accounts are the primary route; the
 * passwordless university flow remains available as a secondary demo panel.
 */
import { useState } from "react";

import { AccountsPanel } from "./AccountsPanel";
import { UniversityDemo } from "./UniversityDemo";

type Panel = "accounts" | "university";

export function App() {
  const [panel, setPanel] = useState<Panel>("accounts");

  return (
    <div className="app">
      <header className="masthead">
        <div className="logo" aria-hidden="true">
          ⚡
        </div>
        <div>
          <h1>Energy Leaderboard</h1>
          <p>Households and organizations competing on energy — demo</p>
        </div>
        <nav className="panel-switch">
          <button
            type="button"
            className={panel === "accounts" ? "active" : ""}
            aria-current={panel === "accounts"}
            onClick={() => setPanel("accounts")}
          >
            Accounts &amp; groups
          </button>
          <button
            type="button"
            className={panel === "university" ? "active" : ""}
            aria-current={panel === "university"}
            onClick={() => setPanel("university")}
          >
            University demo
          </button>
        </nav>
      </header>

      {panel === "accounts" ? <AccountsPanel /> : <UniversityDemo />}

      <footer>
        Postgres + ERN (Express · React · Node · TypeScript) · Prisma ·
        deployable on Vercel
      </footer>
    </div>
  );
}
