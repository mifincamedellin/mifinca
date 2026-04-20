import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { getSecret } from "@/lib/api";
import { AdminLayout } from "@/components/layout/AdminLayout";
import Login from "@/pages/Login";
import Overview from "@/pages/Overview";
import Users from "@/pages/Users";
import UserDetail from "@/pages/UserDetail";
import Farms from "@/pages/Farms";
import FarmDetail from "@/pages/FarmDetail";
import ActivityLog from "@/pages/ActivityLog";
import Licenses from "@/pages/Licenses";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  if (!getSecret()) {
    setLocation("/login");
    return null;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => (
          <RequireAuth>
            <AdminLayout>
              <Overview />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/users">
        {() => (
          <RequireAuth>
            <AdminLayout>
              <Users />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/users/:id">
        {(params) => (
          <RequireAuth>
            <AdminLayout>
              <UserDetail id={params.id} />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/farms">
        {() => (
          <RequireAuth>
            <AdminLayout>
              <Farms />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/farms/:id">
        {(params) => (
          <RequireAuth>
            <AdminLayout>
              <FarmDetail id={params.id} />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/activity">
        {() => (
          <RequireAuth>
            <AdminLayout>
              <ActivityLog />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route path="/licenses">
        {() => (
          <RequireAuth>
            <AdminLayout>
              <Licenses />
            </AdminLayout>
          </RequireAuth>
        )}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
