import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Map, 
  BarChart3, 
  Users, 
  Package, 
  Sprout, 
  ChevronRight, 
  CheckCircle2, 
  Menu, 
  X,
  Globe,
  MessageSquare
} from "lucide-react";

export default function Home() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [annualBilling, setAnnualBilling] = useState(true);

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

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-secondary selection:text-secondary-foreground overflow-x-hidden">
      {/* Navigation */}
      <header 
        className={`fixed top-0 w-full z-50 transition-all duration-300 border-b ${
          isScrolled ? "bg-background/90 backdrop-blur-md border-border/50 py-3 shadow-sm" : "bg-transparent border-transparent py-5"
        }`}
      >
        <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sprout className="h-8 w-8 text-primary" />
            <span className="font-serif text-2xl font-bold tracking-tight text-primary">Finca</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <button onClick={() => scrollTo("caracteristicas")} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Características</button>
            <button onClick={() => scrollTo("asesor")} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Asesor IA</button>
            <button onClick={() => scrollTo("planes")} className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Planes</button>
            <div className="w-px h-5 bg-border mx-2"></div>
            <button className="flex items-center gap-1 text-sm font-medium text-foreground/80 hover:text-primary transition-colors">
              <Globe className="h-4 w-4" /> ES
            </button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 hover-elevate rounded-full px-6">
              Empezar Gratis
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
          <button onClick={() => scrollTo("caracteristicas")} className="text-xl font-serif text-left border-b border-border pb-4">Características</button>
          <button onClick={() => scrollTo("asesor")} className="text-xl font-serif text-left border-b border-border pb-4">Asesor IA</button>
          <button onClick={() => scrollTo("planes")} className="text-xl font-serif text-left border-b border-border pb-4">Planes</button>
          <Button className="bg-primary text-primary-foreground w-full py-6 text-lg mt-4 rounded-xl">
            Empezar Gratis
          </Button>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-secondary/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="container mx-auto max-w-6xl">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
              <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                  Hecho para el campo colombiano
                </div>
                <h1 className="text-5xl md:text-7xl font-serif font-medium leading-[1.1] tracking-tight text-foreground mb-6">
                  La claridad que <span className="text-primary italic">su finca</span> necesita.
                </h1>
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-lg">
                  El software de gestión para ganaderos que valoran su tiempo. Sin complicaciones. Sin enredos. Solo control total de sus animales, inventario y finanzas.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full text-base font-medium hover-elevate">
                    Crear cuenta gratis
                  </Button>
                  <Button variant="outline" className="h-14 px-8 rounded-full text-base font-medium border-border hover:bg-muted hover-elevate">
                    Ver demostración
                  </Button>
                </div>
                <div className="mt-10 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-card flex items-center justify-center text-xs font-medium">
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <p>Más de 500 fincas ya lo usan</p>
                </div>
              </div>

              <div className="relative animate-in fade-in slide-in-from-right-8 duration-1000 delay-200">
                <div className="relative rounded-[2rem] overflow-hidden shadow-2xl aspect-[4/3] lg:aspect-[4/5] xl:aspect-square transform lg:-rotate-2 transition-transform hover:rotate-0 duration-500 border-8 border-background">
                  <img 
                    src={`${getBaseUrl()}/images/hero-farm.png`} 
                    alt="Paisaje de finca colombiana" 
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent"></div>
                  
                  {/* Floating UI Elements */}
                  <div className="absolute bottom-8 left-8 right-8 glass-panel rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/80 font-medium">Ganancia mensual</p>
                      <p className="text-2xl font-serif text-white font-bold">+24%</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="caracteristicas" className="py-24 bg-card border-y border-border">
          <div className="container mx-auto px-6">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6">Todo bajo control, desde cualquier lugar.</h2>
              <p className="text-lg text-muted-foreground">Reemplazamos las libretas y las hojas de cálculo confusas con herramientas diseñadas para la realidad del campo.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Sprout className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Control de Animales</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Lleve el historial de peso, registros médicos, vacunas y linaje completo. Sepa exactamente el estado de cada animal.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Package className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Inventario Inteligente</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Controle insumos, reciba alertas de stock bajo y registre el uso diario. Nunca se quede sin lo necesario.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Finanzas Claras</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Registre ingresos y gastos fácilmente. Visualice la rentabilidad de su finca con gráficos claros y directos.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Map className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Mapa Interactivo</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Mapee sus potreros y zonas. Controle la rotación, el estado de los pastos y el uso de la tierra visualmente.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Gestión de Personal</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Administre sus empleados, asigne tareas, guarde documentos importantes y mantenga la comunicación clara.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="bg-background rounded-2xl p-8 shadow-sm border border-border/50 hover-elevate group">
                <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Map className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-serif font-medium mb-3">Soporte Multi-finca</h3>
                <p className="text-muted-foreground leading-relaxed">
                  ¿Tiene varias propiedades? Adminístrelas todas desde una sola cuenta, manteniendo la información separada y organizada.
                </p>
              </div>
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
                  Inteligencia Artificial
                </div>
                <h2 className="text-4xl md:text-5xl font-serif font-medium mb-6">El primer asesor inteligente para el campo.</h2>
                <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
                  Tome decisiones informadas. Pregunte a su Asesor IA sobre enfermedades, precios de mercado o técnicas de pastoreo, en español o inglés, y obtenga respuestas precisas con datos de la web en tiempo real.
                </p>
                <ul className="space-y-4 mb-8">
                  {[
                    "Consultas de mercado y clima en tiempo real",
                    "Consejos sobre salud animal y nutrición",
                    "Asistencia bilingüe inmediata",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                      <span className="text-primary-foreground/90">{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 h-12 px-8 rounded-full hover-elevate">
                  Conocer al Asesor
                </Button>
              </div>
              
              <div className="relative">
                <div className="bg-background rounded-2xl p-6 shadow-2xl border border-white/10 transform lg:rotate-2">
                  <div className="flex items-center gap-4 border-b pb-4 mb-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sprout className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Asesor Finca</p>
                      <p className="text-xs text-secondary font-medium">En línea</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0"></div>
                      <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-sm text-foreground">
                        ¿Cuál es el precio actual del ganado en pie en subastas de Antioquia?
                      </div>
                    </div>
                    <div className="flex gap-3 flex-row-reverse">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Sprout className="h-4 w-4 text-primary" />
                      </div>
                      <div className="bg-card border p-3 rounded-2xl rounded-tr-none text-sm text-foreground">
                        Según los últimos reportes de hoy, el precio promedio del ganado gordo en pie en Antioquia es de $8.200 a $8.500 COP por kilo...
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
              <h2 className="text-3xl md:text-5xl font-serif font-medium mb-6">Precios simples y justos.</h2>
              <p className="text-lg text-muted-foreground mb-8">Invierta en tranquilidad. Cancele en cualquier momento.</p>
              
              <div className="flex items-center justify-center gap-4">
                <span className={`text-sm font-medium ${!annualBilling ? 'text-foreground' : 'text-muted-foreground'}`}>Mensual</span>
                <Switch 
                  checked={annualBilling} 
                  onCheckedChange={setAnnualBilling}
                  className="data-[state=checked]:bg-primary"
                />
                <span className={`text-sm font-medium ${annualBilling ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Anual <span className="ml-1 text-xs text-secondary font-bold px-2 py-0.5 rounded-full bg-secondary/10">Ahorre 20%</span>
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Tier 1 */}
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col">
                <h3 className="text-2xl font-serif font-medium mb-2">Semilla</h3>
                <p className="text-muted-foreground text-sm mb-6">Para empezar a organizarse.</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold font-serif">$0</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {["1 finca", "Hasta 15 animales", "Control básico", "Sin asesor IA"].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full h-12">Empezar gratis</Button>
              </div>

              {/* Tier 2 */}
              <div className="bg-primary text-primary-foreground rounded-3xl p-8 shadow-xl relative transform md:-translate-y-4 flex flex-col border-4 border-primary/20">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent text-accent-foreground text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wide">
                  Más popular
                </div>
                <h3 className="text-2xl font-serif font-medium mb-2">Finca</h3>
                <p className="text-primary-foreground/80 text-sm mb-6">Todo lo que necesita un ganadero.</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold font-serif">${annualBilling ? '24' : '29'}</span>
                  <span className="text-primary-foreground/60">/mes</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {["1 finca", "Animales ilimitados", "Todas las funciones", "Asesor IA integrado", "Soporte estándar"].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" />
                      <span className="text-primary-foreground/90">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90 w-full rounded-full h-12">Probar por 14 días</Button>
              </div>

              {/* Tier 3 */}
              <div className="bg-card rounded-3xl p-8 border border-border shadow-sm flex flex-col">
                <h3 className="text-2xl font-serif font-medium mb-2">Hacienda</h3>
                <p className="text-muted-foreground text-sm mb-6">Para grandes operaciones.</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold font-serif">${annualBilling ? '64' : '79'}</span>
                  <span className="text-muted-foreground">/mes</span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {["Hasta 5 fincas", "Animales ilimitados", "Todas las funciones", "Reportes personalizados", "Soporte prioritario"].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-foreground/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full rounded-full h-12">Contactar ventas</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Image / Lifestyle Section */}
        <section className="py-20 bg-muted/50 border-t border-border">
          <div className="container mx-auto px-6">
            <div className="rounded-[2rem] overflow-hidden relative shadow-lg h-[500px]">
              <img 
                src={`${getBaseUrl()}/images/farmer-tech.png`} 
                alt="Ganadero usando tecnología Finca" 
                className="object-cover w-full h-full"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-center p-6">
                <div className="max-w-3xl">
                  <h2 className="text-3xl md:text-5xl font-serif font-medium text-white mb-6">
                    Menos tiempo administrando. <br /> Más tiempo en lo importante.
                  </h2>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 rounded-full text-base font-medium hover-elevate border-none">
                    Unirse a Finca Hoy
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
                <Sprout className="h-8 w-8 text-primary" />
                <span className="font-serif text-2xl font-bold tracking-tight text-primary">Finca</span>
              </div>
              <p className="text-muted-foreground mb-6 max-w-sm">
                Software de gestión diseñado específicamente para la realidad del campo colombiano. Simple, claro y potente.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Producto</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Características</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Asesor IA</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Precios</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Actualizaciones</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Compañía</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contacto</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Términos de servicio</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Privacidad</a></li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Finca Colombia. Todos los derechos reservados.
            </p>
            <div className="flex gap-4">
               <button className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">Español</button>
               <span className="text-border">|</span>
               <button className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors">English</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
