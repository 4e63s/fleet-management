import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "That email and password don't match. Check them and try again."
          : "We couldn't reach the server. Check your connection and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded bg-paper shadow-[0_0_0_1px_rgba(16,36,43,0.08)]">
        <div className="bg-road px-6 py-5 text-white">
          <h1 className="font-display text-3xl font-semibold tracking-wide">Fleet Control</h1>
          <p className="mt-1 text-sm text-road-soft">Sign in to see where every vehicle is.</p>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Email
            <input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Password
            <input
              className="field"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="rounded bg-crit-soft px-3 py-2 text-sm text-crit">
              {error}
            </p>
          )}
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
