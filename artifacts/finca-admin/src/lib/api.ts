const BASE = "/api/admin";

export function getSecret(): string {
  return sessionStorage.getItem("admin_secret") ?? "";
}

export function setSecret(s: string) {
  sessionStorage.setItem("admin_secret", s);
}

export function clearSecret() {
  sessionStorage.removeItem("admin_secret");
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": getSecret(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error((err as { message?: string }).message ?? "Request failed"), {
      status: res.status,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  verify: (secret: string) =>
    fetch(`${BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    }).then((r) => r.ok),

  stats: () => req<AdminStats>("GET", "/stats"),
  users: (params?: { search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    return req<UsersResponse>("GET", `/users?${qs}`);
  },
  user: (id: string) => req<UserDetail>("GET", `/users/${id}`),
  updateUser: (id: string, data: Partial<{ fullName: string; email: string; plan: string }>) =>
    req<Profile>("PATCH", `/users/${id}`, data),
  deleteUser: (id: string) => req<{ ok: boolean }>("DELETE", `/users/${id}`),

  farms: (params?: { search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    return req<FarmsResponse>("GET", `/farms?${qs}`);
  },
  farm: (id: string) => req<FarmDetail>("GET", `/farms/${id}`),
  updateFarm: (id: string, data: Partial<{ name: string; location: string }>) =>
    req<Farm>("PATCH", `/farms/${id}`, data),
  deleteFarm: (id: string) => req<{ ok: boolean }>("DELETE", `/farms/${id}`),
  removeMember: (farmId: string, userId: string) =>
    req<{ ok: boolean }>("DELETE", `/farms/${farmId}/members/${userId}`),

  activity: (params?: { page?: number; action?: string; user?: string; farm?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.action) qs.set("action", params.action);
    if (params?.user) qs.set("user", params.user);
    if (params?.farm) qs.set("farm", params.farm);
    return req<ActivityResponse>("GET", `/activity?${qs}`);
  },
};

export type Profile = {
  id: string;
  fullName: string | null;
  email: string | null;
  plan: string;
  role: string;
  clerkId: string | null;
  createdAt: string;
  farmCount?: number;
};

export type AdminStats = {
  users: number;
  farms: number;
  animals: number;
  planBreakdown: { plan: string; count: number }[];
  signupsByDay: { day: string; count: number }[];
};

export type UsersResponse = {
  users: Profile[];
  total: number;
  page: number;
  pages: number;
};

export type Farm = {
  id: string;
  name: string;
  location: string | null;
  totalHectares: string | null;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerId: string | null;
  animalCount: number;
};

export type FarmsResponse = {
  farms: Farm[];
  total: number;
  page: number;
  pages: number;
};

export type Animal = {
  id: string;
  customTag: string | null;
  name: string | null;
  species: string;
  breed: string | null;
  sex: string | null;
  status: string;
  lifecycleStage: string | null;
  currentWeightKg: string | null;
  dateOfBirth: string | null;
};

export type Member = {
  userId: string;
  role: string;
  fullName: string | null;
  email: string | null;
};

export type FinanceTransaction = {
  id: string;
  type: string;
  category: string;
  amount: string;
  description: string;
  date: string;
};

export type ActivityEntry = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  user_name: string | null;
  farm_name?: string | null;
  farm_id?: string | null;
};

export type FarmDetail = {
  farm: Farm;
  members: Member[];
  animals: Animal[];
  finances: {
    recent: FinanceTransaction[];
    summary: { type: string; total: number }[];
  };
  activity: ActivityEntry[];
};

export type UserDetail = Profile & {
  farms: (Farm & { memberRole: string; animalCount: number })[];
};

export type ActivityResponse = {
  activity: ActivityEntry[];
  total: number;
  page: number;
  pages: number;
};
