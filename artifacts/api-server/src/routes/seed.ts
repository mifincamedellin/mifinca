import { Router } from "express";
import { db, pool } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable,
  inventoryItemsTable, financeTransactionsTable,
  contactsTable, activityLogTable, farmMembersTable, employeesTable,
  milkRecordsTable, farmEventsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const DEMO_USER_ID    = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_EMAIL = "demo@fincacolombia.com";
const DEMO_USER_PASS  = "demo1234";
const DEMO_FARM_ID    = "a33817a9-7829-49ca-be0d-6c77a2a52e16";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0]!;
}
function monthsAgo(n: number, day = 15) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return d.toISOString().split("T")[0]!;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0]!;
}

export async function seedDemoFarmData(farmId: string) {
  const animalRows = await db.insert(animalsTable).values([
    { farmId, customTag: "BOV-001", species: "cattle", breed: "Brahman",            name: "Reina",      sex: "female", dateOfBirth: "2020-03-12", status: "active", notes: "Buena productora de leche" },
    { farmId, customTag: "BOV-002", species: "cattle", breed: "Simmental",          name: "Luna",       sex: "female", dateOfBirth: "2021-07-05", status: "active" },
    { farmId, customTag: "BOV-003", species: "cattle", breed: "Brahman",            name: "Toro Negro", sex: "male",   dateOfBirth: "2019-11-20", status: "active", notes: "Semental principal" },
    { farmId, customTag: "BOV-004", species: "cattle", breed: "Cebú",               name: "Manchas",    sex: "female", dateOfBirth: "2022-01-08", status: "active" },
    { farmId, customTag: "BOV-005", species: "cattle", breed: "Gyr",                name: "Estrella",   sex: "female", dateOfBirth: "2021-04-18", status: "active", notes: "Alta producción láctea" },
    { farmId, customTag: "BOV-006", species: "cattle", breed: "Brahman",            name: "Canela",     sex: "female", dateOfBirth: "2020-08-25", status: "active" },
    { farmId, customTag: "BOV-007", species: "cattle", breed: "Normando",           name: "Vendaval",   sex: "male",   dateOfBirth: "2018-12-10", status: "active", notes: "Toro reproductor reserva" },
    { farmId, customTag: "BOV-008", species: "cattle", breed: "Cebú",               name: "Rosada",     sex: "female", dateOfBirth: "2022-05-03", status: "active" },
    { farmId, customTag: "BOV-009", species: "cattle", breed: "Simmental",          name: "Nube",       sex: "female", dateOfBirth: "2023-01-17", status: "active", notes: "Ternera en crecimiento" },
    { farmId, customTag: "BOV-010", species: "cattle", breed: "Brahman",            name: "Palomo",     sex: "male",   dateOfBirth: "2022-09-29", status: "active" },
    { farmId, customTag: "BOV-011", species: "cattle", breed: "Holstein",           name: "Lechera",    sex: "female", dateOfBirth: "2020-02-11", status: "active", notes: "Mejor productora del hato" },
    { farmId, customTag: "BOV-012", species: "cattle", breed: "Gyr",                name: "Negrita",    sex: "female", dateOfBirth: "2021-11-06", status: "active" },
    { farmId, customTag: "CER-001", species: "pig",    breed: "Landrace",           name: "Gordita",    sex: "female", dateOfBirth: "2023-02-14", status: "active" },
    { farmId, customTag: "CER-002", species: "pig",    breed: "Duroc",              name: "Duroc",      sex: "male",   dateOfBirth: "2023-03-22", status: "active" },
    { farmId, customTag: "CER-003", species: "pig",    breed: "Yorkshire",          name: "Rizada",     sex: "female", dateOfBirth: "2023-07-20", status: "active" },
    { farmId, customTag: "CER-004", species: "pig",    breed: "Pietrain",           name: "Mota",       sex: "male",   dateOfBirth: "2023-08-14", status: "active" },
    { farmId, customTag: "CAB-001", species: "horse",  breed: "Criollo Colombiano", name: "Rayo",       sex: "male",   dateOfBirth: "2018-05-30", status: "active", notes: "Caballo de trabajo" },
    { farmId, customTag: "CAB-002", species: "horse",  breed: "Criollo Colombiano", name: "Trueno",     sex: "male",   dateOfBirth: "2017-03-05", status: "active", notes: "Caballo de paso fino" },
    { farmId, customTag: "CAP-001", species: "goat",   breed: "Nubian",             name: "Bella",      sex: "female", dateOfBirth: "2022-09-10", status: "active" },
    { farmId, customTag: "CAP-002", species: "goat",   breed: "Boer",               name: "Caramelo",   sex: "female", dateOfBirth: "2023-04-12", status: "active" },
    { farmId, customTag: "BOV-013", species: "cattle", breed: "Brahman",            name: "Lucero",     sex: "female", dateOfBirth: "2021-02-14", status: "active" },
    { farmId, customTag: "BOV-014", species: "cattle", breed: "Cebú",               name: "Pintada",    sex: "female", dateOfBirth: "2020-09-03", status: "active" },
    { farmId, customTag: "BOV-015", species: "cattle", breed: "Gyr",                name: "Amanecer",   sex: "female", dateOfBirth: "2022-03-20", status: "active", notes: "Buena productora láctea" },
    { farmId, customTag: "BOV-016", species: "cattle", breed: "Simmental",          name: "Violeta",    sex: "female", dateOfBirth: "2021-11-08", status: "active" },
    { farmId, customTag: "BOV-017", species: "cattle", breed: "Normando",           name: "Blanca",     sex: "female", dateOfBirth: "2020-05-17", status: "active" },
    { farmId, customTag: "BOV-018", species: "cattle", breed: "Holstein",           name: "Margarita",  sex: "female", dateOfBirth: "2019-12-01", status: "active", notes: "Producción 18L/día" },
    { farmId, customTag: "BOV-019", species: "cattle", breed: "Brahman",            name: "Tormenta",   sex: "male",   dateOfBirth: "2019-07-22", status: "active", notes: "Toro semental reserva" },
    { farmId, customTag: "BOV-020", species: "cattle", breed: "Cebú",               name: "Rocío",      sex: "female", dateOfBirth: "2022-08-11", status: "active" },
    { farmId, customTag: "BOV-021", species: "cattle", breed: "Gyr",                name: "Sirena",     sex: "female", dateOfBirth: "2021-04-05", status: "active" },
    { farmId, customTag: "BOV-022", species: "cattle", breed: "Brahman",            name: "Mariposa",   sex: "female", dateOfBirth: "2020-01-30", status: "active" },
    { farmId, customTag: "BOV-023", species: "cattle", breed: "Simmental",          name: "Perla",      sex: "female", dateOfBirth: "2022-06-15", status: "active" },
    { farmId, customTag: "BOV-024", species: "cattle", breed: "Normando",           name: "Paloma",     sex: "female", dateOfBirth: "2021-09-09", status: "active" },
    { farmId, customTag: "BOV-025", species: "cattle", breed: "Cebú",               name: "Flor",       sex: "female", dateOfBirth: "2020-03-25", status: "active" },
    { farmId, customTag: "BOV-026", species: "cattle", breed: "Holstein",           name: "Clarita",    sex: "female", dateOfBirth: "2021-07-14", status: "active" },
    { farmId, customTag: "BOV-027", species: "cattle", breed: "Brahman",            name: "Gaviota",    sex: "female", dateOfBirth: "2022-11-02", status: "active" },
    { farmId, customTag: "BOV-028", species: "cattle", breed: "Gyr",                name: "Lluvia",     sex: "female", dateOfBirth: "2020-10-18", status: "active" },
    { farmId, customTag: "BOV-029", species: "cattle", breed: "Brahman",            name: "Costeño",    sex: "male",   dateOfBirth: "2020-06-07", status: "active", notes: "Novillo en engorde" },
    { farmId, customTag: "BOV-030", species: "cattle", breed: "Cebú",               name: "Primavera",  sex: "female", dateOfBirth: "2023-01-20", status: "active", notes: "Ternera en crecimiento" },
    { farmId, customTag: "BOV-031", species: "cattle", breed: "Simmental",          name: "Dorada",     sex: "female", dateOfBirth: "2021-03-12", status: "active" },
    { farmId, customTag: "BOV-032", species: "cattle", breed: "Normando",           name: "Sierra",     sex: "female", dateOfBirth: "2020-12-05", status: "active" },
    { farmId, customTag: "BOV-033", species: "cattle", breed: "Brahman",            name: "Esperanza",  sex: "female", dateOfBirth: "2019-08-28", status: "active", notes: "Vaca adulta experimentada" },
    { farmId, customTag: "BOV-034", species: "cattle", breed: "Gyr",                name: "Nevada",     sex: "female", dateOfBirth: "2022-04-16", status: "active" },
    { farmId, customTag: "BOV-035", species: "cattle", breed: "Holstein",           name: "Blanquita",  sex: "female", dateOfBirth: "2020-07-31", status: "active" },
    { farmId, customTag: "BOV-036", species: "cattle", breed: "Cebú",               name: "Ceniza",     sex: "female", dateOfBirth: "2021-10-03", status: "active" },
    { farmId, customTag: "BOV-037", species: "cattle", breed: "Brahman",            name: "Valeria",    sex: "female", dateOfBirth: "2022-09-19", status: "active" },
    { farmId, customTag: "BOV-038", species: "cattle", breed: "Simmental",          name: "Cristal",    sex: "female", dateOfBirth: "2021-05-27", status: "active" },
    { farmId, customTag: "BOV-039", species: "cattle", breed: "Normando",           name: "Dulce",      sex: "female", dateOfBirth: "2020-11-14", status: "active" },
    { farmId, customTag: "BOV-040", species: "cattle", breed: "Brahman",            name: "Relámpago",  sex: "male",   dateOfBirth: "2021-08-08", status: "active", notes: "Novillo engorde fase final" },
    { farmId, customTag: "BOV-041", species: "cattle", breed: "Gyr",                name: "Penélope",   sex: "female", dateOfBirth: "2022-02-22", status: "active" },
    { farmId, customTag: "BOV-042", species: "cattle", breed: "Cebú",               name: "Morena",     sex: "female", dateOfBirth: "2020-04-10", status: "active" },
    { farmId, customTag: "BOV-043", species: "cattle", breed: "Holstein",           name: "Patricia",   sex: "female", dateOfBirth: "2021-12-18", status: "active", notes: "Producción 16L/día" },
    { farmId, customTag: "BOV-044", species: "cattle", breed: "Brahman",            name: "Ventana",    sex: "female", dateOfBirth: "2019-09-05", status: "active" },
    { farmId, customTag: "BOV-045", species: "cattle", breed: "Simmental",          name: "Esmeralda",  sex: "female", dateOfBirth: "2022-07-01", status: "active" },
    { farmId, customTag: "BOV-046", species: "cattle", breed: "Normando",           name: "Rocosa",     sex: "female", dateOfBirth: "2020-02-19", status: "active" },
    { farmId, customTag: "BOV-047", species: "cattle", breed: "Gyr",                name: "Salomé",     sex: "female", dateOfBirth: "2021-06-24", status: "active" },
    { farmId, customTag: "BOV-048", species: "cattle", breed: "Brahman",            name: "Huracán",    sex: "male",   dateOfBirth: "2021-01-15", status: "active", notes: "Toro joven" },
    { farmId, customTag: "BOV-049", species: "cattle", breed: "Cebú",               name: "Trigueña",   sex: "female", dateOfBirth: "2022-10-07", status: "active" },
    { farmId, customTag: "BOV-050", species: "cattle", breed: "Holstein",           name: "Elisa",      sex: "female", dateOfBirth: "2020-08-23", status: "active" },
    { farmId, customTag: "BOV-051", species: "cattle", breed: "Brahman",            name: "Pampera",    sex: "female", dateOfBirth: "2021-03-30", status: "active" },
    { farmId, customTag: "BOV-052", species: "cattle", breed: "Simmental",          name: "Otoño",      sex: "female", dateOfBirth: "2023-02-11", status: "active", notes: "Ternera recién destetada" },
    { farmId, customTag: "BOV-053", species: "cattle", breed: "Gyr",                name: "Catalina",   sex: "female", dateOfBirth: "2020-06-16", status: "active" },
    { farmId, customTag: "BOV-054", species: "cattle", breed: "Normando",           name: "Serrana",    sex: "female", dateOfBirth: "2021-09-28", status: "active" },
    { farmId, customTag: "BOV-055", species: "cattle", breed: "Brahman",            name: "Princesa",   sex: "female", dateOfBirth: "2022-01-05", status: "active" },
    { farmId, customTag: "BOV-056", species: "cattle", breed: "Cebú",               name: "Gitana",     sex: "female", dateOfBirth: "2019-11-11", status: "active" },
    { farmId, customTag: "BOV-057", species: "cattle", breed: "Holstein",           name: "Danesa",     sex: "female", dateOfBirth: "2021-07-20", status: "active", notes: "Producción 20L/día — mejor hato" },
    { farmId, customTag: "BOV-058", species: "cattle", breed: "Brahman",            name: "Potranca",   sex: "female", dateOfBirth: "2022-05-08", status: "active" },
    { farmId, customTag: "BOV-059", species: "cattle", breed: "Simmental",          name: "Topacio",    sex: "female", dateOfBirth: "2020-09-14", status: "active" },
    { farmId, customTag: "BOV-060", species: "cattle", breed: "Gyr",                name: "Felicia",    sex: "female", dateOfBirth: "2021-11-25", status: "active" },
    { farmId, customTag: "BOV-061", species: "cattle", breed: "Brahman",            name: "Cimarrona",  sex: "male",   dateOfBirth: "2022-03-03", status: "active", notes: "Toro joven en desarrollo" },
    { farmId, customTag: "BOV-062", species: "cattle", breed: "Cebú",               name: "Rosalba",    sex: "female", dateOfBirth: "2020-07-07", status: "active" },
    { farmId, customTag: "BOV-063", species: "cattle", breed: "Normando",           name: "Verano",     sex: "female", dateOfBirth: "2021-04-22", status: "active" },



































































  ]).returning();

  // ── WEIGHT RECORDS — all animals, 4 records each ─────────────────────────
  const weightRecords = animalRows.flatMap((animal, i) => {
    const isMale = animal.sex === "male";
    let base: number;
    switch (animal.species) {
      case "cattle": base = isMale ? 490 : 330; break;
      case "pig":    base = isMale ? 102 : 88;  break;
      case "horse":  base = isMale ? 500 : 440; break;
      case "goat":   base = isMale ? 64  : 50;  break;
      case "sheep":  base = isMale ? 72  : 60;  break;
      default:       base = 200;
    }
    const v = (i * 7 + 3) % 18;
    const w1 = base - 14 + v;
    const w2 = w1 + 8  + (v % 5);
    const w3 = w2 + 9  + ((v + 2) % 6);
    const w4 = w3 + 7  + ((v + 4) % 5);
    return [
      { animalId: animal.id, weightKg: String(w1), recordedAt: monthsAgo(3) },
      { animalId: animal.id, weightKg: String(w2), recordedAt: monthsAgo(2) },
      { animalId: animal.id, weightKg: String(w3), recordedAt: monthsAgo(1) },
      { animalId: animal.id, weightKg: String(w4), recordedAt: daysAgo(5 + (i % 22)) },
    ];
  });
  await db.insert(weightRecordsTable).values(weightRecords);

  // ── MEDICAL RECORDS — all animals, 2–3 records each ──────────────────────
  const cattleVaccines = [
    { recordType: "vaccination" as const, title: "Vacuna Aftosa",             description: "Dosis semestral fiebre aftosa — reglamentaria ICA",    costCop: "45000", vetName: "Dr. Carlos Medina", monthsBack: 2, nextMonths: 4 },
    { recordType: "deworming"   as const, title: "Desparasitación interna",   description: "Ivermectina 1% — control nematodos y ectoparásitos",    costCop: "28000", vetName: "Dr. Carlos Medina", monthsBack: 1, nextMonths: 3 },
    { recordType: "vaccination" as const, title: "Vacuna Brucelosis",         description: "Cepa RB51 — control oficial FEDEGAN",                   costCop: "35000", vetName: "Dr. Carlos Medina", monthsBack: 3, nextMonths: 6 },
    { recordType: "deworming"   as const, title: "Desparasitación externa",   description: "Garrapaticida Amitraz — potrero 2 y 3",                 costCop: "32000", vetName: "Dr. Carlos Medina", monthsBack: 2, nextMonths: 2 },
    { recordType: "vaccination" as const, title: "Vacuna Rabia Bovina",       description: "Vacunación anual reglamentaria Ministerio Agricultura",  costCop: "38000", vetName: "Dr. Carlos Medina", monthsBack: 4, nextMonths: 8 },
    { recordType: "checkup"     as const, title: "Revisión sanitaria",        description: "Control sanitario rutinario — peso y condición corporal", costCop: "55000", vetName: "Dr. Carlos Medina", monthsBack: 1, nextMonths: 3 },
  ];
  const pigVaccines = [
    { recordType: "vaccination" as const, title: "Vacuna Peste Porcina",      description: "Dosis semestral PPC — reglamentaria",                   costCop: "38000", vetName: "Dr. Carlos Medina", monthsBack: 2, nextMonths: 6 },
    { recordType: "deworming"   as const, title: "Desparasitación piara",     description: "Fenbendazol preventivo — ciclo trimestral",              costCop: "22000", vetName: undefined,            monthsBack: 1, nextMonths: 3 },
    { recordType: "vaccination" as const, title: "Vacuna Aftosa porcinos",    description: "Control fiebre aftosa en porcinos",                     costCop: "32000", vetName: "Dr. Carlos Medina", monthsBack: 3, nextMonths: 6 },
  ];
  const horseVaccines = [
    { recordType: "vaccination" as const, title: "Vacuna Tétano equino",      description: "Toxoide tetánico anual — Criollo Colombiano",            costCop: "48000", vetName: "Dr. Carlos Medina", monthsBack: 3, nextMonths: 9 },
    { recordType: "deworming"   as const, title: "Desparasitación equina",    description: "Ivermectina + Praziquantel — semestral",                 costCop: "35000", vetName: "Dr. Carlos Medina", monthsBack: 2, nextMonths: 4 },
    { recordType: "vaccination" as const, title: "Vacuna Influenza equina",   description: "Control influenza — vacuna bivalente",                   costCop: "62000", vetName: "Dr. Carlos Medina", monthsBack: 4, nextMonths: 8 },
  ];
  const goatVaccines = [
    { recordType: "vaccination" as const, title: "Vacuna Clostridiosis",      description: "Polivalente clostridiosis caprina",                      costCop: "28000", vetName: "Dr. Carlos Medina", monthsBack: 3, nextMonths: 6 },
    { recordType: "deworming"   as const, title: "Desparasitación caprinos",  description: "Levamisol + Albendazol — control gastrointestinal",      costCop: "18000", vetName: undefined,            monthsBack: 1, nextMonths: 3 },
  ];

  const medicalRecords = animalRows.flatMap((animal, i) => {
    let pool: typeof cattleVaccines;
    switch (animal.species) {
      case "pig":   pool = pigVaccines;   break;
      case "horse": pool = horseVaccines; break;
      case "goat":  pool = goatVaccines;  break;
      default:      pool = cattleVaccines; break;
    }
    const v1 = pool[i % pool.length]!;
    const v2 = pool[(i + 1) % pool.length]!;
    const records = [
      {
        animalId: animal.id, recordType: v1.recordType, title: v1.title,
        description: v1.description, costCop: v1.costCop,
        vetName: v1.vetName ?? undefined, recordDate: monthsAgo(v1.monthsBack),
        nextDueDate: monthsAgo(-v1.nextMonths),
      },
      {
        animalId: animal.id, recordType: v2.recordType, title: v2.title,
        description: v2.description, costCop: v2.costCop,
        vetName: v2.vetName ?? undefined, recordDate: monthsAgo(v2.monthsBack + 1),
      },
    ];
    // Every 3rd animal gets a checkup too
    if (i % 3 === 0 && animal.species === "cattle") {
      records.push({
        animalId: animal.id, recordType: "checkup" as const,
        title: "Control de condición corporal",
        description: "Evaluación nutricional y condición corporal — escala 1–5",
        costCop: "40000", vetName: "Dr. Carlos Medina",
        recordDate: daysAgo(8 + (i % 20)),
      });
    }
    return records;
  });
  await db.insert(medicalRecordsTable).values(medicalRecords);

  await db.insert(inventoryItemsTable).values([
    { farmId, category: "feed",     name: "Concentrado Bovino Engorde", quantity: "18", unit: "bags",  lowStockThreshold: "5",  costPerUnitCop: "95000",  supplierName: "AgroSantos S.A.S",     notes: "Bulto 40kg" },
    { farmId, category: "feed",     name: "Sal Mineralizada Plus",      quantity: "3",  unit: "bags",  lowStockThreshold: "4",  costPerUnitCop: "62000",  supplierName: "AgroSantos S.A.S" },
    { farmId, category: "feed",     name: "Silo de Maíz",               quantity: "1200", unit: "kg", lowStockThreshold: "300",costPerUnitCop: "280",    notes: "Reserva forraje temporada seca" },
    { farmId, category: "medicine", name: "Ivermectina 1%",             quantity: "4",  unit: "liters",lowStockThreshold: "1", costPerUnitCop: "48000",  supplierName: "VetFarma Colombia",    expirationDate: monthsAgo(-8) },
    { farmId, category: "medicine", name: "Oxitetraciclina 20%",        quantity: "2",  unit: "liters",lowStockThreshold: "1", costPerUnitCop: "55000",  supplierName: "VetFarma Colombia",    expirationDate: monthsAgo(-6) },
    { farmId, category: "medicine", name: "Vitaminas ADE",              quantity: "1",  unit: "liters",lowStockThreshold: "2", costPerUnitCop: "42000" },
    { farmId, category: "tools",    name: "Jeringa Drencher 30ml",      quantity: "6",  unit: "units",                         costPerUnitCop: "18000" },
    { farmId, category: "supplies", name: "Aretes de identificación",   quantity: "45", unit: "units", lowStockThreshold: "10",costPerUnitCop: "3500",   supplierName: "GanaderTech" },
  ]);

  await db.insert(employeesTable).values([
    { farmId, name: "Juan Carlos Pérez",    phone: "+57 312 441 8821", email: "jcperez@gmail.com",      startDate: "2019-03-01", monthlySalary: "2000000", bankName: "Bancolombia",  bankAccount: "404-123456-78", notes: "Mayordomo principal",          pension: "240000", salud: "170000", arl: "10400", primas: "1000000", cesantias: "2000000" },
    { farmId, name: "María José Rodríguez", phone: "+57 315 882 0034",                                  startDate: "2021-06-15", monthlySalary: "1160000", bankName: "Nequi",                             notes: "Ordeñadora turno mañana",       pension: "139200", salud: "98600",  arl: "6032",  primas: "580000",  cesantias: "1160000" },
    { farmId, name: "Luis Alberto García",  phone: "+57 301 773 5509",                                  startDate: "2020-01-10", monthlySalary: "1300000", bankName: "Davivienda",  bankAccount: "234-987654-21", notes: "Vaquero y cuidado de potreros", pension: "156000", salud: "110500", arl: "6760",  primas: "650000",  cesantias: "1300000" },
    { farmId, name: "Ana Lucía Torres",     phone: "+57 320 664 1127", email: "aluciatv@hotmail.com",   startDate: "2022-08-01", monthlySalary: "1500000", bankName: "Bancolombia", bankAccount: "404-654321-90", notes: "Auxiliar veterinaria",          pension: "180000", salud: "127500", arl: "7800",  primas: "750000",  cesantias: "1500000" },
    { farmId, name: "Sebastián Morales",    phone: "+57 317 229 4453",                                  startDate: "2021-11-20", monthlySalary: "1800000", bankName: "Banco Bogotá",                       notes: "Tractorista y mantenimiento",   pension: "216000", salud: "153000", arl: "9360",  primas: "900000",  cesantias: "1800000" },
    { farmId, name: "Carmen Rosa Jiménez",  phone: "+57 310 558 9976", email: "crjimenez@outlook.com",  startDate: "2018-05-14", monthlySalary: "2500000", bankName: "Bancolombia", bankAccount: "404-112233-44", notes: "Administradora de finca",       pension: "300000", salud: "212500", arl: "13000", primas: "1250000", cesantias: "2500000" },
  ]);

  await db.insert(financeTransactionsTable).values([
    { farmId, type: "income",  category: "venta_leche",    amount: "2050000",  description: "Venta leche quincenal — 410 litros",               date: daysAgo(1),       notes: "Cooperativa Lácteos del Río" },
    { farmId, type: "income",  category: "venta_leche",    amount: "1950000",  description: "Venta leche quincenal — 390 litros",               date: daysAgo(5),       notes: "Cooperativa Lácteos del Río" },
    { farmId, type: "income",  category: "venta_leche",    amount: "1850000",  description: "Venta leche quincenal — 370 litros",               date: daysAgo(16),      notes: "Cooperativa Lácteos del Río" },
    { farmId, type: "income",  category: "venta_leche",    amount: "1990000",  description: "Venta leche quincenal — 398 litros",               date: daysAgo(32),      notes: null },
    { farmId, type: "income",  category: "venta_leche",    amount: "1920000",  description: "Venta leche quincenal — 384 litros",               date: monthsAgo(1, 15), notes: null },
    { farmId, type: "income",  category: "venta_leche",    amount: "1870000",  description: "Venta leche quincenal — 374 litros",               date: daysAgo(52),      notes: "Cooperativa Lácteos del Río" },
    { farmId, type: "income",  category: "venta_leche",    amount: "1830000",  description: "Venta leche quincenal — 366 litros",               date: daysAgo(67),      notes: null },
    { farmId, type: "income",  category: "venta_leche",    amount: "1760000",  description: "Venta leche quincenal — 352 litros",               date: daysAgo(82),      notes: null },
    { farmId, type: "income",  category: "venta_leche",    amount: "1650000",  description: "Venta leche quincenal — 330 litros",               date: monthsAgo(3, 1),  notes: null },
    { farmId, type: "income",  category: "venta_animales", amount: "8200000",  description: "Venta novillo gordo BOV-010 — 820 kg en pie",       date: daysAgo(3),       notes: "Frigorífico El Palmar — 10.000 COP/kg" },
    { farmId, type: "income",  category: "venta_animales", amount: "16400000", description: "Venta 2 novillos Brahman engorde — 2.000 kg en pie",date: daysAgo(10),      notes: "Frigorífico El Palmar — 8.200 COP/kg" },
    { farmId, type: "income",  category: "venta_animales", amount: "6900000",  description: "Venta 3 terneros destetados",                      date: daysAgo(18),      notes: "Subasta ganadera Fusagasugá" },
    { farmId, type: "income",  category: "venta_animales", amount: "5200000",  description: "Venta novillo Palomo — 480 kg en pie",             date: daysAgo(4),       notes: "Frigorífico El Palmar" },
    { farmId, type: "income",  category: "venta_animales", amount: "5100000",  description: "Venta 3 cerdos cebados (Yorkshire + Pietrain)",     date: monthsAgo(1, 8),  notes: "Frigorífico El Palmar" },
    { farmId, type: "income",  category: "venta_animales", amount: "3800000",  description: "Venta 2 cerdos Duroc en pie",                      date: monthsAgo(2, 18), notes: "Frigorífico El Palmar" },
    { farmId, type: "income",  category: "venta_cosecha",  amount: "2800000",  description: "Venta café pergamino seco — 140 kg",               date: daysAgo(2),       notes: "Cooperativa de Caficultores" },
    { farmId, type: "income",  category: "venta_cosecha",  amount: "3100000",  description: "Venta fríjol cosecha principal — 620 kg",          date: daysAgo(55),      notes: "Mercado Fusagasugá" },
    { farmId, type: "income",  category: "venta_cosecha",  amount: "2400000",  description: "Venta maíz cosecha — 450 kg",                      date: monthsAgo(2, 5),  notes: "Mercado local" },
    { farmId, type: "income",  category: "otros",          amount: "850000",   description: "Alquiler potrero norte — 3 meses",                 date: daysAgo(45),      notes: "Vecino Eduardo Salcedo" },
    { farmId, type: "income",  category: "subsidio",       amount: "1800000",  description: "Subsidio Colombia Agro — apoyo producción bovina",  date: daysAgo(75),      notes: "MADR — Ministerio de Agricultura" },
    { farmId, type: "income",  category: "subsidio",       amount: "1200000",  description: "Subsidio FEDEGAN apoyo ganadero",                  date: monthsAgo(3, 20), notes: null },
    { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                     date: daysAgo(3),       notes: "Juan C., María J., Luis A., Ana L., Sebastián M., Carmen R." },
    { farmId, type: "expense", category: "prestaciones",   amount: "1231620",  description: "Pensión + Salud + ARL mensual empleados",          date: daysAgo(4),       notes: "Pago parafiscales mes anterior" },
    { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                     date: monthsAgo(1, 28), notes: null },
    { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                     date: monthsAgo(2, 28), notes: null },
    { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                     date: monthsAgo(3, 28), notes: null },
    { farmId, type: "expense", category: "alimentacion",   amount: "1350000",  description: "Concentrado bovino Ganaplus — 15 bultos",          date: daysAgo(12),      notes: "AgroSantos S.A.S" },
    { farmId, type: "expense", category: "alimentacion",   amount: "1080000",  description: "Sal mineralizada y concentrado",                   date: monthsAgo(2, 10), notes: null },
    { farmId, type: "expense", category: "alimentacion",   amount: "1140000",  description: "Concentrado bovino — 12 bultos",                   date: monthsAgo(1, 8),  notes: "AgroSantos S.A.S" },
    { farmId, type: "expense", category: "insumos",        amount: "320000",   description: "Sal mineralizada — 5 bultos extra temporada seca", date: monthsAgo(2, 20), notes: null },
    { farmId, type: "expense", category: "insumos",        amount: "84000",    description: "Aretes de identificación y jeringas",              date: monthsAgo(3, 10), notes: null },
    { farmId, type: "expense", category: "medicamentos",   amount: "166000",   description: "Ivermectina y Oxitetraciclina",                    date: monthsAgo(1, 12), notes: "VetFarma Colombia" },
    { farmId, type: "expense", category: "medicamentos",   amount: "210000",   description: "Vitaminas ADE y antibiótico terneros",             date: daysAgo(40),      notes: "VetFarma Colombia" },
    { farmId, type: "expense", category: "servicios",      amount: "280000",   description: "Visita veterinario — 4 animales",                  date: monthsAgo(1, 20), notes: "Dr. Carlos Medina" },
    { farmId, type: "expense", category: "transporte",     amount: "450000",   description: "Flete 4 novillos a Bogotá",                        date: daysAgo(22),      notes: "Transportes Hernández" },
    { farmId, type: "expense", category: "servicios",      amount: "185000",   description: "Mantenimiento cerca eléctrica potrero 2",          date: daysAgo(28),      notes: "Sebastián Morales + materiales" },
    { farmId, type: "expense", category: "servicios",      amount: "650000",   description: "Instalación bebederos automáticos potrero 3",      date: monthsAgo(3, 5),  notes: "Herrería El Cóndor" },
  ]);

  await db.insert(contactsTable).values([
    { farmId, name: "Dr. Carlos Medina",          phone: "+57 310 456 7890", email: "cmedina@vetcampo.co",       category: "vet",       notes: "Especialista en bovinos y porcinos. Disponible 24/7 para emergencias." },
    { farmId, name: "AgroSantos S.A.S",           phone: "+57 321 789 0123",                                     category: "supplier",  notes: "Proveedor concentrados y sal mineralizada. Entrega a domicilio pedidos > 10 bultos." },
    { farmId, name: "VetFarma Colombia",          phone: "+57 300 111 2233", email: "ventas@vetfarma.com.co",    category: "supplier",  notes: "Medicamentos veterinarios. Crédito 30 días." },
    { farmId, name: "Cooperativa Lácteos del Río",phone: "+57 8 345 6789",   email: "acopio@lacteosdelrio.co",   category: "buyer",     notes: "Recogida de leche lunes, miércoles y viernes. Precio $5.000/litro." },
    { farmId, name: "Frigorífico El Palmar",      phone: "+57 316 900 4455",                                     category: "buyer",     notes: "Compra cerdos y novillos en pie. Requiere certificado ICA." },
    { farmId, name: "Transportes Hernández",      phone: "+57 311 234 5678",                                     category: "transport", notes: "Flete ganado Cundinamarca. Camión doble troque, máx. 15 cabezas." },
  ]);

  await db.insert(activityLogTable).values([
    { farmId, actionType: "create", entityType: "animal",        description: "Animal Reina (BOV-001) añadida al sistema" },
    { farmId, actionType: "create", entityType: "weight_record", description: "Peso registrado para Reina: 418 kg" },
    { farmId, actionType: "create", entityType: "medical_record",description: "Vacuna Aftosa aplicada a Reina" },
    { farmId, actionType: "create", entityType: "medical_record",description: "Revisión prenatal — Luna, mes 5" },
    { farmId, actionType: "create", entityType: "inventory",     description: "Concentrado Bovino añadido: 18 bultos" },
    { farmId, actionType: "update", entityType: "inventory",     description: "Sal Mineralizada: stock bajo alerta" },
    { farmId, actionType: "create", entityType: "finance",       description: "Ingreso registrado: Venta leche $1.850.000" },
    { farmId, actionType: "create", entityType: "contact",       description: "Contacto añadido: Dr. Carlos Medina (Veterinario)" },
  ]);

  // ── MILK RECORDS (30 days for main dairy cows) ───────────────────────────
  // Indices: 0=Reina, 4=Estrella, 10=Lechera (all Holstein/Gyr cattle females)
  const lecheraA = animalRows[10]; // Lechera  — Holstein  — 18–20 L/day
  const estrellaA = animalRows[4]; // Estrella — Gyr       — 14–16 L/day
  const reinaA    = animalRows[0]; // Reina    — Brahman   — 11–13 L/day
  if (lecheraA && estrellaA && reinaA) {
    const milkRows: { animalId: string; recordedAt: string; amountLiters: string; session: "morning" | "afternoon" | "full_day"; notes?: string }[] = [];
    for (let i = 0; i < 30; i++) {
      milkRows.push({ animalId: lecheraA.id,  recordedAt: daysAgo(i), amountLiters: (18 + Math.round((Math.random() - 0.5) * 4)).toFixed(1), session: "morning" });
      milkRows.push({ animalId: lecheraA.id,  recordedAt: daysAgo(i), amountLiters: (10 + Math.round((Math.random() - 0.5) * 3)).toFixed(1), session: "afternoon" });
      milkRows.push({ animalId: estrellaA.id, recordedAt: daysAgo(i), amountLiters: (14 + Math.round((Math.random() - 0.5) * 3)).toFixed(1), session: "morning" });
      milkRows.push({ animalId: estrellaA.id, recordedAt: daysAgo(i), amountLiters: (8  + Math.round((Math.random() - 0.5) * 2)).toFixed(1), session: "afternoon" });
      milkRows.push({ animalId: reinaA.id,    recordedAt: daysAgo(i), amountLiters: (11 + Math.round((Math.random() - 0.5) * 3)).toFixed(1), session: "morning" });
      milkRows.push({ animalId: reinaA.id,    recordedAt: daysAgo(i), amountLiters: (7  + Math.round((Math.random() - 0.5) * 2)).toFixed(1), session: "afternoon" });
    }
    await db.insert(milkRecordsTable).values(milkRows);
  }

  // ── FARM EVENTS — current month (relative) + Mar/May/Jun 2026 (absolute) ─
  await db.insert(farmEventsTable).values([
    // ── Today & near future (relative to seed date) ───────────────────────
    { farmId, title: "Revisión semanal hato",             titleEn: "Weekly herd check",               category: "health",       startDate: daysFromNow(0),  description: "Control visual estado general — peso visual y condición corporal.",  descriptionEn: "Visual health check — body weight and condition assessment.",           assignedTo: "Juan Carlos Pérez" },
    { farmId, title: "Suministro concentrado bovino",     titleEn: "Cattle feed delivery",            category: "feeding",      startDate: daysFromNow(1),  description: "Recepción 20 bultos AgroSantos S.A.S.",                             descriptionEn: "Receiving 20 bags from AgroSantos S.A.S.",                              assignedTo: "Juan Carlos Pérez" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: daysFromNow(2),  description: "Recogida quincenal Cooperativa Lácteos del Río — aprox. 400 L.",   descriptionEn: "Biweekly pickup by Cooperativa Lácteos del Río — approx. 400 L." },
    { farmId, title: "Desparasitación hato completo",     titleEn: "Full herd deworming",             category: "health",       startDate: daysFromNow(3),  description: "Ivermectina + Fenbendazol. Dr. Medina presente.",                   descriptionEn: "Ivermectin + Fenbendazole. Dr. Medina attending.",                      assignedTo: "Ana Lucía Torres" },
    { farmId, title: "Reunión con comprador novillos",    titleEn: "Meeting with steer buyer",        category: "meeting",      startDate: daysFromNow(5),  description: "Frigorífico El Palmar — cotización 5 novillos gordo.",              descriptionEn: "Frigorífico El Palmar — quote for 5 finished steers.",                  assignedTo: "Carmen Rosa Jiménez" },
    { farmId, title: "Mantenimiento cerca eléctrica",     titleEn: "Electric fence maintenance",      category: "maintenance",  startDate: daysFromNow(7),  description: "Revisión y reparación potrero 2 y 3.",                             descriptionEn: "Inspection and repair of paddocks 2 and 3.",                            assignedTo: "Sebastián Morales" },
    { farmId, title: "Revisión prenatal Luna",            titleEn: "Luna prenatal checkup",           category: "health",       startDate: daysFromNow(9),  description: "Confirmación preñez mes 7 — Dr. Medina.",                          descriptionEn: "Pregnancy confirmation month 7 — Dr. Medina.",                          assignedTo: "Dr. Carlos Medina" },
    { farmId, title: "Vacuna Aftosa semestral",           titleEn: "Biannual FMD vaccination",        category: "health",       startDate: daysFromNow(12), description: "Dosis semestral para todo el hato bovino.",                         descriptionEn: "Biannual dose for the entire bovine herd.",                             assignedTo: "Dr. Carlos Medina" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: daysFromNow(16), description: "Recogida quincenal Cooperativa Lácteos del Río.",                  descriptionEn: "Biweekly pickup by Cooperativa Lácteos del Río." },
    { farmId, title: "Cosecha café parcela norte",        titleEn: "North plot coffee harvest",       category: "harvest",      startDate: daysFromNow(20), endDate: daysFromNow(22), description: "Recolección manual café maduro parcela norte — 3 días.",          descriptionEn: "Hand harvest of ripe coffee, north plot — 3 days." },
    { farmId, title: "Siembra maíz parcela 2",            titleEn: "Maize planting, plot 2",          category: "harvest",      startDate: daysFromNow(24), endDate: daysFromNow(25), description: "Siembra manual maíz ICA V-109 — 2 jornadas.",                      descriptionEn: "Manual planting ICA V-109 maize — 2 workdays.",                         assignedTo: "Luis Alberto García" },
    { farmId, title: "Pago nómina mensual",               titleEn: "Monthly payroll",                 category: "meeting",      startDate: daysFromNow(27), description: "Transferencia salarios 6 empleados.",                               descriptionEn: "Salary transfers for 6 employees.",                                     assignedTo: "Carmen Rosa Jiménez" },
    // ── Recent past (relative) ────────────────────────────────────────────
    { farmId, title: "Desparasitación externa — cerdos",  titleEn: "External deworming — pigs",       category: "health",       startDate: daysAgo(3),      description: "Fenbendazol preventivo piara completa.",                           descriptionEn: "Preventive Fenbendazole for full pig herd." },
    { farmId, title: "Aplicación sal mineralizada",       titleEn: "Mineral salt application",        category: "feeding",      startDate: daysAgo(5),      description: "Distribución semanal saladeros potreros 1–4.",                    descriptionEn: "Weekly distribution at salt licks, paddocks 1–4.",                      assignedTo: "Luis Alberto García" },
    { farmId, title: "Vacuna Brucelosis terneras",        titleEn: "Brucellosis vaccination — calves",category: "health",       startDate: daysAgo(8),      description: "Cepa RB51 terneras BOV-030, BOV-052.",                             descriptionEn: "Strain RB51 calves BOV-030, BOV-052.",                                  assignedTo: "Dr. Carlos Medina" },
    { farmId, title: "Fumigación potreros 1 y 2",         titleEn: "Paddock 1 & 2 spraying",          category: "maintenance",  startDate: daysAgo(10),     description: "Control de maleza y chapeo anual.",                                descriptionEn: "Weed control and annual clearing.",                                     assignedTo: "Sebastián Morales" },
    { farmId, title: "Visita ICA — certificación",        titleEn: "ICA inspection — certification",  category: "meeting",      startDate: daysAgo(15),     description: "Inspección sanitaria reglamentaria. Certificado renovado.",        descriptionEn: "Regulatory sanitary inspection. Certificate renewed." },
    // ── March 2026 (absolute) ─────────────────────────────────────────────
    { farmId, title: "Análisis de suelo — parcela norte", titleEn: "Soil analysis — north plot",      category: "maintenance",  startDate: "2026-03-05",  description: "Toma de muestras para análisis NPK y pH.",                         descriptionEn: "Sampling for NPK and pH analysis.",                                     assignedTo: "Sebastián Morales" },
    { farmId, title: "Capacitación empleados SENA",       titleEn: "SENA employee training",          category: "meeting",      startDate: "2026-03-12",  description: "Taller manejo bovinos y bioseguridad en finca.",                   descriptionEn: "Cattle handling and farm biosecurity workshop.",                         assignedTo: "Carmen Rosa Jiménez" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-03-14",  description: "Recogida quincenal — 380 litros.",                                 descriptionEn: "Biweekly pickup — 380 liters." },
    { farmId, title: "Siembra frijol parcela norte",      titleEn: "Bean planting, north plot",       category: "harvest",      startDate: "2026-03-18",  endDate: "2026-03-19", description: "Siembra manual frijol ICA Cerinza — 2 jornadas.",                  descriptionEn: "Manual planting ICA Cerinza beans — 2 workdays." },
    { farmId, title: "Mantenimiento bomba de agua",       titleEn: "Water pump maintenance",          category: "maintenance",  startDate: "2026-03-24",  description: "Revisión y cambio de filtros tanque principal.",                   descriptionEn: "Inspection and filter replacement, main tank.",                          assignedTo: "Sebastián Morales" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-03-28",  description: "Recogida quincenal — 395 litros.",                                 descriptionEn: "Biweekly pickup — 395 liters." },
    // ── May 2026 (absolute) ───────────────────────────────────────────────
    { farmId, title: "Pago nómina mensual",               titleEn: "Monthly payroll",                 category: "meeting",      startDate: "2026-05-03",  description: "Transferencia salarios 6 empleados.",                               descriptionEn: "Salary transfers for 6 employees.",                                     assignedTo: "Carmen Rosa Jiménez" },
    { farmId, title: "Revisión semestral hato",           titleEn: "Biannual herd review",            category: "health",       startDate: "2026-05-07",  description: "Revisión condición corporal hato completo.",                       descriptionEn: "Full herd body condition review.",                                       assignedTo: "Dr. Carlos Medina" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-05-09",  description: "Recogida quincenal Cooperativa Lácteos del Río.",                  descriptionEn: "Biweekly pickup, Cooperativa Lácteos del Río." },
    { farmId, title: "Suministro concentrado bovino",     titleEn: "Cattle feed delivery",            category: "feeding",      startDate: "2026-05-13",  description: "Recepción 20 bultos AgroSantos S.A.S.",                             descriptionEn: "Receiving 20 bags from AgroSantos S.A.S.",                              assignedTo: "Juan Carlos Pérez" },
    { farmId, title: "Fumigación potreros 3 y 4",         titleEn: "Paddock 3 & 4 spraying",          category: "maintenance",  startDate: "2026-05-16",  description: "Control de maleza — chapeo semestral.",                            descriptionEn: "Weed control — biannual clearing.",                                     assignedTo: "Sebastián Morales" },
    { farmId, title: "Desparasitación hato completo",     titleEn: "Full herd deworming",             category: "health",       startDate: "2026-05-20",  description: "Ivermectina + Fenbendazol — ciclo trimestral.",                     descriptionEn: "Ivermectin + Fenbendazole — quarterly cycle.",                          assignedTo: "Ana Lucía Torres" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-05-23",  description: "Recogida quincenal Cooperativa Lácteos del Río.",                  descriptionEn: "Biweekly pickup, Cooperativa Lácteos del Río." },
    { farmId, title: "Reunión proveedores",               titleEn: "Supplier meeting",                category: "meeting",      startDate: "2026-05-26",  description: "Cotización insumos y medicamentos segundo semestre.",               descriptionEn: "Quote for supplies and medication, second semester.",                    assignedTo: "Carmen Rosa Jiménez" },
    { farmId, title: "Pago nómina mensual",               titleEn: "Monthly payroll",                 category: "meeting",      startDate: "2026-05-29",  description: "Transferencia salarios 6 empleados.",                               descriptionEn: "Salary transfers for 6 employees.",                                     assignedTo: "Carmen Rosa Jiménez" },
    // ── June 2026 (absolute) ──────────────────────────────────────────────
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-06-06",  description: "Recogida quincenal Cooperativa Lácteos del Río.",                  descriptionEn: "Biweekly pickup, Cooperativa Lácteos del Río." },
    { farmId, title: "Vacuna Aftosa semestral",           titleEn: "Biannual FMD vaccination",        category: "health",       startDate: "2026-06-10",  description: "Dosis semestral todo el hato bovino — reglamentaria ICA.",         descriptionEn: "Biannual dose for the entire bovine herd — ICA regulation.",            assignedTo: "Dr. Carlos Medina" },
    { farmId, title: "Cosecha maíz parcela 2",            titleEn: "Maize harvest, plot 2",           category: "harvest",      startDate: "2026-06-12",  endDate: "2026-06-14", description: "Recolección maíz ICA V-109 — 3 jornadas.",                         descriptionEn: "ICA V-109 maize harvest — 3 workdays." },
    { farmId, title: "Reunión Cámara Agropecuaria",       titleEn: "Agricultural Chamber meeting",    category: "meeting",      startDate: "2026-06-17",  description: "Cotización insumos y análisis precios ganado segundo semestre.",   descriptionEn: "Supply quotes and cattle price analysis, second semester.",              assignedTo: "Carmen Rosa Jiménez" },
    { farmId, title: "Suministro concentrado bovino",     titleEn: "Cattle feed delivery",            category: "feeding",      startDate: "2026-06-19",  description: "Recepción 20 bultos AgroSantos S.A.S.",                             descriptionEn: "Receiving 20 bags from AgroSantos S.A.S.",                              assignedTo: "Juan Carlos Pérez" },
    { farmId, title: "Entrega leche — Cooperativa",       titleEn: "Milk delivery — Cooperative",     category: "other",        startDate: "2026-06-20",  description: "Recogida quincenal Cooperativa Lácteos del Río.",                  descriptionEn: "Biweekly pickup, Cooperativa Lácteos del Río." },
    { farmId, title: "Desparasitación hato completo",     titleEn: "Full herd deworming",             category: "health",       startDate: "2026-06-24",  description: "Ivermectina + Fenbendazol — ciclo trimestral.",                    descriptionEn: "Ivermectin + Fenbendazole — quarterly cycle.",                          assignedTo: "Ana Lucía Torres" },
    { farmId, title: "Pago nómina mensual",               titleEn: "Monthly payroll",                 category: "meeting",      startDate: "2026-06-29",  description: "Transferencia salarios 6 empleados.",                               descriptionEn: "Salary transfers for 6 employees.",                                     assignedTo: "Carmen Rosa Jiménez" },
  ]);
}

export async function ensureDemoFarmData() {
  const existing = await db.select({ id: animalsTable.id })
    .from(animalsTable)
    .where(eq(animalsTable.farmId, DEMO_FARM_ID))
    .limit(1);
  if (existing.length > 0) return;
  await seedDemoFarmData(DEMO_FARM_ID);
}

export async function ensureDemoAuthUser() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  const hash = await bcrypt.hash(DEMO_USER_PASS, 10);
  await pool.query(`
    INSERT INTO auth_users (id, email, password_hash) VALUES ($1, $2, $3)
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `, [DEMO_USER_ID, DEMO_USER_EMAIL, hash]);

  await pool.query(`
    INSERT INTO profiles (id, full_name, role, preferred_language)
    VALUES ($1, 'Demo Usuario', 'owner', 'es')
    ON CONFLICT (id) DO NOTHING
  `, [DEMO_USER_ID]);

  await pool.query(`
    INSERT INTO farms (id, owner_id, name, location)
    VALUES ($1, $2, 'Finca La Esperanza', 'Colombia')
    ON CONFLICT (id) DO NOTHING
  `, [DEMO_FARM_ID, DEMO_USER_ID]);

  await pool.query(`
    INSERT INTO farm_members (farm_id, user_id, role, permissions)
    VALUES ($1, $2, 'owner', '{"can_edit":true,"can_add_animals":true,"can_log_inventory":true}')
    ON CONFLICT (farm_id, user_id) DO NOTHING
  `, [DEMO_FARM_ID, DEMO_USER_ID]);

  await ensureDemoFarmData();
}

const router = Router();

router.post("/farms/:farmId/seed", requireAuth, requireFarmAccess, async (req, res) => {
  const farmId = req.params["farmId"]!;
  try {
    await db.delete(financeTransactionsTable).where(eq(financeTransactionsTable.farmId, farmId));
    await db.delete(contactsTable).where(eq(contactsTable.farmId, farmId));
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.farmId, farmId));
    await db.delete(activityLogTable).where(eq(activityLogTable.farmId, farmId));
    await db.delete(employeesTable).where(eq(employeesTable.farmId, farmId));
    await db.delete(farmEventsTable).where(eq(farmEventsTable.farmId, farmId));
    await db.delete(animalsTable).where(eq(animalsTable.farmId, farmId));
    await seedDemoFarmData(farmId);
    return res.json({ ok: true, message: "Demo data seeded successfully" });
  } catch (err) {
    req.log.error({ err }, "Seed error");
    return res.status(500).json({ error: "seed failed", detail: String(err) });
  }
});

router.delete("/farms/:farmId/seed", requireAuth, requireFarmAccess, async (req, res) => {
  const farmId = req.params["farmId"]!;
  try {
    await db.delete(financeTransactionsTable).where(eq(financeTransactionsTable.farmId, farmId));
    await db.delete(contactsTable).where(eq(contactsTable.farmId, farmId));
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.farmId, farmId));
    await db.delete(activityLogTable).where(eq(activityLogTable.farmId, farmId));
    await db.delete(employeesTable).where(eq(employeesTable.farmId, farmId));
    await db.delete(farmEventsTable).where(eq(farmEventsTable.farmId, farmId));
    await db.delete(animalsTable).where(eq(animalsTable.farmId, farmId));
    return res.json({ ok: true, message: "Demo data cleared" });
  } catch (err) {
    req.log.error({ err }, "Clear seed error");
    return res.status(500).json({ error: "clear failed" });
  }
});

export default router;
