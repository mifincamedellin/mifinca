import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Map,
  BarChart3,
  Users,
  Package,
  Sprout,
  CheckCircle2,
  Menu,
  X,
  Globe,
  MessageSquare,
} from "lucide-react";

const APP_URL: string = (import.meta as any).env?.VITE_APP_URL ?? "/app";

type Lang = "es" | "en";

const translations = {
  es: {
    nav: {
      features: "Características",
      advisor: "Asesor IA",
      pricing: "Planes",
      cta: "Empezar Gratis",
    },
    hero: {
      badge: "Hecho para el campo colombiano",
      h1a: "La claridad que",
      h1b: "su finca",
      h1c: "necesita.",
      sub: "El software de gestión para ganaderos que valoran su tiempo. Sin complicaciones. Sin enredos. Solo control total de sus animales, inventario y finanzas.",
      ctaPrimary: "Crear cuenta gratis",
      ctaSecondary: "Ver demostración",
      social: "Más de 500 fincas ya lo usan",
      stat: "Ganancia mensual",
    },
    features: {
      heading: "Todo bajo control,\ndesde cualquier lugar.",
      sub: "Reemplazamos las libretas y las\nhojas de cálculo confusas\ncon herramientas diseñadas para la\nrealidad del campo.",
      items: [
        {
          title: "Control de Animales",
          desc: "Lleve el historial de peso, registros médicos, vacunas y linaje completo. Sepa exactamente el estado de cada animal.",
        },
        {
          title: "Inventario Inteligente",
          desc: "Controle insumos, reciba alertas de stock bajo y registre el uso diario. Nunca se quede sin lo necesario.",
        },
        {
          title: "Finanzas Claras",
          desc: "Registre ingresos y gastos fácilmente. Visualice la rentabilidad de su finca con gráficos claros y directos.",
        },
        {
          title: "Mapa Interactivo",
          desc: "Mapee sus potreros y zonas. Controle la rotación, el estado de los pastos y el uso de la tierra visualmente.",
        },
        {
          title: "Gestión de Personal",
          desc: "Administre sus empleados, asigne tareas, guarde documentos importantes y mantenga la comunicación clara.",
        },
        {
          title: "Soporte Multi-finca",
          desc: "¿Tiene varias propiedades? Adminístrelas todas desde una sola cuenta, manteniendo la información separada y organizada.",
        },
      ],
    },
    advisor: {
      badge: "Inteligencia Artificial",
      heading: "El primer asesor inteligente para el campo.",
      sub: "Tome decisiones informadas. Pregunte a su Asesor IA sobre enfermedades, precios de mercado o técnicas de pastoreo, en español o inglés, y obtenga respuestas precisas con datos de la web en tiempo real.",
      bullets: [
        "Consultas de mercado y clima en tiempo real",
        "Consejos sobre salud animal y nutrición",
        "Asistencia bilingüe inmediata",
      ],
      cta: "Conocer al Asesor",
      chatOnline: "En línea",
      chatName: "Asesor Finca",
      chatQ: "¿Cuál es el precio actual del ganado en pie en subastas de Antioquia?",
      chatA: "Según los últimos reportes de hoy, el precio promedio del ganado gordo en pie en Antioquia es de $8.200 a $8.500 COP por kilo...",
    },
    pricing: {
      heading: "Precios simples y justos.",
      sub: "Invierta en tranquilidad. Cancele en cualquier momento.",
      monthly: "Mensual",
      annual: "Anual",
      save: "Ahorre 20%",
      popular: "Más popular",
      perMonth: "/mes",
      perYear: "/año",
      custom: "A la medida",
      tiers: [
        {
          name: "Semilla",
          desc: "Para empezar a organizarse.",
          features: ["1 finca", "Hasta 10 animales", "1 empleado", "1 contacto", "Sin asesor IA"],
          cta: "Empezar gratis",
        },
        {
          name: "Agricultor",
          desc: "Todo lo que necesita un ganadero.",
          features: ["1 finca", "Animales ilimitados", "Todas las funciones", "Asesor IA integrado", "Soporte estándar"],
          cta: "Probar por 14 días",
        },
        {
          name: "Pro",
          desc: "Para operaciones a gran escala.",
          features: ["Fincas ilimitadas", "Animales ilimitados", "Todas las funciones", "Reportes personalizados", "Soporte prioritario"],
          cta: "Contactar ventas",
        },
      ],
    },
    lifestyle: {
      heading: "Menos tiempo administrando.",
      headingLine2: "Más tiempo en lo importante.",
      cta: "Unirse a Finca Hoy",
    },
    footer: {
      tagline: "Software de gestión diseñado específicamente para la realidad del campo colombiano. Simple, claro y potente.",
      product: "Producto",
      productLinks: ["Características", "Asesor IA", "Precios", "Actualizaciones"],
      company: "Compañía",
      companyLinks: ["Sobre nosotros", "Blog", "Contacto"],
      legal: "Legal",
      legalLinks: ["Términos de servicio", "Privacidad"],
      copyright: "Todos los derechos reservados.",
      imgAlt: "Ganadero usando tecnología Finca",
      heroAlt: "Paisaje de finca colombiana",
    },
  },
  en: {
    nav: {
      features: "Features",
      advisor: "AI Advisor",
      pricing: "Pricing",
      cta: "Get Started Free",
    },
    hero: {
      badge: "Built for the Colombian countryside",
      h1a: "The clarity your",
      h1b: "farm",
      h1c: "needs.",
      sub: "Farm management software for ranchers who value their time. No complications. No clutter. Just total control of your animals, inventory, and finances.",
      ctaPrimary: "Create free account",
      ctaSecondary: "View demo",
      social: "Over 500 farms already using it",
      stat: "Monthly profit",
    },
    features: {
      heading: "Everything under control,\nfrom anywhere.",
      sub: "We replace confusing notebooks\nand spreadsheets\nwith tools designed for the\nreality of farm life.",
      items: [
        {
          title: "Animal Tracking",
          desc: "Keep weight history, medical records, vaccinations, and full lineage. Know the exact status of every animal.",
        },
        {
          title: "Smart Inventory",
          desc: "Track supplies, receive low-stock alerts, and log daily usage. Never run out of what you need.",
        },
        {
          title: "Clear Finances",
          desc: "Easily record income and expenses. Visualize your farm's profitability with clear, straightforward charts.",
        },
        {
          title: "Interactive Map",
          desc: "Map your paddocks and zones. Visually manage rotation, pasture condition, and land usage.",
        },
        {
          title: "Staff Management",
          desc: "Manage your employees, assign tasks, store important documents, and keep communication clear.",
        },
        {
          title: "Multi-farm Support",
          desc: "Have multiple properties? Manage them all from one account, keeping each farm's data separate and organized.",
        },
      ],
    },
    advisor: {
      badge: "Artificial Intelligence",
      heading: "The first intelligent advisor for the farm.",
      sub: "Make informed decisions. Ask your AI Advisor about diseases, market prices, or grazing techniques — in Spanish or English — and get precise answers with real-time web data.",
      bullets: [
        "Real-time market and weather queries",
        "Animal health and nutrition advice",
        "Immediate bilingual assistance",
      ],
      cta: "Meet the Advisor",
      chatOnline: "Online",
      chatName: "Finca Advisor",
      chatQ: "What is the current live cattle price at Antioquia auctions?",
      chatA: "According to today's latest reports, the average price for live cattle in Antioquia is $8,200 to $8,500 COP per kilo...",
    },
    pricing: {
      heading: "Simple, honest pricing.",
      sub: "Invest in peace of mind. Cancel anytime.",
      monthly: "Monthly",
      annual: "Annual",
      save: "Save 20%",
      popular: "Most popular",
      perMonth: "/mo",
      perYear: "/yr",
      custom: "Custom",
      tiers: [
        {
          name: "Seed",
          desc: "To start getting organized.",
          features: ["1 farm", "Up to 10 animals", "1 employee", "1 contact", "No AI Advisor"],
          cta: "Start for free",
        },
        {
          name: "Farmer",
          desc: "Everything a rancher needs.",
          features: ["1 farm", "Unlimited animals", "All features", "AI Advisor included", "Standard support"],
          cta: "Try free for 14 days",
        },
        {
          name: "Pro",
          desc: "For large-scale operations.",
          features: ["Unlimited farms", "Unlimited animals", "All features", "Custom reports", "Priority support"],
          cta: "Contact sales",
        },
      ],
    },
    lifestyle: {
      heading: "Less time managing.",
      headingLine2: "More time where it matters.",
      cta: "Join Finca Today",
    },
    footer: {
      tagline: "Farm management software designed specifically for the reality of the Colombian countryside. Simple, clear, and powerful.",
      product: "Product",
      productLinks: ["Features", "AI Advisor", "Pricing", "Updates"],
      company: "Company",
      companyLinks: ["About us", "Blog", "Contact"],
      legal: "Legal",
      legalLinks: ["Terms of service", "Privacy"],
      copyright: "All rights reserved.",
      imgAlt: "Farmer using Finca technology",
      heroAlt: "Colombian farm landscape",
    },
  },
};

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);
  const [lang, setLang] = useState<Lang>("es");

  const t = translations[lang];

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const getBaseUrl = () => import.meta.env.BASE_URL.replace(/\/$/, "");

  const toggleLang = () => setLang((l) => (l === "es" ? "en" : "es"));

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-secondary selection:text-secondary-foreground overflow-x-hidden">
      {/* Navigation */}
      <header
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
          isScrolled
            ? "bg-background/90 backdrop-blur-md border-border/50 py-3 shadow-sm"
            : "bg-transparent border-transparent py-5"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={`${getBaseUrl()}/images/logo-icon.png`} alt="miFinca" className="h-9 w-9 object-contain rounded-lg" />
            <span className="font-serif text-2xl tracking-tight text-primary"><span className="font-medium">mi</span><span className="font-bold">Finca</span></span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollTo("caracteristicas")}
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors cursor-pointer"
            >
              {t.nav.features}
            </button>
            <button
              onClick={() => scrollTo("asesor")}
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors cursor-pointer"
            >
              {t.nav.advisor}
            </button>
            <button
              onClick={() => scrollTo("planes")}
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors cursor-pointer"
            >
              {t.nav.pricing}
            </button>
            <div className="w-px h-5 bg-border mx-2"></div>
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-primary transition-colors px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5"
            >
              <Globe className="h-4 w-4" />
              {lang === "es" ? "ES" : "EN"}
            </button>
            <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 hover-elevate rounded-full px-6">
              <a href={`${APP_URL}/login`}>{t.nav.cta}</a>
            </Button>
          </nav>

          <button
            className="md:hidden text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-sm pt-24 px-6 md:hidden flex flex-col gap-6 animate-in slide-in-from-top-4">
          <button
            onClick={() => scrollTo("caracteristicas")}
            className="text-xl font-serif text-left border-b border-border pb-4"
          >
            {t.nav.features}
          </button>
          <button
            onClick={() => scrollTo("asesor")}
            className="text-xl font-serif text-left border-b border-border pb-4"
          >
            {t.nav.advisor}
          </button>
          <button
            onClick={() => scrollTo("planes")}
            className="text-xl font-serif text-left border-b border-border pb-4"
          >
            {t.nav.pricing}
          </button>
          <button
            onClick={() => { toggleLang(); setMobileMenuOpen(false); }}
            className="flex items-center gap-2 text-xl font-serif text-left border-b border-border pb-4"
          >
            <Globe className="h-5 w-5" />
            {lang === "es" ? "Switch to English" : "Cambiar a Español"}
          </button>
          <Button asChild className="bg-primary text-primary-foreground w-full py-6 text-lg mt-4 rounded-xl">
            <a href={`${APP_URL}/login`}>{t.nav.cta}</a>
          </Button>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section className="relative pt-40 pb-0 md:pt-52 px-6 overflow-hidden">
          {/* Background glow — centred */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[900px] h-[700px] bg-secondary/15 rounded-full blur-3xl pointer-events-none"></div>

          <div className="container mx-auto max-w-5xl">
            {/* Centred headline block */}
            <div className="text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                </span>
                {t.hero.badge}
              </div>
              <h1 className="text-5xl md:text-7xl font-serif font-medium leading-[1.1] tracking-tight text-foreground mb-6">
                {t.hero.h1a} <span className="text-primary italic">{t.hero.h1b}</span> {t.hero.h1c}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
                {t.hero.sub}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full text-base font-medium hover-elevate">
                  <a href={`${APP_URL}/login`}>{t.hero.ctaPrimary}</a>
                </Button>
                <Button asChild variant="outline" className="h-14 px-8 rounded-full text-base font-medium border-border hover:bg-muted hover-elevate">
                  <a href={`${APP_URL}/login`}>{t.hero.ctaSecondary}</a>
                </Button>
              </div>
              <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground justify-center">
                <div className="flex -space-x-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="w-8 h-8 rounded-full border-2 border-background bg-card flex items-center justify-center text-xs font-medium"
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <p>{t.hero.social}</p>
              </div>
            </div>

            {/* Mobile: Phone frame */}
            <div className="md:hidden mt-12 flex justify-center animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
              <div className="relative w-[260px]">
                {/* Volume buttons */}
                <div className="absolute -left-[3px] top-[88px] w-[3px] h-7 bg-foreground/20 rounded-l-full"></div>
                <div className="absolute -left-[3px] top-[124px] w-[3px] h-7 bg-foreground/20 rounded-l-full"></div>
                {/* Power button */}
                <div className="absolute -right-[3px] top-[104px] w-[3px] h-10 bg-foreground/20 rounded-r-full"></div>
                {/* Phone shell */}
                <div className="rounded-[44px] overflow-hidden border-[10px] border-foreground/[0.12] bg-foreground/5 shadow-[0_40px_80px_-8px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.06)]" style={{ aspectRatio: "9/19.5" }}>
                  <img
                    src={`${getBaseUrl()}/images/dashboard-mobile.png`}
                    alt="miFinca dashboard en móvil"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>
            </div>

            {/* Desktop: Browser frame */}
            <div className="hidden md:block mt-16 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
              {/* Browser chrome strip */}
              <div className="bg-[#ede8e1] border border-border/60 rounded-t-[20px] px-4 py-3 flex items-center gap-3 shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
                <div className="flex gap-1.5 shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#FF5F57]/80"></div>
                  <div className="w-3 h-3 rounded-full bg-[#FEBC2E]/80"></div>
                  <div className="w-3 h-3 rounded-full bg-[#28C840]/80"></div>
                </div>
                <div className="flex-1 mx-2 bg-background/70 rounded-full h-6 flex items-center px-3 border border-border/40">
                  <span className="text-xs text-muted-foreground/70 font-medium">app.mifinca.com</span>
                </div>
              </div>
              {/* Screenshot */}
              <div className="overflow-hidden rounded-b-[20px] border border-t-0 border-border/60 shadow-[0_40px_100px_-12px_rgba(0,0,0,0.22)]">
                <img
                  src={`${getBaseUrl()}/images/dashboard-ui.png`}
                  alt="miFinca dashboard"
                  className="w-full block"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="caracteristicas" className="py-24 bg-card border-y border-border">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6 whitespace-pre-line">{t.features.heading}</h2>
              <p className="text-lg text-muted-foreground whitespace-pre-line">{t.features.sub}</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {t.features.items.map((item, idx) => {
                const icons = [Sprout, Package, BarChart3, Map, Users, Map];
                const colorClasses = [
                  "bg-accent/10 text-accent",
                  "bg-secondary/10 text-secondary",
                  "bg-primary/10 text-primary",
                  "bg-accent/10 text-accent",
                  "bg-secondary/10 text-secondary",
                  "bg-primary/10 text-primary",
                ];
                const Icon = icons[idx];
                return (
                  <div
                    key={idx}
                    className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group"
                  >
                    <div
                      className={`h-12 w-12 rounded-xl ${colorClasses[idx]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-serif font-medium mb-3">{item.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* AI Advisor Section */}
        <section id="asesor" className="py-24 bg-primary text-primary-foreground overflow-hidden relative">
          <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-1/2 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>

          <div className="container mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/90 font-medium text-sm mb-6 border border-white/20">
                  <MessageSquare className="h-4 w-4" />
                  {t.advisor.badge}
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6 text-white">{t.advisor.heading}</h2>
                <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">{t.advisor.sub}</p>
                <ul className="space-y-4 mb-8">
                  {t.advisor.bullets.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                      <span className="text-primary-foreground/90">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 px-8 rounded-full hover-elevate">
                  <a href={`${APP_URL}/login`}>{t.advisor.cta}</a>
                </Button>
              </div>

              <div className="relative">
                <div className="bg-background rounded-2xl p-6 shadow-2xl border border-white/10 transform lg:rotate-2">
                  <div className="flex items-center gap-4 border-b pb-4 mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sprout className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{t.advisor.chatName}</p>
                      <p className="text-xs text-secondary font-medium">{t.advisor.chatOnline}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0"></div>
                      <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-sm text-foreground">
                        {t.advisor.chatQ}
                      </div>
                    </div>
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sprout className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border p-3 rounded-2xl rounded-tr-none text-sm text-foreground">
                        {t.advisor.chatA}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="planes" className="py-24">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6">{t.pricing.heading}</h2>
              <p className="text-lg text-muted-foreground mb-8">{t.pricing.sub}</p>

              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!annualBilling ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.pricing.monthly}
                </span>
                <Switch
                  checked={annualBilling}
                  onCheckedChange={setAnnualBilling}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`text-sm font-medium ${annualBilling ? "text-foreground" : "text-muted-foreground"}`}>
                  {t.pricing.annual}{" "}
                  <span className="ml-1 text-xs text-secondary font-bold px-2 py-0.5 rounded-full bg-secondary/10">
                    {t.pricing.save}
                  </span>
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Tier 1 */}
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col">
                <h3 className="text-2xl font-serif font-medium mb-2">{t.pricing.tiers[0].name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{t.pricing.tiers[0].desc}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold font-serif">$0</span>
                  <span className="text-muted-foreground ml-1 text-sm">COP</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {t.pricing.tiers[0].features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full rounded-full h-12">
                  <a href={`${APP_URL}/login`}>{t.pricing.tiers[0].cta}</a>
                </Button>
              </div>

              {/* Tier 2 */}
              <div className="bg-primary text-primary-foreground rounded-3xl p-8 shadow-xl relative transform md:-translate-y-4 flex flex-col border-4 border-primary/20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-accent-foreground text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  {t.pricing.popular}
                </div>
                <h3 className="text-2xl font-serif font-medium mb-2 text-white">{t.pricing.tiers[1].name}</h3>
                <p className="text-primary-foreground/80 text-sm mb-6">{t.pricing.tiers[1].desc}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold font-serif">
                    ${annualBilling ? "4.000.000" : "400.000"}
                  </span>
                  <span className="text-primary-foreground/60 ml-1">
                    COP{annualBilling ? t.pricing.perYear : t.pricing.perMonth}
                  </span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {t.pricing.tiers[1].features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                      <span className="text-primary-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full rounded-full h-12">
                  <a href={`${APP_URL}/login`}>{t.pricing.tiers[1].cta}</a>
                </Button>
              </div>

              {/* Tier 3 */}
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col">
                <h3 className="text-2xl font-serif font-medium mb-2">{t.pricing.tiers[2].name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{t.pricing.tiers[2].desc}</p>
                <div className="mb-6">
                  <span className="text-3xl font-bold font-serif">{t.pricing.custom}</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {t.pricing.tiers[2].features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full rounded-full h-12">
                  <a href={`${APP_URL}/login`}>{t.pricing.tiers[2].cta}</a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Lifestyle Section */}
        <section className="py-20 bg-muted/50 border-t border-border">
          <div className="container mx-auto px-6">
            <div className="rounded-[2rem] overflow-hidden relative shadow-lg h-[500px]">
              <img
                src={`${getBaseUrl()}/images/lifestyle-farm.png`}
                alt={t.footer.imgAlt}
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-6">
                <div className="max-w-3xl">
                  <h2 className="text-3xl md:text-5xl font-serif font-medium text-white mb-6">
                    {t.lifestyle.heading} <br /> {t.lifestyle.headingLine2}
                  </h2>
                  <Button asChild className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full text-base font-medium hover-elevate border-none">
                    <a href={`${APP_URL}/login`}>{t.lifestyle.cta}</a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t border-border pt-16 pb-8">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <img src={`${getBaseUrl()}/images/logo-icon.png`} alt="miFinca" className="h-9 w-9 object-contain rounded-lg" />
                <span className="font-serif text-2xl tracking-tight text-primary"><span className="font-medium">mi</span><span className="font-bold">Finca</span></span>
              </div>
              <p className="text-muted-foreground mb-6 max-w-sm">{t.footer.tagline}</p>
            </div>

            <div>
              <h4 className="font-medium mb-4">{t.footer.product}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {t.footer.productLinks.map((link, i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-primary transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-4">{t.footer.company}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {t.footer.companyLinks.map((link, i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-primary transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-4">{t.footer.legal}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {t.footer.legalLinks.map((link, i) => (
                  <li key={i}>
                    <a href="#" className="hover:text-primary transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Finca Colombia. {t.footer.copyright}
            </p>
            <div className="flex gap-4 items-center">
              <button
                onClick={() => setLang("es")}
                className={`text-sm font-medium transition-colors ${
                  lang === "es" ? "text-primary font-semibold" : "text-foreground/60 hover:text-primary"
                }`}
              >
                Español
              </button>
              <span className="text-border">|</span>
              <button
                onClick={() => setLang("en")}
                className={`text-sm font-medium transition-colors ${
                  lang === "en" ? "text-primary font-semibold" : "text-foreground/60 hover:text-primary"
                }`}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
