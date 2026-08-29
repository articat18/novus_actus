import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { SignInPage } from "./pages/SignInPage";
import { SignUpPage } from "./pages/SignUpPage";

export function App() {
  const { ready } = useAuth();

  if (!ready) {
    return (
      <main className="app-loading" role="status">
        <span className="loading-mark">N</span>
        <span className="spinner spinner--green" />
        <span>Preparing your dashboard…</span>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<SignInPage />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
