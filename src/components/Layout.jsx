import { useState, useEffect } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  LogOut,
  Stethoscope,
  ClipboardCheck,
  Menu,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
  { name: "患者管理", href: "/patients", icon: Users },
  { name: "月次一括入力", href: "/monthly-input", icon: CalendarDays },
  { name: "データチェック", href: "/data-check", icon: ClipboardCheck },
];

export const Layout = () => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const title =
    navigation.find(
      (item) => location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href))
    )?.name || "Dental Visit System";

  return (
    <div className="flex h-screen bg-slate-50">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="ナビゲーションを閉じる"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-72 bg-slate-900 text-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:w-64",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-4 flex items-center justify-between bg-slate-950">
          <div className="flex items-center space-x-3 min-w-0">
            <Stethoscope className="h-8 w-8 text-blue-400 shrink-0" />
            <span className="text-xl font-bold tracking-tight truncate">Dental Visit</span>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-300 hover:text-white hover:bg-slate-800 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="ナビゲーションを閉じる"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive =
              location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-200",
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("mr-3 h-5 w-5", isActive ? "text-white" : "text-slate-400")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <img
              src={currentUser?.photoURL || "https://ui-avatars.com/api/?name=" + (currentUser?.email || "U")}
              alt="Profile"
              className="w-10 h-10 rounded-full border-2 border-slate-700"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{currentUser?.displayName || "ユーザー"}</p>
              <p className="text-xs text-slate-400 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="mr-2 h-4 w-4" />
            ログアウト
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden lg:min-w-0">
        <header className="bg-white border-b border-slate-200 min-h-16 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="rounded-md border border-slate-200 p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="ナビゲーションを開く"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base sm:text-xl font-semibold text-slate-800 truncate">{title}</h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
