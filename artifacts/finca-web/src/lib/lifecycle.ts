export type LifecycleStage = "growing" | "can_breed" | "in_heat" | "pregnant" | "nursing";

export interface LifecycleConfig {
  minimumBreedingAgeDays: number;
  minimumBreedingWeightKg: number;
  heatDurationDays: number;
  pregnancyDurationDays: number;
  pregnancyHealthCheckDays: number;
  nursingDurationDays: number;
}

export const LIFECYCLE_CONFIG: Record<string, { female: LifecycleConfig }> = {
  cattle: {
    female: {
      minimumBreedingAgeDays: 730,
      minimumBreedingWeightKg: 400,
      heatDurationDays: 3,
      pregnancyDurationDays: 283,
      pregnancyHealthCheckDays: 30,
      nursingDurationDays: 270,
    },
  },
  goat: {
    female: {
      minimumBreedingAgeDays: 240,
      minimumBreedingWeightKg: 30,
      heatDurationDays: 2,
      pregnancyDurationDays: 150,
      pregnancyHealthCheckDays: 30,
      nursingDurationDays: 90,
    },
  },
  sheep: {
    female: {
      minimumBreedingAgeDays: 240,
      minimumBreedingWeightKg: 35,
      heatDurationDays: 2,
      pregnancyDurationDays: 147,
      pregnancyHealthCheckDays: 30,
      nursingDurationDays: 90,
    },
  },
  horse: {
    female: {
      minimumBreedingAgeDays: 1095,
      minimumBreedingWeightKg: 350,
      heatDurationDays: 5,
      pregnancyDurationDays: 340,
      pregnancyHealthCheckDays: 30,
      nursingDurationDays: 180,
    },
  },
  pig: {
    female: {
      minimumBreedingAgeDays: 210,
      minimumBreedingWeightKg: 100,
      heatDurationDays: 3,
      pregnancyDurationDays: 114,
      pregnancyHealthCheckDays: 30,
      nursingDurationDays: 28,
    },
  },
};

export function getConfigForSpecies(species: string): LifecycleConfig {
  return LIFECYCLE_CONFIG[species]?.female ?? LIFECYCLE_CONFIG.cattle.female;
}

export interface SpeciesTerms {
  offspringEn: string;
  offspringEs: string;
  birthEventEn: string;
  birthEventEs: string;
  deliverySoonEn: string;
  deliverySoonEs: string;
  weanButtonEn: string;
  weanButtonEs: string;
  readyToWeanEn: string;
  readyToWeanEs: string;
}

export const SPECIES_TERMS: Record<string, SpeciesTerms> = {
  cattle: {
    offspringEn:    "calf",
    offspringEs:    "ternero/a",
    birthEventEn:   "Calving",
    birthEventEs:   "Parto",
    deliverySoonEn: "Calving soon",
    deliverySoonEs: "Parto próximo",
    weanButtonEn:   "Wean Calf",
    weanButtonEs:   "Destetar",
    readyToWeanEn:  "Ready to wean calf",
    readyToWeanEs:  "Lista para destete",
  },
  pig: {
    offspringEn:    "piglet",
    offspringEs:    "lechón",
    birthEventEn:   "Farrowing",
    birthEventEs:   "Parto",
    deliverySoonEn: "Farrowing soon",
    deliverySoonEs: "Parto próximo",
    weanButtonEn:   "Wean Piglet",
    weanButtonEs:   "Destetar lechón",
    readyToWeanEn:  "Ready to wean piglet",
    readyToWeanEs:  "Lista para destete",
  },
  horse: {
    offspringEn:    "foal",
    offspringEs:    "potro/a",
    birthEventEn:   "Foaling",
    birthEventEs:   "Parto",
    deliverySoonEn: "Foaling soon",
    deliverySoonEs: "Parto próximo",
    weanButtonEn:   "Wean Foal",
    weanButtonEs:   "Destetar potro/a",
    readyToWeanEn:  "Ready to wean foal",
    readyToWeanEs:  "Lista para destete",
  },
  goat: {
    offspringEn:    "kid",
    offspringEs:    "cabrito/a",
    birthEventEn:   "Kidding",
    birthEventEs:   "Parto",
    deliverySoonEn: "Kidding soon",
    deliverySoonEs: "Parto próximo",
    weanButtonEn:   "Wean Kid",
    weanButtonEs:   "Destetar cabrito/a",
    readyToWeanEn:  "Ready to wean kid",
    readyToWeanEs:  "Lista para destete",
  },
  sheep: {
    offspringEn:    "lamb",
    offspringEs:    "cordero/a",
    birthEventEn:   "Lambing",
    birthEventEs:   "Parto",
    deliverySoonEn: "Lambing soon",
    deliverySoonEs: "Parto próximo",
    weanButtonEn:   "Wean Lamb",
    weanButtonEs:   "Destetar cordero/a",
    readyToWeanEn:  "Ready to wean lamb",
    readyToWeanEs:  "Lista para destete",
  },
};

