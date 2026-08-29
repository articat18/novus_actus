import type { ReactNode } from "react";
import { Brand } from "./Brand";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="About Novus Actus Interveniens">
        <Brand />
        <div className="auth-story__content">
          <p className="eyebrow eyebrow--light">A lighter footprint, together</p>
          <h1>Small acts.<br />Shared impact.</h1>
          <p>
            See how your household measures up and turn everyday energy choices into
            meaningful progress.
          </p>
        </div>
        <div className="auth-story__proof">
          <span className="proof-icon" aria-hidden="true">✓</span>
          <div>
            <strong>Privacy comes first</strong>
            <span>Only household totals are ranked—never individuals or rooms.</span>
          </div>
        </div>
        <div className="orb orb--one" />
        <div className="orb orb--two" />
      </section>
      <section className="auth-panel">
        <div className="auth-panel__mobile-brand"><Brand /></div>
        <div className="auth-card">{children}</div>
        <p className="auth-footer">© {new Date().getFullYear()} Novus Actus Interveniens</p>
      </section>
    </main>
  );
}
