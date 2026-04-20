import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { clearSecret } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  Building2,
  Activity,
  LogOut,
  Key,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/farms", label: "Farms", icon: Building2 },
  { href: "/licenses", label: "Licenses", icon: Key },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();

  function handleLogout() {
    clearSecret();
    setLocation("/login");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 shrink-0 bg-sidebar flex flex-col border-r border-sidebar-border fixed h-full z-30">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-2xl font-serif text-sidebar-foreground leading-none tracking-tight">
            <span className="font-medium">mi</span><span className="font-bold">Finca</span>
          </h1>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40 mt-1">
            Admin Dashboard
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/"
                ? location === "/" || location === ""
                : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive
                        ? "text-accent"
                        : "text-sidebar-foreground/40",
                    )}
                  />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-sidebar-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