export function getSpeciesTerms(species: string): SpeciesTerms {
  return SPECIES_TERMS[species] ?? SPECIES_TERMS.cattle;
}

export interface LifecycleAnimal {
  sex?: string | null;
  species: string;
  dateOfBirth?: string | null;
  status?: string | null;
  currentWeightKg?: string | number | null;
  lifecycleStage?: string | null;
  lifecycleStageStartedAt?: string | Date | null;
  lifecycleStageEndsAt?: string | Date | null;
  lifecycleAutoManaged?: boolean;
  minimumBreedingAgeDays?: number | null;
  minimumBreedingWeightKg?: string | number | null;
  heatStartedAt?: string | Date | null;
  heatEndsAt?: string | Date | null;
  pregnancyStartedAt?: string | Date | null;
  expectedDeliveryAt?: string | Date | null;
  pregnancyCheckDueAt?: string | Date | null;
  pregnancyCheckCompletedAt?: string | Date | null;
  nursingStartedAt?: string | Date | null;
  nursingEndsAt?: string | Date | null;
  weaningDueAt?: string | Date | null;
}

const SUPPORTED_LIFECYCLE_SPECIES = ["cattle", "goat", "sheep", "horse", "pig"];

export function hasLifecycle(animal: LifecycleAnimal): boolean {
  return animal.sex === "female" &&
    SUPPORTED_LIFECYCLE_SPECIES.includes(animal.species) &&
    animal.status === "active" &&
    !!animal.lifecycleStage;
}

function toMs(v: string | Date | null | undefined): number | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.getTime();
}

function daysBetween(a: number, b: number): number {
  return Math.floor((b - a) / 86400000);
}

export function getAnimalAgeDays(animal: LifecycleAnimal, now: Date = new Date()): number | null {
  if (!animal.dateOfBirth) return null;
  const birth = new Date(animal.dateOfBirth + "T12:00:00");
  if (isNaN(birth.getTime())) return null;
  return daysBetween(birth.getTime(), now.getTime());
}

export function getWeightKg(animal: LifecycleAnimal): number | null {
  if (animal.currentWeightKg == null) return null;
  const w = typeof animal.currentWeightKg === "string" ? parseFloat(animal.currentWeightKg) : animal.currentWeightKg;
  return isNaN(w) ? null : w;
}

export function isEligibleByAge(animal: LifecycleAnimal, now: Date = new Date()): boolean {
  const ageDays = getAnimalAgeDays(animal, now);
  if (ageDays == null) return false;
  const cfg = getConfigForSpecies(animal.species);
  const minAge = animal.minimumBreedingAgeDays ?? cfg.minimumBreedingAgeDays;
  return ageDays >= minAge;
}

export function isEligibleByWeight(animal: LifecycleAnimal): boolean {
  const w = getWeightKg(animal);
  if (w == null) return false;
  const cfg = getConfigForSpecies(animal.species);
  const minW = animal.minimumBreedingWeightKg
    ? (typeof animal.minimumBreedingWeightKg === "string" ? parseFloat(animal.minimumBreedingWeightKg) : animal.minimumBreedingWeightKg)
    : cfg.minimumBreedingWeightKg;
  return w >= minW;
}

export function isEligibleToBreed(animal: LifecycleAnimal, now: Date = new Date()): boolean {
  return isEligibleByAge(animal, now) || isEligibleByWeight(animal);
}

export function deriveLifecycleStage(animal: LifecycleAnimal, now: Date = new Date()): LifecycleStage | null {
  if (!hasLifecycle(animal)) return null;

  const nowMs = now.getTime();

  const nursingStart = toMs(animal.nursingStartedAt);
  const nursingEnd = toMs(animal.nursingEndsAt);
  if (nursingStart && (!nursingEnd || nowMs < nursingEnd)) {
    const pregStart = toMs(animal.pregnancyStartedAt);
    if (!pregStart || (nursingStart > pregStart)) {
      return "nursing";
    }
  }

  const pregStart = toMs(animal.pregnancyStartedAt);
  const expectedDel = toMs(animal.expectedDeliveryAt);
  if (pregStart && (!expectedDel || nowMs < expectedDel)) {
    if (!nursingStart || pregStart > nursingStart) {
      return "pregnant";
    }
  }

  const heatStart = toMs(animal.heatStartedAt);
  const heatEnd = toMs(animal.heatEndsAt);
  if (heatStart && heatEnd && nowMs < heatEnd) {
    return "in_heat";
  }

  if (isEligibleToBreed(animal, now)) {
    return "can_breed";
  }

  return "growing";
}

