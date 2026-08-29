import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../components/AuthShell";
import { PasswordField } from "../components/PasswordField";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

export function SignUpPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirmation: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/leaderboard" replace />;
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.password !== form.passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = await apiRequest<{ message: string }>("/api/auth/sign-up", {
        method: "POST",
        body: JSON.stringify(form),
      });
      navigate("/", { replace: true, state: { message: payload.message } });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not create account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <p className="eyebrow">Join the movement</p>
      <h2>Create your account</h2>
      <p className="auth-card__intro">A few details and you’re ready to make an impact.</p>

      {error && <div className="notice notice--error" role="alert">{error}</div>}

      <form className="auth-form auth-form--compact" onSubmit={handleSubmit}>
        <label className="field" htmlFor="name">
          <span>Full name</span>
          <input
            id="name"
            name="name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Your name"
            autoComplete="name"
            minLength={2}
            maxLength={80}
            required
            autoFocus
          />
        </label>
        <label className="field" htmlFor="email">
          <span>Email address</span>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <div className="form-grid">
          <PasswordField
            id="password"
            name="password"
            label="Password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <PasswordField
            id="password-confirmation"
            name="passwordConfirmation"
            label="Confirm password"
            value={form.passwordConfirmation}
            onChange={(event) => updateField("passwordConfirmation", event.target.value)}
            placeholder="Repeat password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Creating account…</> : "Create account"}
        </button>
      </form>

      <p className="auth-card__switch">
        Already have an account? <Link to="/">Sign in</Link>
      </p>
    </AuthShell>
  );
}
