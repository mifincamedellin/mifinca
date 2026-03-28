import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { useAuth, loginSchema, type LoginData } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";

export function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  
  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" }
  });

  const onSubmit = (data: LoginData) => {
    login.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Image Setup */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Farm landscape" 
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-primary/40 backdrop-blur-[2px]"></div>
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
            <p className="text-muted-foreground">{t('auth.login')}</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-foreground">{t('auth.email')}</Label>
                    <FormControl>
                      <Input 
                        placeholder="correo@ejemplo.com" 
                        {...field} 
                        className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"
                      />
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
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        className="bg-white/50 border-black/10 focus:ring-secondary rounded-xl py-6"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button 
                type="submit" 
                className="w-full py-6 text-lg rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 hover-elevate transition-all"
                disabled={login.isPending}
              >
                {login.isPending ? "..." : t('auth.login')}
              </Button>
            </form>
          </Form>

          <div className="mt-8 text-center">
            <Link href="/register" className="text-sm text-primary hover:text-accent font-medium hover:underline transition-colors">
              {t('auth.noAccount')}
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