export interface LifecycleAlert {
  type: string;
  label: string;
  labelEn: string;
  dueAt?: Date | null;
  severity: "info" | "warning" | "urgent";
}

export function getLifecycleAlerts(animal: LifecycleAnimal, now: Date = new Date()): LifecycleAlert[] {
  if (!hasLifecycle(animal)) return [];
  const alerts: LifecycleAlert[] = [];
  const stage = deriveLifecycleStage(animal, now);
  const terms = getSpeciesTerms(animal.species);
  const nowMs = now.getTime();

  if (stage === "in_heat") {
    const heatEnd = toMs(animal.heatEndsAt);
    if (heatEnd && (heatEnd - nowMs) < 86400000) {
      alerts.push({
        type: "in_heat_ending_soon",
        label: "Celo termina pronto",
        labelEn: "Heat ending soon",
        dueAt: animal.heatEndsAt ? new Date(animal.heatEndsAt) : null,
        severity: "warning",
      });
    }
  }

  if (stage === "pregnant") {
    const checkDue = toMs(animal.pregnancyCheckDueAt);
    if (checkDue && !animal.pregnancyCheckCompletedAt && nowMs >= checkDue) {
      alerts.push({
        type: "pregnancy_check_due",
        label: "Chequeo de preñez pendiente",
        labelEn: "Pregnancy check due",
        dueAt: animal.pregnancyCheckDueAt ? new Date(animal.pregnancyCheckDueAt) : null,
        severity: "warning",
      });
    }

    const delivery = toMs(animal.expectedDeliveryAt);
    if (delivery && (delivery - nowMs) <= 30 * 86400000) {
      alerts.push({
        type: "delivery_soon",
        label: terms.deliverySoonEs,
        labelEn: terms.deliverySoonEn,
        dueAt: animal.expectedDeliveryAt ? new Date(animal.expectedDeliveryAt) : null,
        severity: "urgent",
      });
    }
  }

  if (stage === "nursing") {
    const weanDue = toMs(animal.weaningDueAt);
    if (weanDue && (weanDue - nowMs) <= 7 * 86400000) {
      alerts.push({
        type: "ready_to_wean",
        label: terms.readyToWeanEs,
        labelEn: terms.readyToWeanEn,
        dueAt: animal.weaningDueAt ? new Date(animal.weaningDueAt) : null,
        severity: "warning",
      });
    }
  }

  if (stage === "growing") {
    if (isEligibleToBreed(animal, now)) {
      alerts.push({
        type: "eligible_to_breed",
        label: "Elegible para reproducción",
        labelEn: "Eligible to breed",
        severity: "info",
      });
    }
  }

  return alerts;
}

export interface LifecycleStatus {
  stage: LifecycleStage;
  stageLabel: string;
  stageLabelEn: string;
  progress: string;
  progressEn: string;
  nextEvent: string;
  nextEventEn: string;
}

const STAGE_LABELS: Record<LifecycleStage, [string, string]> = {
  growing: ["Crecimiento", "Growing"],
  can_breed: ["Lista para reproducción", "Can Breed"],
  in_heat: ["En celo", "In Heat"],
  pregnant: ["Preñada", "Pregnant"],
  nursing: ["Lactancia", "Nursing"],
};

