import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FullScreenLoader } from "./FullScreenLoader";

export function ProtectedRoute({ children }) {
  const { currentUser, authReady } = useAuth();
  const location = useLocation();

  if (!authReady) {
    return <FullScreenLoader message="認証状態を確認しています..." />;
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
