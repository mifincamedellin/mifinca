import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Map } from "lucide-react";
import { motion } from "framer-motion";

export function Land() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="p-12 max-w-lg text-center bg-card/60 backdrop-blur-md rounded-[2rem] border-dashed border-2 border-border shadow-sm">
          <div className="mx-auto w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center mb-8">
            <Map className="h-12 w-12 text-accent" />
          </div>
          <h1 className="text-4xl font-serif text-primary font-bold mb-4">Módulo de Tierra</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t('land.comingSoon')}
            <br />
            <span className="text-sm mt-4 block">Pronto podrás gestionar tus potreros, rotaciones de pastos y zonas de cultivo directamente desde aquí.</span>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
