import { ReactNode, useEffect } from "react";
import { FarmAdvisor } from "@/components/FarmAdvisor";
import { SeedButton } from "@/components/SeedButton";
import { SidebarThemePicker } from "@/components/SidebarThemePicker";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore } from "@/lib/store";
import { useGetMe, useListFarms } from "@workspace/api-client-react";
import { useAuth, useClerk } from "@clerk/react";
import { 
  Home, 
  PawPrint, 
  Package, 
  Map as MapIcon, 
  Settings, 
  LogOut,
  DollarSign,
  Users,
  UserCheck,
  CalendarDays,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { token, logout, activeFarmId, setActiveFarmId, sidebarTheme } = useStore();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { signOut } = useClerk();

  // Consider authenticated if: demo JWT present, or Clerk session active
  const isAuthenticated = !!token || !!isSignedIn;

  const { data: user, isError: authFailed } = useGetMe({
    query: { enabled: isAuthenticated, retry: false }
  });

  const { data: farms } = useListFarms({
    query: { enabled: isAuthenticated && !authFailed }
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!clerkLoaded) return; // wait for Clerk to initialise
    if (!isAuthenticated && location !== '/login') {
      setLocation('/login');
    }
  }, [isAuthenticated, clerkLoaded, location, setLocation]);

  useEffect(() => {
    if (authFailed && token) {
      logout();
      setLocation('/login');
    }
  }, [authFailed, token, logout, setLocation]);

  // Set initial active farm
  useEffect(() => {
    if (farms && farms.length > 0 && !activeFarmId) {
      setActiveFarmId(farms[0].id);
    }
  }, [farms, activeFarmId, setActiveFarmId]);

  // Not yet ready
  if (!clerkLoaded || !isAuthenticated) return null;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const navItems = [
    { title: t('nav.dashboard'), url: "/dashboard", icon: Home },
    { title: t('nav.animals'), url: "/animals", icon: PawPrint },
    { title: t('nav.inventory'), url: "/inventory", icon: Package },
    { title: t('nav.finances'), url: "/finances", icon: DollarSign },
    { title: t('nav.contacts'), url: "/contacts", icon: Users },
    { title: t('nav.employees'), url: "/employees", icon: UserCheck },
    { title: t('nav.calendar'), url: "/calendar", icon: CalendarDays },
    { title: t('nav.land'), url: "/land", icon: MapIcon },
    { title: t('nav.settings'), url: "/settings", icon: Settings },
  ];

  const handleLogout = async () => {
    if (isSignedIn) {
      await signOut();
    }
    logout(); // clear Zustand store (token, activeFarmId)
    setLocation('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div data-sidebar-theme={sidebarTheme} className={`flex min-h-screen w-full bg-background${sidebarTheme === "vaca" ? " dark" : ""}`}>
        <Sidebar className="border-r-border/50">
          <SidebarContent>
            <div className="p-6">
              <h1 className="text-2xl font-serif text-sidebar-foreground">
                <span className="font-medium">mi</span><span className="font-bold">Finca</span>
              </h1>
            </div>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/50">Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => {
                    const isActive = location.startsWith(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          className="hover-elevate rounded-xl transition-all font-medium py-6"
                        >
                          <Link href={item.url} className={isActive ? "text-accent-foreground" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}>
                            <item.icon className={`h-5 w-5 ${isActive ? "text-accent" : "text-sidebar-foreground/50"}`} />
                            <span className="ml-3 text-base">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="px-4 pt-2 pb-4">
            <div className="flex items-center gap-3 mt-1 pt-2 border-t border-sidebar-border">
              <Avatar className="h-10 w-10 border-2 border-accent/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-serif">
                  {user?.fullName?.substring(0, 2).toUpperCase() || 'FI'}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.fullName || t('common.userFallback')}</span>
                <button onClick={handleLogout} className="text-xs text-sidebar-foreground/60 hover:text-accent text-left flex items-center gap-1 mt-0.5 transition-colors">
                  <LogOut className="h-3 w-3" /> {t('common.logout')}
                </button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              {farms && farms.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="font-serif text-lg text-primary hover:bg-black/5 hover-elevate border border-transparent hover:border-black/5 px-4 h-10 rounded-xl">
                      {farms.find(f => f.id === activeFarmId)?.name || t('common.selectFarm')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-xl border-border/50 shadow-lg p-1">
                    {farms.map(farm => (
                      <DropdownMenuItem 
                        key={farm.id} 
                        onClick={() => setActiveFarmId(farm.id)}
                        className={`rounded-lg cursor-pointer my-0.5 py-2.5 ${activeFarmId === farm.id ? 'bg-primary/5 text-primary font-medium' : ''}`}
                      >
                        {farm.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SeedButton />
              <SidebarThemePicker placement="header" />
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/5 hover:bg-black/10 border border-black/8 text-sm font-medium text-foreground/70 hover:text-foreground transition-all"
              >
                <span className={i18n.language === "es" ? "opacity-100 text-primary font-semibold" : "opacity-40"}>ES</span>
                <span className="opacity-30">/</span>
                <span className={i18n.language === "en" ? "opacity-100 text-primary font-semibold" : "opacity-40"}>EN</span>
              </button>
            </div>
          </header>
          <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
            {children}
          </main>
        </div>
        <FarmAdvisor />
      </div>
    </SidebarProvider>
  );
}
