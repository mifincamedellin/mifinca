import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, registerSchema, type RegisterData } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";

export function Register() {
  const { t, i18n } = useTranslation();
  const { register } = useAuth();

  const toggleLang = () => {
    const newLang = i18n.language === "es" ? "en" : "es";
    i18n.changeLanguage(newLang);
    localStorage.setItem("mifinca-lang", newLang);
  };
  
  const form = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: "", password: "", fullName: "", farmName: "" }
  });

  const onSubmit = (data: RegisterData) => {
    register.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden py-12">
      {/* Language Toggle */}
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-medium hover:bg-white/30 transition-all"
      >
        <span className={i18n.language === "es" ? "opacity-100" : "opacity-50"}>ES</span>
        <span className="opacity-40">/</span>
        <span className={i18n.language === "en" ? "opacity-100" : "opacity-50"}>EN</span>
      </button>

      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Farm landscape" 
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/50 backdrop-blur-[2px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="z-10 w-full max-w-md px-4"
      >
        <Card className="p-8 shadow-2xl bg-card/95 backdrop-blur-xl border-white/20 rounded-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif text-primary font-bold mb-2">Finca</h1>
            <p className="text-muted-foreground">{t('auth.register')}</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-foreground">{t('auth.name')}</Label>
                    <FormControl>
                      <Input placeholder="Juan Pérez" {...field} className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="farmName"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-foreground">{t('auth.farmName')}</Label>
                    <FormControl>
                      <Input placeholder="Finca La Esperanza" {...field} className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-foreground">{t('auth.email')}</Label>
                    <FormControl>
                      <Input placeholder="correo@ejemplo.com" {...field} className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-foreground">{t('auth.password')}</Label>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full mt-2 py-6 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover-elevate transition-all"
                disabled={register.isPending}
              >
                {register.isPending ? "..." : t('auth.register')}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center">
            <Link href="/login" className="text-sm text-primary hover:text-accent font-medium hover:underline transition-colors">
              {t('auth.hasAccount')}
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
