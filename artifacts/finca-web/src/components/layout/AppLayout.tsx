import { ReactNode, useEffect, useState } from "react";
import { FarmAdvisor } from "@/components/FarmAdvisor";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useUpgradeStore } from "@/lib/upgradeStore";
import { SeedButton } from "@/components/SeedButton";
import { SidebarThemePicker } from "@/components/SidebarThemePicker";
import { Link, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useStore, ALL_FARMS_ID } from "@/lib/store";
import { useGetMe, useListFarms, getGetMeQueryKey, getListFarmsQueryKey } from "@workspace/api-client-react";
import { useAuth, useClerk } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Pencil,
  Plus,
  Check,
  ShieldCheck,
  Droplets,
  Layers,
} from "lucide-react";
import { useFarmPermissions } from "@/lib/useFarmPermissions";
import type { FarmPermissions } from "@/lib/useFarmPermissions";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppLayout({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [location, setLocation] = useLocation();
  const { token, logout, activeFarmId, setActiveFarmId, sidebarTheme } = useStore();
  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { openUpgradeModal } = useUpgradeStore();

  const [editingFarm, setEditingFarm] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLocation, setNewFarmLocation] = useState("");

  const renameFarm = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await fetch(`/api/farms/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("rename failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/farms"] });
      setEditingFarm(null);
    },
  });

  const addFarm = useMutation({
    mutationFn: async ({ name, location }: { name: string; location: string }) => {
      const res = await fetch("/api/farms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, location: location.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error("add failed"), { data: body });
      }
      return res.json();
    },
    onSuccess: (farm) => {
      qc.invalidateQueries({ queryKey: ["/api/farms"] });
      setActiveFarmId(farm.id);
      setShowAddFarm(false);
      setNewFarmName("");
      setNewFarmLocation("");
    },
    onError: (err: any) => {
      if (err?.data?.error === "plan_limit") {
        setShowAddFarm(false);
        openUpgradeModal("farms", err.data.limit);
      }
    },
  });

  // Consider authenticated if: demo JWT present, or Clerk session active
  const isAuthenticated = !!token || !!isSignedIn;

  const { data: user, isError: authFailed } = useGetMe({
    query: { queryKey: getGetMeQueryKey(), enabled: isAuthenticated, retry: 3, retryDelay: 2000 }
  });

  const { data: farms } = useListFarms({
    query: { queryKey: getListFarmsQueryKey(), enabled: isAuthenticated && !authFailed }
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

  // Set initial active farm (don't override an already-set activeFarmId, including ALL_FARMS_ID)
  useEffect(() => {
    if (farms && farms.length > 0 && !activeFarmId) {
      setActiveFarmId(farms[0].id);
    }
  }, [farms, activeFarmId, setActiveFarmId]);

  // Sync theme to <html> so Dialog/Sheet portals (rendered outside this div) inherit CSS variables and dark: variants
  useEffect(() => {
    document.documentElement.setAttribute("data-sidebar-theme", sidebarTheme);
    if (sidebarTheme === "vaca") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    return () => {
      document.documentElement.removeAttribute("data-sidebar-theme");
      document.documentElement.classList.remove("dark");
    };
  }, [sidebarTheme]);

  // If we have a JWT token (Google OAuth / demo), show immediately — no need
  // to wait for Clerk to initialise.  Only gate on clerkLoaded when the user
  // relies on a Clerk session rather than our own JWT.
  if (!token && !clerkLoaded) return null;
  if (!isAuthenticated) return null;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const { can, isOwner } = useFarmPermissions();

  const allNavItems = [
    { title: t('nav.dashboard'), url: "/dashboard", icon: Home, perm: null },
    { title: t('nav.animals'), url: "/animals", icon: PawPrint, perm: "can_view_animals" as keyof FarmPermissions },
    { title: t('nav.milk'), url: "/milk", icon: Droplets, perm: "can_view_animals" as keyof FarmPermissions },
    { title: t('nav.inventory'), url: "/inventory", icon: Package, perm: "can_view_inventory" as keyof FarmPermissions },
    { title: t('nav.finances'), url: "/finances", icon: DollarSign, perm: "can_view_finances" as keyof FarmPermissions },
    { title: t('nav.contacts'), url: "/contacts", icon: Users, perm: "can_view_contacts" as keyof FarmPermissions },
    { title: t('nav.employees'), url: "/employees", icon: UserCheck, perm: "can_view_employees" as keyof FarmPermissions },
    { title: t('nav.calendar'), url: "/calendar", icon: CalendarDays, perm: "can_view_calendar" as keyof FarmPermissions },
    { title: t('nav.land'), url: "/land", icon: MapIcon, perm: null },
    { title: t('nav.settings'), url: "/settings", icon: Settings, perm: null },
  ];

  const navItems = allNavItems.filter(item => !item.perm || can(item.perm));

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
    localStorage.setItem("mifinca-lang", newLang);
  };

  const displayName = user?.isDemo
    ? (i18n.language === "en" ? "Owner" : "Dueño")
    : (user?.fullName || t('common.userFallback'));

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      {/* Mobile status-bar colour band — fills the safe-area behind the OS clock/signal/battery icons */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-[200] bg-primary"
        style={{ height: "env(safe-area-inset-top)" }}
      />
      <div
        data-sidebar-theme={sidebarTheme}
        className={`flex min-h-screen w-full bg-background${sidebarTheme === "vaca" ? " dark" : ""}`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
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
            {isOwner && (
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.startsWith("/roles")}
                    className="hover-elevate rounded-xl transition-all font-medium py-5"
                  >
                    <Link href="/roles" className={location.startsWith("/roles") ? "text-accent-foreground" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"}>
                      <ShieldCheck className={`h-5 w-5 ${location.startsWith("/roles") ? "text-accent" : "text-sidebar-foreground/50"}`} />
                      <span className="ml-3 text-base">{t('nav.roles')}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            )}
            <div className="flex items-center gap-3 mt-1 pt-2 border-t border-sidebar-border">
              <Avatar className="h-10 w-10 border-2 border-accent/20">
                <AvatarFallback className="bg-primary text-primary-foreground font-serif">
                  {displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</span>
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
                    <Button variant="ghost" className="font-serif text-lg text-primary hover:bg-black/5 hover-elevate border border-transparent hover:border-black/5 px-4 h-10 rounded-xl flex items-center gap-2">
                      {activeFarmId === ALL_FARMS_ID
                        ? <><Layers className="h-4 w-4 shrink-0" />{t('farms.allFarms')}</>
                        : (farms.find(f => f.id === activeFarmId)?.name || t('common.selectFarm'))}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56 rounded-xl border-border/50 shadow-lg p-1">
                    {farms.length >= 2 && (
                      <>
                        <DropdownMenuItem
                          onClick={() => setActiveFarmId(ALL_FARMS_ID)}
                          className={`rounded-lg cursor-pointer my-0.5 py-2.5 px-3 flex items-center gap-2 ${activeFarmId === ALL_FARMS_ID ? 'bg-primary/5 text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          <Layers className="h-4 w-4 shrink-0" />
                          <span className="text-sm">{t('farms.allFarms')}</span>
                          {activeFarmId === ALL_FARMS_ID && <Check className="h-4 w-4 ml-auto shrink-0" />}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1" />
                      </>
                    )}
                    {farms.map(farm => {
                      const isActive = activeFarmId === farm.id;
                      return (
                        <DropdownMenuItem
                          key={farm.id}
                          onClick={() => setActiveFarmId(farm.id)}
                          className={`rounded-lg cursor-pointer my-0.5 py-2.5 pr-2 flex items-center justify-between gap-2 ${isActive ? 'bg-primary/5 text-primary font-medium' : ''}`}
                        >
                          <span className="truncate">{farm.name}</span>
                          {isActive && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setEditName(farm.name);
                                setEditingFarm({ id: farm.id, name: farm.name });
                              }}
                              className="shrink-0 p-1 rounded-md hover:bg-primary/10 text-primary/60 hover:text-primary transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                      onClick={() => { setNewFarmName(""); setNewFarmLocation(""); setShowAddFarm(true); }}
                      className="rounded-lg cursor-pointer my-0.5 py-2.5 text-muted-foreground hover:text-foreground gap-2"
                    >
                      <Plus className="h-4 w-4 shrink-0" />
                      {t('farms.addFarm')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden md:block"><SeedButton /></span>
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
          <main className="flex-1 p-6 md:p-8 overflow-y-auto overflow-x-hidden w-full max-w-7xl mx-auto">
            {children}
          </main>
        </div>
        <FarmAdvisor />
      </div>

      <UpgradeModal />

      {/* Rename farm dialog */}
      <Dialog open={!!editingFarm} onOpenChange={open => { if (!open) setEditingFarm(null); }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">{t('farms.renameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('farms.namePlaceholder')}
              className="rounded-xl"
              onKeyDown={e => { if (e.key === "Enter" && editName.trim() && editingFarm) renameFarm.mutate({ id: editingFarm.id, name: editName.trim() }); }}
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditingFarm(null)}>{t('common.cancel')}</Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                disabled={!editName.trim() || renameFarm.isPending}
                onClick={() => editingFarm && renameFarm.mutate({ id: editingFarm.id, name: editName.trim() })}
              >
                <Check className="h-4 w-4" /> {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add farm dialog */}
      <Dialog open={showAddFarm} onOpenChange={open => { if (!open) { setShowAddFarm(false); setNewFarmName(""); setNewFarmLocation(""); } }}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">{t('farms.addTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Input
              value={newFarmName}
              onChange={e => setNewFarmName(e.target.value)}
              placeholder={t('farms.namePlaceholder')}
              className="rounded-xl"
              onKeyDown={e => { if (e.key === "Enter" && newFarmName.trim()) addFarm.mutate({ name: newFarmName.trim(), location: newFarmLocation }); }}
              autoFocus
            />
            <Input
              value={newFarmLocation}
              onChange={e => setNewFarmLocation(e.target.value)}
              placeholder={t('farms.locationPlaceholder')}
              className="rounded-xl"
              onKeyDown={e => { if (e.key === "Enter" && newFarmName.trim()) addFarm.mutate({ name: newFarmName.trim(), location: newFarmLocation }); }}
            />
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { setShowAddFarm(false); setNewFarmName(""); setNewFarmLocation(""); }}>{t('common.cancel')}</Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                disabled={!newFarmName.trim() || addFarm.isPending}
                onClick={() => newFarmName.trim() && addFarm.mutate({ name: newFarmName.trim(), location: newFarmLocation })}
              >
                <Plus className="h-4 w-4" /> {t('farms.addFarm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
