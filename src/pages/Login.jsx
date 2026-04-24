import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { Stethoscope, LogIn } from "lucide-react";
import { auth, googleProvider } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const redirectPath = location.state?.from?.pathname || "/";

  if (currentUser) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleLogin = async () => {
    setError("");
    setIsLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (loginError) {
      console.error("Login failed:", loginError);
      setError("ログインに失敗しました。時間をおいて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <Stethoscope className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Dental Visit</h1>
            <p className="text-sm text-slate-500">訪問歯科 管理システム</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <LogIn className="h-4 w-4" />
          {isLoading ? "ログイン中..." : "Googleでログイン"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