export function getLifecycleStatus(animal: LifecycleAnimal, now: Date = new Date()): LifecycleStatus | null {
  const stage = deriveLifecycleStage(animal, now);
  if (!stage) return null;

  const [stageLabel, stageLabelEn] = STAGE_LABELS[stage];
  const cfg = getConfigForSpecies(animal.species);
  const terms = getSpeciesTerms(animal.species);
  const nowMs = now.getTime();

  let progress = "";
  let progressEn = "";
  let nextEvent = "";
  let nextEventEn = "";

  switch (stage) {
    case "growing": {
      const w = getWeightKg(animal);
      const minW = animal.minimumBreedingWeightKg
        ? (typeof animal.minimumBreedingWeightKg === "string" ? parseFloat(animal.minimumBreedingWeightKg as string) : animal.minimumBreedingWeightKg)
        : cfg.minimumBreedingWeightKg;
      if (w != null) {
        progress = `${Math.round(w)}kg / ${Math.round(minW)}kg`;
        progressEn = progress;
      } else {
        const age = getAnimalAgeDays(animal, now);
        if (age != null) {
          progress = `${age} días`;
          progressEn = `${age} days`;
        }
      }
      nextEvent = `Puede reproducir a ${Math.round(minW)}kg o ${Math.round(cfg.minimumBreedingAgeDays / 365 * 10) / 10} años`;
      nextEventEn = `Can breed at ${Math.round(minW)}kg or ${Math.round(cfg.minimumBreedingAgeDays / 365 * 10) / 10} years`;
      break;
    }
    case "can_breed": {
      progress = "Lista";
      progressEn = "Ready";
      nextEvent = "Esperando celo / reproducción";
      nextEventEn = "Awaiting heat / breeding";
      break;
    }
    case "in_heat": {
      const heatEnd = toMs(animal.heatEndsAt);
      if (heatEnd) {
        const daysLeft = Math.max(0, daysBetween(nowMs, heatEnd));
        progress = `${daysLeft} día${daysLeft !== 1 ? "s" : ""} restante${daysLeft !== 1 ? "s" : ""}`;
        progressEn = `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`;
        const endDate = new Date(heatEnd);
        nextEvent = `Celo termina el ${endDate.toLocaleDateString("es-CO")}`;
        nextEventEn = `Heat ends on ${endDate.toLocaleDateString("en-US")}`;
      }
      break;
    }
    case "pregnant": {
      const pregStart = toMs(animal.pregnancyStartedAt);
      const delivery = toMs(animal.expectedDeliveryAt);
      if (pregStart) {
        const elapsed = daysBetween(pregStart, nowMs);
        progress = `${elapsed} días de preñez`;
        progressEn = `${elapsed} days pregnant`;
      }
      if (delivery) {
        const daysLeft = Math.max(0, daysBetween(nowMs, delivery));
        nextEvent = `${terms.birthEventEs} en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`;
        nextEventEn = `${terms.birthEventEn} in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
      }
      break;
    }
    case "nursing": {
      const nursStart = toMs(animal.nursingStartedAt);
      const nursEnd = toMs(animal.nursingEndsAt);
      if (nursStart) {
        const elapsed = daysBetween(nursStart, nowMs);
        progress = `${elapsed} días de lactancia`;
        progressEn = `${elapsed} days nursing`;
      }
      if (nursEnd) {
        const daysLeft = Math.max(0, daysBetween(nowMs, nursEnd));
        nextEvent = `Destete en ${daysLeft} día${daysLeft !== 1 ? "s" : ""}`;
        nextEventEn = `${terms.weanButtonEn.replace(/^Wean\s/, "Weaning ")} in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
      }
      break;
    }
  }

  return { stage, stageLabel, stageLabelEn, progress, progressEn, nextEvent, nextEventEn };
}

export function getCardStatusLine(animal: LifecycleAnimal, isEn: boolean, now: Date = new Date()): string | null {
  const status = getLifecycleStatus(animal, now);
  if (!status) return null;

  const alerts = getLifecycleAlerts(animal, now);
  const alertLabel = alerts.length > 0 ? (isEn ? alerts[0].labelEn : alerts[0].label) : null;

  const label = isEn ? status.stageLabelEn : status.stageLabel;
  const detail = alertLabel ?? (isEn ? status.progressEn : status.progress);

  return detail ? `${label} · ${detail}` : label;
}

export const LIFECYCLE_STAGES: LifecycleStage[] = ["growing", "can_breed", "in_heat", "pregnant", "nursing"];

export function getStageColor(stage: LifecycleStage): string {
  switch (stage) {
    case "growing": return "text-blue-600 bg-blue-50 border-blue-200";
    case "can_breed": return "text-emerald-600 bg-emerald-50 border-emerald-200";
    case "in_heat": return "text-orange-600 bg-orange-50 border-orange-200";
    case "pregnant": return "text-rose-600 bg-rose-50 border-rose-200";
    case "nursing": return "text-purple-600 bg-purple-50 border-purple-200";
  }
}

export function getStageIcon(stage: LifecycleStage): string {
  switch (stage) {
    case "growing": return "🌱";
    case "can_breed": return "💚";
    case "in_heat": return "🔥";
    case "pregnant": return "🤰";
    case "nursing": return "🍼";
  }
}
