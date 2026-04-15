import { useState } from "react";
import { useLocation } from "wouter";
import { api, setSecret } from "@/lib/api";
import { Shield, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    try {
      setSecret(password);
      const ok = await api.verify(password);
      if (ok) {
        setLocation("/");
      } else {
        setSecret("");
        toast.error("Incorrect password");
      }
    } catch {
      setSecret("");
      toast.error("Could not connect to server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-sidebar-foreground">miFinca Admin</h1>
          <p className="text-sidebar-foreground/50 text-sm mt-1">Internal dashboard — team access only</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-sidebar-accent border border-sidebar-border rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wide mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="w-full bg-sidebar border border-sidebar-border rounded-xl px-4 py-3 text-sidebar-foreground text-sm placeholder:text-sidebar-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/50 pr-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-primary text-white rounded-xl py-3 text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
