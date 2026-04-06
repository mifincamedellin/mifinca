import { Router } from "express";
import { db } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable,
  inventoryItemsTable, financeTransactionsTable,
  contactsTable, activityLogTable, farmMembersTable, employeesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireFarmAccess } from "../middleware/auth.js";

const router = Router();

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

// POST /api/farms/:farmId/seed — insert demo data
router.post("/farms/:farmId/seed", requireAuth, requireFarmAccess, async (req, res) => {
  const farmId = req.params["farmId"]!;
  try {
    // ── ANIMALS (20) ─────────────────────────────────────────────────────────
    const animalRows = await db.insert(animalsTable).values([
      { farmId, customTag: "BOV-001", species: "cattle", breed: "Brahman",          name: "Reina",     sex: "female", dateOfBirth: "2020-03-12", status: "active", notes: "Buena productora de leche", photoUrl: "/animals/brahman.png" },
      { farmId, customTag: "BOV-002", species: "cattle", breed: "Simmental",        name: "Luna",      sex: "female", dateOfBirth: "2021-07-05", status: "active", photoUrl: "/animals/simmental.png" },
      { farmId, customTag: "BOV-003", species: "cattle", breed: "Brahman",          name: "Toro Negro",sex: "male",   dateOfBirth: "2019-11-20", status: "active", notes: "Semental principal", photoUrl: "/animals/brahman.png" },
      { farmId, customTag: "BOV-004", species: "cattle", breed: "Cebú",             name: "Manchas",   sex: "female", dateOfBirth: "2022-01-08", status: "active", photoUrl: "/animals/cebu.png" },
      { farmId, customTag: "BOV-005", species: "cattle", breed: "Gyr",              name: "Estrella",  sex: "female", dateOfBirth: "2021-04-18", status: "active", notes: "Alta producción láctea", photoUrl: "/animals/gyr.png" },
      { farmId, customTag: "BOV-006", species: "cattle", breed: "Brahman",          name: "Canela",    sex: "female", dateOfBirth: "2020-08-25", status: "active", photoUrl: "/animals/brahman.png" },
      { farmId, customTag: "BOV-007", species: "cattle", breed: "Normando",         name: "Vendaval",  sex: "male",   dateOfBirth: "2018-12-10", status: "active", notes: "Toro reproductor reserva", photoUrl: "/animals/normando.png" },
      { farmId, customTag: "BOV-008", species: "cattle", breed: "Cebú",             name: "Rosada",    sex: "female", dateOfBirth: "2022-05-03", status: "active", photoUrl: "/animals/cebu.png" },
      { farmId, customTag: "BOV-009", species: "cattle", breed: "Simmental",        name: "Nube",      sex: "female", dateOfBirth: "2023-01-17", status: "active", notes: "Ternera en crecimiento", photoUrl: "/animals/simmental.png" },
      { farmId, customTag: "BOV-010", species: "cattle", breed: "Brahman",          name: "Palomo",    sex: "male",   dateOfBirth: "2022-09-29", status: "active", photoUrl: "/animals/brahman.png" },
      { farmId, customTag: "BOV-011", species: "cattle", breed: "Holstein",         name: "Lechera",   sex: "female", dateOfBirth: "2020-02-11", status: "active", notes: "Mejor productora del hato", photoUrl: "/animals/holstein.png" },
      { farmId, customTag: "BOV-012", species: "cattle", breed: "Gyr",              name: "Negrita",   sex: "female", dateOfBirth: "2021-11-06", status: "active", photoUrl: "/animals/gyr.png" },
      { farmId, customTag: "CER-001", species: "pig",    breed: "Landrace",         name: "Gordita",   sex: "female", dateOfBirth: "2023-02-14", status: "active", photoUrl: "/animals/landrace.png" },
      { farmId, customTag: "CER-002", species: "pig",    breed: "Duroc",            name: "Duroc",     sex: "male",   dateOfBirth: "2023-03-22", status: "active", photoUrl: "/animals/duroc.png" },
      { farmId, customTag: "CER-003", species: "pig",    breed: "Yorkshire",        name: "Rizada",    sex: "female", dateOfBirth: "2023-07-20", status: "active", photoUrl: "/animals/yorkshire.png" },
      { farmId, customTag: "CER-004", species: "pig",    breed: "Pietrain",         name: "Mota",      sex: "male",   dateOfBirth: "2023-08-14", status: "active", photoUrl: "/animals/pietrain.png" },
      { farmId, customTag: "CAB-001", species: "horse",  breed: "Criollo Colombiano",name: "Rayo",     sex: "male",   dateOfBirth: "2018-05-30", status: "active", notes: "Caballo de trabajo", photoUrl: "/animals/criollo.png" },
      { farmId, customTag: "CAB-002", species: "horse",  breed: "Criollo Colombiano",name: "Trueno",   sex: "male",   dateOfBirth: "2017-03-05", status: "active", notes: "Caballo de paso fino", photoUrl: "/animals/criollo.png" },
      { farmId, customTag: "CAP-001", species: "goat",   breed: "Nubian",           name: "Bella",     sex: "female", dateOfBirth: "2022-09-10", status: "active", photoUrl: "/animals/nubian.png" },
      { farmId, customTag: "CAP-002", species: "goat",   breed: "Boer",             name: "Caramelo",  sex: "female", dateOfBirth: "2023-04-12", status: "active", photoUrl: "/animals/boer.png" },
    ]).returning();

    const [reina, luna, toroNegro, manchas, estrella, canela, , , nube, , lechera, , gordita, , , , rayo, trueno, bella] = animalRows as typeof animalRows;

    // ── WEIGHT RECORDS ───────────────────────────────────────────────────────
    if (reina && luna && toroNegro && manchas && gordita && rayo && bella && estrella && lechera && nube) {
      await db.insert(weightRecordsTable).values([
        { animalId: reina.id,    weightKg: "380", recordedAt: monthsAgo(3) },
        { animalId: reina.id,    weightKg: "392", recordedAt: monthsAgo(2) },
        { animalId: reina.id,    weightKg: "405", recordedAt: monthsAgo(1) },
        { animalId: reina.id,    weightKg: "418", recordedAt: daysAgo(5) },
        { animalId: luna.id,     weightKg: "290", recordedAt: monthsAgo(2) },
        { animalId: luna.id,     weightKg: "308", recordedAt: monthsAgo(1) },
        { animalId: luna.id,     weightKg: "321", recordedAt: daysAgo(10) },
        { animalId: toroNegro.id,weightKg: "520", recordedAt: monthsAgo(2) },
        { animalId: toroNegro.id,weightKg: "535", recordedAt: daysAgo(15) },
        { animalId: manchas.id,  weightKg: "210", recordedAt: monthsAgo(1) },
        { animalId: manchas.id,  weightKg: "228", recordedAt: daysAgo(7) },
        { animalId: gordita.id,  weightKg: "85",  recordedAt: monthsAgo(1) },
        { animalId: gordita.id,  weightKg: "97",  recordedAt: daysAgo(12) },
        { animalId: rayo.id,     weightKg: "430", recordedAt: monthsAgo(1) },
        { animalId: bella.id,    weightKg: "52",  recordedAt: daysAgo(8) },
        { animalId: estrella.id, weightKg: "340", recordedAt: monthsAgo(2) },
        { animalId: estrella.id, weightKg: "358", recordedAt: daysAgo(9) },
        { animalId: lechera.id,  weightKg: "420", recordedAt: monthsAgo(1) },
        { animalId: lechera.id,  weightKg: "435", recordedAt: daysAgo(6) },
        { animalId: nube.id,     weightKg: "145", recordedAt: monthsAgo(1) },
        { animalId: nube.id,     weightKg: "162", recordedAt: daysAgo(14) },
        ...(trueno ? [{ animalId: trueno.id, weightKg: "480", recordedAt: monthsAgo(1) }] : []),
        ...(canela ? [{ animalId: canela.id, weightKg: "310", recordedAt: daysAgo(11) }] : []),
      ]);
    }

    // ── MEDICAL RECORDS ──────────────────────────────────────────────────────
    if (reina && luna && gordita && toroNegro) {
      await db.insert(medicalRecordsTable).values([
        { animalId: reina.id, recordType: "vaccination", title: "Vacuna Aftosa", description: "Dosis semestral fiebre aftosa", vetName: "Dr. Carlos Medina", costCop: "45000", recordDate: monthsAgo(2), nextDueDate: monthsAgo(-4) },
        { animalId: reina.id, recordType: "deworming", title: "Desparasitación externa", description: "Ivermectina 1% dosis completa", vetName: "Dr. Carlos Medina", costCop: "28000", recordDate: monthsAgo(1) },
        { animalId: luna.id, recordType: "vaccination", title: "Vacuna Brucelosis", description: "Cepa RB51 para hembras menores", vetName: "Dr. Carlos Medina", costCop: "35000", recordDate: monthsAgo(3) },
        { animalId: luna.id, recordType: "checkup", title: "Revisión prenatal", description: "Confirmación preñez mes 5", vetName: "Dr. Carlos Medina", costCop: "60000", recordDate: monthsAgo(1) },
        { animalId: toroNegro.id, recordType: "vaccination", title: "Vacuna Rabia Bovina", description: "Vacunación anual reglamentaria", vetName: "Dr. Carlos Medina", costCop: "38000", recordDate: monthsAgo(4) },
        { animalId: gordita.id, recordType: "deworming", title: "Desparasitación cerda", description: "Fenbendazol preventivo", costCop: "22000", recordDate: daysAgo(20) },
      ]);
    }

    // ── INVENTORY ────────────────────────────────────────────────────────────
    await db.insert(inventoryItemsTable).values([
      { farmId, category: "feed", name: "Concentrado Bovino Engorde", quantity: "18", unit: "bags", lowStockThreshold: "5", costPerUnitCop: "95000", supplierName: "AgroSantos S.A.S", notes: "Bulto 40kg" },
      { farmId, category: "feed", name: "Sal Mineralizada Plus", quantity: "3", unit: "bags", lowStockThreshold: "4", costPerUnitCop: "62000", supplierName: "AgroSantos S.A.S" },
      { farmId, category: "feed", name: "Silo de Maíz", quantity: "1200", unit: "kg", lowStockThreshold: "300", costPerUnitCop: "280", notes: "Reserva forraje temporada seca" },
      { farmId, category: "medicine", name: "Ivermectina 1%", quantity: "4", unit: "liters", lowStockThreshold: "1", costPerUnitCop: "48000", supplierName: "VetFarma Colombia", expirationDate: monthsAgo(-8) },
      { farmId, category: "medicine", name: "Oxitetraciclina 20%", quantity: "2", unit: "liters", lowStockThreshold: "1", costPerUnitCop: "55000", supplierName: "VetFarma Colombia", expirationDate: monthsAgo(-6) },
      { farmId, category: "medicine", name: "Vitaminas ADE", quantity: "1", unit: "liters", lowStockThreshold: "2", costPerUnitCop: "42000" },
      { farmId, category: "tools", name: "Jeringa Drencher 30ml", quantity: "6", unit: "units", costPerUnitCop: "18000" },
      { farmId, category: "supplies", name: "Aretes de identificación", quantity: "45", unit: "units", lowStockThreshold: "10", costPerUnitCop: "3500", supplierName: "GanaderTech" },
    ]);

    // ── EMPLOYEES (6 with parafiscal data) ───────────────────────────────────
    await db.insert(employeesTable).values([
      { farmId, name: "Juan Carlos Pérez",    phone: "+57 312 441 8821", email: "jcperez@gmail.com",       startDate: "2019-03-01", monthlySalary: "2000000", bankName: "Bancolombia",  bankAccount: "404-123456-78", notes: "Mayordomo principal",          pension: "240000", salud: "170000", arl: "10400", primas: "1000000", cesantias: "2000000" },
      { farmId, name: "María José Rodríguez", phone: "+57 315 882 0034",                                   startDate: "2021-06-15", monthlySalary: "1160000", bankName: "Nequi",                              notes: "Ordeñadora turno mañana",       pension: "139200", salud: "98600",  arl: "6032",  primas: "580000",  cesantias: "1160000" },
      { farmId, name: "Luis Alberto García",  phone: "+57 301 773 5509",                                   startDate: "2020-01-10", monthlySalary: "1300000", bankName: "Davivienda",  bankAccount: "234-987654-21", notes: "Vaquero y cuidado de potreros", pension: "156000", salud: "110500", arl: "6760",  primas: "650000",  cesantias: "1300000" },
      { farmId, name: "Ana Lucía Torres",     phone: "+57 320 664 1127", email: "aluciatv@hotmail.com",    startDate: "2022-08-01", monthlySalary: "1500000", bankName: "Bancolombia", bankAccount: "404-654321-90", notes: "Auxiliar veterinaria",          pension: "180000", salud: "127500", arl: "7800",  primas: "750000",  cesantias: "1500000" },
      { farmId, name: "Sebastián Morales",    phone: "+57 317 229 4453",                                   startDate: "2021-11-20", monthlySalary: "1800000", bankName: "Banco Bogotá",                        notes: "Tractorista y mantenimiento",   pension: "216000", salud: "153000", arl: "9360",  primas: "900000",  cesantias: "1800000" },
      { farmId, name: "Carmen Rosa Jiménez",  phone: "+57 310 558 9976", email: "crjimenez@outlook.com",   startDate: "2018-05-14", monthlySalary: "2500000", bankName: "Bancolombia", bankAccount: "404-112233-44", notes: "Administradora de finca",       pension: "300000", salud: "212500", arl: "13000", primas: "1250000", cesantias: "2500000" },
    ]);

    // ── FINANCES (36 transactions) ────────────────────────────────────────────
    await db.insert(financeTransactionsTable).values([
      // Income — milk (9 fortnightly payments ~4 months)
      { farmId, type: "income",  category: "venta_leche",    amount: "2050000",  description: "Venta leche quincenal — 410 litros",              date: daysAgo(1),        notes: "Cooperativa Lácteos del Río" },
      { farmId, type: "income",  category: "venta_leche",    amount: "1950000",  description: "Venta leche quincenal — 390 litros",              date: daysAgo(5),        notes: "Cooperativa Lácteos del Río" },
      { farmId, type: "income",  category: "venta_leche",    amount: "1850000",  description: "Venta leche quincenal — 370 litros",              date: daysAgo(16),       notes: "Cooperativa Lácteos del Río" },
      { farmId, type: "income",  category: "venta_leche",    amount: "1990000",  description: "Venta leche quincenal — 398 litros",              date: daysAgo(32),       notes: null },
      { farmId, type: "income",  category: "venta_leche",    amount: "1920000",  description: "Venta leche quincenal — 384 litros",              date: monthsAgo(1, 15), notes: null },
      { farmId, type: "income",  category: "venta_leche",    amount: "1870000",  description: "Venta leche quincenal — 374 litros",              date: daysAgo(52),       notes: "Cooperativa Lácteos del Río" },
      { farmId, type: "income",  category: "venta_leche",    amount: "1830000",  description: "Venta leche quincenal — 366 litros",              date: daysAgo(67),       notes: null },
      { farmId, type: "income",  category: "venta_leche",    amount: "1760000",  description: "Venta leche quincenal — 352 litros",              date: daysAgo(82),       notes: null },
      { farmId, type: "income",  category: "venta_leche",    amount: "1650000",  description: "Venta leche quincenal — 330 litros",              date: monthsAgo(3, 1),  notes: null },
      // Income — cattle & livestock sales
      { farmId, type: "income",  category: "venta_animales", amount: "8200000",  description: "Venta novillo gordo BOV-010 — 820 kg en pie",      date: daysAgo(3),        notes: "Frigorífico El Palmar — 10.000 COP/kg" },
      { farmId, type: "income",  category: "venta_animales", amount: "16400000", description: "Venta 2 novillos Brahman engorde — 2.000 kg en pie", date: daysAgo(10),    notes: "Frigorífico El Palmar — 8.200 COP/kg" },
      { farmId, type: "income",  category: "venta_animales", amount: "6900000",  description: "Venta 3 terneros destetados",                     date: daysAgo(18),       notes: "Subasta ganadera Fusagasugá" },
      { farmId, type: "income",  category: "venta_animales", amount: "5200000",  description: "Venta novillo Palomo — 480 kg en pie",            date: daysAgo(4),        notes: "Frigorífico El Palmar" },
      { farmId, type: "income",  category: "venta_animales", amount: "5100000",  description: "Venta 3 cerdos cebados (Yorkshire + Pietrain)",    date: monthsAgo(1, 8),  notes: "Frigorífico El Palmar" },
      { farmId, type: "income",  category: "venta_animales", amount: "3800000",  description: "Venta 2 cerdos Duroc en pie",                     date: monthsAgo(2, 18), notes: "Frigorífico El Palmar" },
      // Income — crops & other
      { farmId, type: "income",  category: "venta_cosecha",  amount: "2800000",  description: "Venta café pergamino seco — 140 kg",              date: daysAgo(2),        notes: "Cooperativa de Caficultores" },
      { farmId, type: "income",  category: "venta_cosecha",  amount: "3100000",  description: "Venta fríjol cosecha principal — 620 kg",         date: daysAgo(55),       notes: "Mercado Fusagasugá" },
      { farmId, type: "income",  category: "venta_cosecha",  amount: "2400000",  description: "Venta maíz cosecha — 450 kg",                     date: monthsAgo(2, 5),  notes: "Mercado local" },
      { farmId, type: "income",  category: "otros",           amount: "850000",   description: "Alquiler potrero norte — 3 meses",                date: daysAgo(45),       notes: "Vecino Eduardo Salcedo" },
      { farmId, type: "income",  category: "subsidio",       amount: "1800000",  description: "Subsidio Colombia Agro — apoyo producción bovina", date: daysAgo(75),      notes: "MADR — Ministerio de Agricultura" },
      { farmId, type: "income",  category: "subsidio",       amount: "1200000",  description: "Subsidio FEDEGAN apoyo ganadero",                 date: monthsAgo(3, 20), notes: null },
      // Expenses — payroll (4 months)
      { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                    date: daysAgo(3),        notes: "Juan C., María J., Luis A., Ana L., Sebastián M., Carmen R." },
      { farmId, type: "expense", category: "prestaciones",   amount: "1231620",  description: "Pensión + Salud + ARL mensual empleados",         date: daysAgo(4),        notes: "Pago parafiscales mes anterior" },
      { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                    date: monthsAgo(1, 28), notes: null },
      { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                    date: monthsAgo(2, 28), notes: null },
      { farmId, type: "expense", category: "nomina",         amount: "10260000", description: "Nómina mensual — 6 empleados",                    date: monthsAgo(3, 28), notes: null },
      // Expenses — feed & supplies
      { farmId, type: "expense", category: "alimentacion",   amount: "1350000",  description: "Concentrado bovino Ganaplus — 15 bultos",         date: daysAgo(12),       notes: "AgroSantos S.A.S" },
      { farmId, type: "expense", category: "alimentacion",   amount: "1080000",  description: "Sal mineralizada y concentrado",                  date: monthsAgo(2, 10), notes: null },
      { farmId, type: "expense", category: "alimentacion",   amount: "1140000",  description: "Concentrado bovino — 12 bultos",                  date: monthsAgo(1, 8),  notes: "AgroSantos S.A.S" },
      { farmId, type: "expense", category: "insumos",        amount: "320000",   description: "Sal mineralizada — 5 bultos extra temporada seca",date: monthsAgo(2, 20), notes: null },
      { farmId, type: "expense", category: "insumos",        amount: "84000",    description: "Aretes de identificación y jeringas",             date: monthsAgo(3, 10), notes: null },
      // Expenses — vet & medicine
      { farmId, type: "expense", category: "medicamentos",   amount: "166000",   description: "Ivermectina y Oxitetraciclina",                   date: monthsAgo(1, 12), notes: "VetFarma Colombia" },
      { farmId, type: "expense", category: "medicamentos",   amount: "210000",   description: "Vitaminas ADE y antibiótico terneros",            date: daysAgo(40),       notes: "VetFarma Colombia" },
      { farmId, type: "expense", category: "servicios",      amount: "280000",   description: "Visita veterinario — 4 animales",                 date: monthsAgo(1, 20), notes: "Dr. Carlos Medina" },
      // Expenses — transport & maintenance
      { farmId, type: "expense", category: "transporte",     amount: "450000",   description: "Flete 4 novillos a Bogotá",                       date: daysAgo(22),       notes: "Transportes Hernández" },
      { farmId, type: "expense", category: "servicios",      amount: "185000",   description: "Mantenimiento cerca eléctrica potrero 2",         date: daysAgo(28),       notes: "Sebastián Morales + materiales" },
      { farmId, type: "expense", category: "servicios",      amount: "650000",   description: "Instalación bebederos automáticos potrero 3",     date: monthsAgo(3, 5),  notes: "Herrería El Cóndor" },
    ]);

    // ── CONTACTS ─────────────────────────────────────────────────────────────
    await db.insert(contactsTable).values([
      { farmId, name: "Dr. Carlos Medina", phone: "+57 310 456 7890", email: "cmedina@vetcampo.co", category: "vet", notes: "Especialista en bovinos y porcinos. Disponible 24/7 para emergencias." },
      { farmId, name: "AgroSantos S.A.S", phone: "+57 321 789 0123", category: "supplier", notes: "Proveedor concentrados y sal mineralizada. Entrega a domicilio pedidos > 10 bultos." },
      { farmId, name: "VetFarma Colombia", phone: "+57 300 111 2233", email: "ventas@vetfarma.com.co", category: "supplier", notes: "Medicamentos veterinarios. Crédito 30 días." },
      { farmId, name: "Cooperativa Lácteos del Río", phone: "+57 8 345 6789", email: "acopio@lacteosdelrio.co", category: "buyer", notes: "Recogida de leche lunes, miércoles y viernes. Precio $5.000/litro." },
      { farmId, name: "Frigorífico El Palmar", phone: "+57 316 900 4455", category: "buyer", notes: "Compra cerdos y novillos en pie. Requiere certificado ICA." },
      { farmId, name: "Transportes Hernández", phone: "+57 311 234 5678", category: "transport", notes: "Flete ganado Cundinamarca. Camión doble troque, máx. 15 cabezas." },
    ]);

    // ── ACTIVITY LOG ─────────────────────────────────────────────────────────
    await db.insert(activityLogTable).values([
      { farmId, actionType: "create", entityType: "animal", description: "Animal Reina (BOV-001) añadida al sistema" },
      { farmId, actionType: "create", entityType: "weight_record", description: "Peso registrado para Reina: 418 kg" },
      { farmId, actionType: "create", entityType: "medical_record", description: "Vacuna Aftosa aplicada a Reina" },
      { farmId, actionType: "create", entityType: "medical_record", description: "Revisión prenatal — Luna, mes 5" },
      { farmId, actionType: "create", entityType: "inventory", description: "Concentrado Bovino añadido: 18 bultos" },
      { farmId, actionType: "update", entityType: "inventory", description: "Sal Mineralizada: stock bajo alerta" },
      { farmId, actionType: "create", entityType: "finance", description: "Ingreso registrado: Venta leche $1.850.000" },
      { farmId, actionType: "create", entityType: "contact", description: "Contacto añadido: Dr. Carlos Medina (Veterinario)" },
    ]);

    return res.json({ ok: true, message: "Demo data seeded successfully" });
  } catch (err) {
    req.log.error({ err }, "Seed error");
    return res.status(500).json({ error: "seed failed", detail: String(err) });
  }
});

// DELETE /api/farms/:farmId/seed — clear all farm data (keeps farm + members)
router.delete("/farms/:farmId/seed", requireAuth, requireFarmAccess, async (req, res) => {
  const farmId = req.params["farmId"]!;
  try {
    await db.delete(financeTransactionsTable).where(eq(financeTransactionsTable.farmId, farmId));
    await db.delete(contactsTable).where(eq(contactsTable.farmId, farmId));
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.farmId, farmId));
    await db.delete(activityLogTable).where(eq(activityLogTable.farmId, farmId));
    await db.delete(employeesTable).where(eq(employeesTable.farmId, farmId));
    // Animals cascade-deletes weight/medical records
    await db.delete(animalsTable).where(eq(animalsTable.farmId, farmId));

    return res.json({ ok: true, message: "Demo data cleared" });
  } catch (err) {
    req.log.error({ err }, "Clear seed error");
    return res.status(500).json({ error: "clear failed" });
  }
});

export default router;
