import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

// Setup global fetch interceptor & i18n
import "@/lib/fetch-interceptor";
import "@/lib/i18n";

import { AppLayout } from "@/components/layout/AppLayout";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { Dashboard } from "@/pages/Dashboard";
import { AnimalList } from "@/pages/animals/AnimalList";
import { AnimalDetail } from "@/pages/animals/AnimalDetail";
import { InventoryList } from "@/pages/inventory/InventoryList";
import { Land } from "@/pages/Land";
import { Settings } from "@/pages/Settings";
import { Finances } from "@/pages/Finances";
import { Contacts } from "@/pages/Contacts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ElementType }) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected Routes inside AppLayout */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/animals" component={() => <ProtectedRoute component={AnimalList} />} />
      <Route path="/animals/:id" component={() => <ProtectedRoute component={AnimalDetail} />} />
      <Route path="/inventory" component={() => <ProtectedRoute component={InventoryList} />} />
      <Route path="/land" component={() => <ProtectedRoute component={Land} />} />
      <Route path="/finances" component={() => <ProtectedRoute component={Finances} />} />
      <Route path="/contacts" component={() => <ProtectedRoute component={Contacts} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
