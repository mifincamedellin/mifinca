export type PlanKey = "seed" | "farm" | "pro";

export interface PlanLimits {
  farms: number | null;
  animals: number | null;
  employees: number | null;
  contacts: number | null;
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  seed: { farms: 1, animals: 10, employees: 1, contacts: 1 },
  farm: { farms: 1, animals: null, employees: null, contacts: null },
  pro:  { farms: null, animals: null, employees: null, contacts: null },
};

export function getPlanKey(plan: string | null | undefined): PlanKey {
  if (plan === "farm" || plan === "pro") return plan;
  return "seed";
}

export function getPlanLimits(plan: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[getPlanKey(plan)];
}
