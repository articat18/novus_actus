import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./auth";
import { HomePage } from "./pages/Home";
import { SignInPage } from "./pages/SignIn";
import { SignUpPage } from "./pages/SignUp";
import { LeaderboardPage } from "./pages/Leaderboard";
import { ProfilePage } from "./pages/Profile";

export function App() {
  const { token } = useAuth();
  const authed = token !== null;

  return (
    <Routes>
      <Route
        path="/"
        element={authed ? <Navigate to="/app" replace /> : <SignInPage />}
      />
      <Route
        path="/sign_up"
        element={authed ? <Navigate to="/app" replace /> : <SignUpPage />}
      />
      <Route
        path="/app"
        element={authed ? <HomePage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/app/leaderboard"
        element={authed ? <LeaderboardPage /> : <Navigate to="/" replace />}
      />
      <Route
        path="/app/profile"
        element={authed ? <ProfilePage /> : <Navigate to="/" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
