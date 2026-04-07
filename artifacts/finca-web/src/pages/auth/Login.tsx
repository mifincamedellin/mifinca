import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSignIn } from "@clerk/react";
import { useStore } from "@/lib/store";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const CLERK_ACCOUNTS_URL = "https://true-chamois-78.accounts.dev";

export function Login() {
  const { i18n } = useTranslation();
  const { signIn, isLoaded } = useSignIn();
  const { setToken, setActiveFarmId } = useStore();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEn = i18n.language === "en";

  const toggleLang = () => {
    i18n.changeLanguage(isEn ? "es" : "en");
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    if (isLoaded && signIn) {
      try {
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: `${window.location.origin}${basePath}/sign-in`,
          redirectUrlComplete: `${window.location.origin}${basePath}/dashboard`,
        });
        return;
      } catch (err: any) {
        console.warn("Clerk SDK OAuth failed, falling back to accounts portal", err);
      }
    }

    const redirectUrl = encodeURIComponent(`${window.location.origin}${basePath}/sign-in`);
    const afterUrl = encodeURIComponent(`${window.location.origin}${basePath}/dashboard`);
    window.location.href = `${CLERK_ACCOUNTS_URL}/sign-in?redirect_url=${redirectUrl}&after_sign_in_url=${afterUrl}`;
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) throw new Error("Demo login failed");
      const data = await res.json();
      setToken(data.token);
      if (data.defaultFarmId) setActiveFarmId(data.defaultFarmId);
      setLocation("/dashboard");
    } catch {
      setError(isEn ? "Could not load demo. Try again." : "No se pudo cargar el demo.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium hover:bg-white/30 transition-all"
      >
        <span className={!isEn ? "opacity-100" : "opacity-50"}>ES</span>
        <span className="opacity-40">/</span>
        <span className={isEn ? "opacity-100" : "opacity-50"}>EN</span>
      </button>

      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`}
          alt="Farm landscape"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/40 backdrop-blur-[1px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="z-10 w-full max-w-sm px-4"
      >
        <Card className="p-8 shadow-2xl bg-card/95 backdrop-blur-xl border-white/20 rounded-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif text-primary font-bold mb-2">miFinca</h1>
            <p className="text-muted-foreground text-sm">
              {isEn ? "Sign in to manage your farm" : "Inicia sesión para gestionar tu finca"}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive text-center mb-4">{error}</p>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-black/12 bg-white hover:bg-gray-50 active:bg-gray-100 shadow-sm transition-all text-[#3c4043] text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="animate-pulse">...</span>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <g fill="none" fillRule="evenodd">
                      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </g>
                  </svg>
                  {isEn ? "Sign in with Google" : "Continuar con Google"}
                </>
              )}
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="flex-1 border-t border-black/10" />
              <span className="text-xs text-muted-foreground">{isEn ? "or" : "o"}</span>
              <span className="flex-1 border-t border-black/10" />
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              🌾 {isEn ? "Try the demo" : "Explorar con demo"}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
