import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, useAuth } from "@clerk/react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useStore } from "@/lib/store";

import "@/lib/fetch-interceptor";
import "@/lib/i18n";

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

// Syncs a new Clerk user's profile + farm to the backend once per sign-in
function ClerkSyncer() {
  const { isSignedIn } = useAuth();
  const { setActiveFarmId } = useStore();
  const qc = useQueryClient();
  const synced = useRef(false);

  useEffect(() => {
    if (!isSignedIn || synced.current) return;
    synced.current = true;
    fetch("/api/auth/clerk-sync", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (data.defaultFarmId) {
          setActiveFarmId(data.defaultFarmId);
          qc.invalidateQueries();
        }
      })
      .catch(console.error);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) synced.current = false;
  }, [isSignedIn]);

  return null;
}

// Clears query cache when Clerk user changes (e.g. sign-out → sign-in as different user)
function ClerkCacheInvalidator() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const prevId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevId.current !== undefined && prevId.current !== userId) qc.clear();
    prevId.current = userId;
  }, [userId]);
  return null;
}

function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/dashboard`}
      />
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ElementType }) {
  return <AppLayout><Component /></AppLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/sign-in/*?" component={SignInPage} />
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
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
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
      <ClerkSyncer />
      <ClerkCacheInvalidator />
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
