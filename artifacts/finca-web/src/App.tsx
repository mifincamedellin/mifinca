import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useStore } from "@/lib/store";

import "@/lib/fetch-interceptor";
import "@/lib/i18n";

// ── Synchronous OAuth callback hydration ─────────────────────────────────────
// Read _auth_token and _farm_id from the URL *before* the first React render
// so AppLayout sees the token immediately and never shows a blank screen.
{
  const _p = new URLSearchParams(window.location.search);
  const _t = _p.get("_auth_token");
  const _f = _p.get("_farm_id");
  if (_t) {
    useStore.setState({ token: _t, activeFarmId: _f ?? null });
    window.history.replaceState({}, "", window.location.pathname);
  }
}

import { AppLayout } from "@/components/layout/AppLayout";
import { Login } from "@/pages/auth/Login";
import { Dashboard } from "@/pages/Dashboard";
import { AnimalList } from "@/pages/animals/AnimalList";
import { AnimalDetail } from "@/pages/animals/AnimalDetail";
import { InventoryList } from "@/pages/inventory/InventoryList";
import { Land } from "@/pages/Land";
import { Settings } from "@/pages/Settings";
import { Finances } from "@/pages/Finances";
import { Contacts } from "@/pages/Contacts";
import { Employees } from "@/pages/Employees";
import { Calendar } from "@/pages/Calendar";
import { AllActivity } from "@/pages/AllActivity";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function OAuthCallbackHandler() {
  const { setToken, setActiveFarmId } = useStore();
  const [, setLocation] = useLocation();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("_auth_token");
    const farmId = params.get("_farm_id");
    const errorParam = params.get("error");

    if (token) {
      handled.current = true;
      setToken(token);
      if (farmId) setActiveFarmId(farmId);
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
      setLocation("/dashboard");
    } else if (errorParam) {
      handled.current = true;
      window.history.replaceState({}, "", window.location.pathname);
      setLocation(`/login?error=${encodeURIComponent(errorParam)}`);
    }
  }, []);

  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ElementType }) {
  return <AppLayout><Component /></AppLayout>;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <OAuthCallbackHandler />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/animals" component={() => <ProtectedRoute component={AnimalList} />} />
        <Route path="/animals/:id" component={() => <ProtectedRoute component={AnimalDetail} />} />
        <Route path="/inventory" component={() => <ProtectedRoute component={InventoryList} />} />
        <Route path="/land" component={() => <ProtectedRoute component={Land} />} />
        <Route path="/finances" component={() => <ProtectedRoute component={Finances} />} />
        <Route path="/contacts" component={() => <ProtectedRoute component={Contacts} />} />
        <Route path="/employees" component={() => <ProtectedRoute component={Employees} />} />
        <Route path="/calendar" component={() => <ProtectedRoute component={Calendar} />} />
        <Route path="/activity" component={() => <ProtectedRoute component={AllActivity} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function AppWithClerk() {
  const [, setLocation] = useLocation();
  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

  return (
    <ClerkProvider
      publishableKey={clerkPubKey || "pk_test_placeholder"}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Router />
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <AppWithClerk />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
