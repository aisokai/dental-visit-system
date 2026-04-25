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
  BookOpen
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
  { name: "ヘルプ", href: "/help", icon: BookOpen },
];

export const Layout = () => {
  const { currentUser } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 flex items-center space-x-3 bg-slate-950">
          <Stethoscope className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold tracking-tight">Dental Visit</span>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href));
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
              <p className="text-sm font-medium text-white truncate">
                {currentUser?.displayName || "ユーザー"}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {currentUser?.email}
              </p>
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 h-16 flex items-center px-8 shadow-sm z-10">
          <h1 className="text-xl font-semibold text-slate-800">
            {navigation.find(item => location.pathname === item.href || (item.href !== "/" && location.pathname.startsWith(item.href)))?.name || "Dental Visit System"}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
