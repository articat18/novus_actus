import type { ReactNode } from "react";

/** Centered masthead + card layout shared by the sign-in and sign-up pages. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="masthead">
        <div className="logo" aria-hidden="true">
          ⚡
        </div>
        <div>
          <h1>Energy Leaderboard</h1>
          <p>University apartment-energy competition</p>
        </div>
      </header>
      <main className="card auth-card">
        <h2>{title}</h2>
        <p className="sub">{subtitle}</p>
        {children}
      </main>
      {footer !== undefined && <p className="switch">{footer}</p>}
    </div>
  );
}
