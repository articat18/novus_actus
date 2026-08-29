import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../context/AuthContext";

interface LocationState {
  message?: string;
}

export function SignInPage() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const successMessage = (location.state as LocationState | null)?.message;

  if (user) {
    return <Navigate to="/leaderboard" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      await signIn(email, password);
      navigate("/leaderboard", { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <p className="eyebrow">Welcome back</p>
      <h2>Sign in to your account</h2>
      <p className="auth-card__intro">Continue your journey towards a more mindful home.</p>

      {successMessage && <div className="notice notice--success" role="status">{successMessage}</div>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field" htmlFor="email">
          <span>Email address</span>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            autoFocus
          />
        </label>
        <PasswordField
          id="password"
          name="password"
          label="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Signing in…</> : "Sign in"}
        </button>
      </form>

      <p className="auth-card__switch">
        New to Novus Actus? <Link to="/sign-up">Create an account</Link>
      </p>
    </AuthShell>
  );
}
