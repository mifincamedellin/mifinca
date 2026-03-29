import { Router } from "express";
import { db } from "@workspace/db";
import {
  animalsTable, weightRecordsTable, medicalRecordsTable,
  inventoryItemsTable, financeTransactionsTable,
  contactsTable, activityLogTable, farmMembersTable,
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
    // ── ANIMALS ──────────────────────────────────────────────────────────────
    const animalRows = await db.insert(animalsTable).values([
      { farmId, customTag: "BOV-001", species: "cattle", breed: "Brahman", name: "Reina", sex: "female", dateOfBirth: "2020-03-12", status: "active", notes: "Buena productora de leche", photoUrl: "/animals/reina-brahman.png" },
      { farmId, customTag: "BOV-002", species: "cattle", breed: "Simmental", name: "Luna", sex: "female", dateOfBirth: "2021-07-05", status: "active", photoUrl: "/animals/luna-simmental.png" },
      { farmId, customTag: "BOV-003", species: "cattle", breed: "Brahman", name: "Toro Negro", sex: "male", dateOfBirth: "2019-11-20", status: "active", notes: "Semental principal", photoUrl: "/animals/toro-negro.png" },
      { farmId, customTag: "BOV-004", species: "cattle", breed: "Cebú", name: "Manchas", sex: "female", dateOfBirth: "2022-01-08", status: "active", photoUrl: "/animals/manchas-cebu.png" },
      { farmId, customTag: "CER-001", species: "pig", breed: "Landrace", name: "Gordita", sex: "female", dateOfBirth: "2023-02-14", status: "active", photoUrl: "/animals/gordita-landrace.png" },
      { farmId, customTag: "CER-002", species: "pig", breed: "Duroc", sex: "male", dateOfBirth: "2023-03-22", status: "active", photoUrl: "/animals/duroc-pig.png" },
      { farmId, customTag: "CAB-001", species: "horse", breed: "Criollo Colombiano", name: "Rayo", sex: "male", dateOfBirth: "2018-05-30", status: "active", notes: "Caballo de trabajo", photoUrl: "/animals/rayo-horse.png" },
      { farmId, customTag: "CAP-001", species: "goat", breed: "Nubian", name: "Bella", sex: "female", dateOfBirth: "2022-09-10", status: "active", photoUrl: "/animals/bella-nubian-goat.png" },
    ]).returning();

    const [reina, luna, toroNegro, manchas, gordita, cerDuroc, rayo, bella] = animalRows as typeof animalRows;

    // ── WEIGHT RECORDS ───────────────────────────────────────────────────────
    if (reina && luna && toroNegro && manchas && gordita && rayo && bella) {
      await db.insert(weightRecordsTable).values([
        { animalId: reina.id, weightKg: "380", recordedAt: monthsAgo(3) },
        { animalId: reina.id, weightKg: "392", recordedAt: monthsAgo(2) },
        { animalId: reina.id, weightKg: "405", recordedAt: monthsAgo(1) },
        { animalId: reina.id, weightKg: "418", recordedAt: daysAgo(5) },
        { animalId: luna.id, weightKg: "290", recordedAt: monthsAgo(2) },
        { animalId: luna.id, weightKg: "308", recordedAt: monthsAgo(1) },
        { animalId: luna.id, weightKg: "321", recordedAt: daysAgo(10) },
        { animalId: toroNegro.id, weightKg: "520", recordedAt: monthsAgo(2) },
        { animalId: toroNegro.id, weightKg: "535", recordedAt: daysAgo(15) },
        { animalId: manchas.id, weightKg: "210", recordedAt: monthsAgo(1) },
        { animalId: manchas.id, weightKg: "228", recordedAt: daysAgo(7) },
        { animalId: gordita.id, weightKg: "85", recordedAt: monthsAgo(1) },
        { animalId: gordita.id, weightKg: "97", recordedAt: daysAgo(12) },
        { animalId: rayo.id, weightKg: "430", recordedAt: monthsAgo(1) },
        { animalId: bella.id, weightKg: "52", recordedAt: daysAgo(8) },
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

    // ── FINANCES ─────────────────────────────────────────────────────────────
    await db.insert(financeTransactionsTable).values([
      { farmId, type: "income", category: "venta_leche", amount: "1850000", description: "Venta leche quincenal — 370 litros", date: daysAgo(5), notes: "Cooperativa Lácteos del Río" },
      { farmId, type: "income", category: "venta_leche", amount: "1920000", description: "Venta leche quincenal — 384 litros", date: monthsAgo(1, 15) },
      { farmId, type: "income", category: "venta_animales", amount: "3800000", description: "Venta 2 cerdos en pie", date: monthsAgo(1, 8), notes: "Frigorífico El Palmar" },
      { farmId, type: "income", category: "venta_leche", amount: "1780000", description: "Venta leche quincenal — 356 litros", date: monthsAgo(2, 15) },
      { farmId, type: "income", category: "venta_cosecha", amount: "2400000", description: "Venta maíz cosecha", date: monthsAgo(2, 5), notes: "450 kg al mercado local" },
      { farmId, type: "income", category: "subsidio", amount: "1200000", description: "Subsidio FEDEGAN apoyo ganadero", date: monthsAgo(3, 20) },
      { farmId, type: "income", category: "venta_leche", amount: "1650000", description: "Venta leche quincenal — 330 litros", date: monthsAgo(3, 1) },
      { farmId, type: "expense", category: "alimentacion", amount: "1140000", description: "Concentrado bovino — 12 bultos", date: daysAgo(8), notes: "AgroSantos S.A.S" },
      { farmId, type: "expense", category: "medicamentos", amount: "166000", description: "Ivermectina y Oxitetraciclina", date: monthsAgo(1, 12), notes: "VetFarma Colombia" },
      { farmId, type: "expense", category: "servicios", amount: "185000", description: "Visita veterinario — 4 animales", date: monthsAgo(1, 20), notes: "Dr. Carlos Medina" },
      { farmId, type: "expense", category: "mano_obra", amount: "900000", description: "Jornalero mensual", date: monthsAgo(1, 28) },
      { farmId, type: "expense", category: "mano_obra", amount: "900000", description: "Jornalero mensual", date: monthsAgo(2, 28) },
      { farmId, type: "expense", category: "alimentacion", amount: "1080000", description: "Sal mineralizada y concentrado", date: monthsAgo(2, 10) },
      { farmId, type: "expense", category: "transporte", amount: "320000", description: "Flete ganado — Municipio La Mesa", date: monthsAgo(2, 20) },
      { farmId, type: "expense", category: "insumos", amount: "84000", description: "Aretes y jeringas", date: monthsAgo(3, 10) },
      { farmId, type: "expense", category: "mano_obra", amount: "900000", description: "Jornalero mensual", date: monthsAgo(3, 28) },
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
    // Animals cascade-deletes weight/medical records
    await db.delete(animalsTable).where(eq(animalsTable.farmId, farmId));

    return res.json({ ok: true, message: "Demo data cleared" });
  } catch (err) {
    req.log.error({ err }, "Clear seed error");
    return res.status(500).json({ error: "clear failed" });
  }
});

export default router;
