#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push-force

# Seed demo user (idempotent — ON CONFLICT DO NOTHING)
# Password: demo1234 (bcrypt hash)
psql "$DATABASE_URL" -c "
INSERT INTO auth_users (id, email, password_hash)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'demo@fincacolombia.com',
  '\$2b\$10\$I2wmuK1bwbG1JjRWWDlUTO/g9F7Pbg3iAMFfwJ1QlfUxyzvA59vDC'
) ON CONFLICT (id) DO NOTHING;
" || true

# Seed weight records for demo cattle (only if none exist yet)
psql "$DATABASE_URL" -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM weight_records wr
    JOIN animals a ON a.id = wr.animal_id
    WHERE a.farm_id = 'a33817a9-7829-49ca-be0d-6c77a2a52e16' AND a.species = 'cattle'
  ) THEN
    INSERT INTO weight_records (animal_id, weight_kg, recorded_at, notes) VALUES
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09',285,'2025-10-10','Pesaje trimestral'),
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09',301,'2026-01-10','Ganancia estable'),
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09',315,'2026-04-01','Buen estado corporal'),
    ('0396aa2c-7106-45da-80d1-4a976d780040',210,'2025-11-01','Novilla en crecimiento'),
    ('0396aa2c-7106-45da-80d1-4a976d780040',245,'2026-02-01','Progreso favorable'),
    ('0396aa2c-7106-45da-80d1-4a976d780040',268,'2026-04-02','Desarrollo normal para edad'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114',310,'2025-10-15','Toro en desarrollo'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114',348,'2026-01-15','Buen incremento de peso'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114',375,'2026-04-01','Condicion corporal 4/5'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba',455,'2025-09-01','Pesaje rutinario'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba',462,'2025-12-01','Peso estable en lactancia'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba',470,'2026-03-20','Buen estado productivo'),
    ('bde87835-7e69-44eb-8578-9c521a769748',310,'2025-10-20','Pesaje trimestral'),
    ('bde87835-7e69-44eb-8578-9c521a769748',328,'2026-01-20','Ganancia constante'),
    ('bde87835-7e69-44eb-8578-9c521a769748',342,'2026-03-28','Condicion corporal optima'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2',335,'2025-09-15','Pesaje semestral'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2',348,'2026-01-05','Peso adecuado para raza'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2',361,'2026-03-25','Excelente condicion corporal'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376',390,'2025-10-01','Vaca adulta pesaje rutinario'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376',405,'2026-01-01','Incremento normal'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376',418,'2026-03-30','Buen estado general'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479',620,'2025-09-10','Reproductor pesaje semestral'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479',635,'2026-01-10','Condicion optima para monta'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479',648,'2026-03-25','Peso ideal reproduccion'),
    ('2a86ef21-9f6f-4dca-aba3-e7d85f2d5f8c',210,'2026-03-15','Pesaje trimestral'),
    ('2a86ef21-9f6f-4dca-aba3-e7d85f2d5f8c',228,'2026-03-22','Ganancia estable'),
    ('bd282f94-e94a-4220-be4d-706f38a3d761',520,'2026-01-15','Pesaje semestral'),
    ('bd282f94-e94a-4220-be4d-706f38a3d761',535,'2026-03-14','Buen estado corporal'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40',380,'2025-12-15','Pesaje trimestral'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40',392,'2026-01-15','Ganancia constante'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40',405,'2026-03-15','Condicion corporal optima'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40',418,'2026-03-24','Excelente condicion corporal'),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d',290,'2026-01-15','Pesaje trimestral'),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d',308,'2026-03-15','Ganancia estable'),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d',321,'2026-03-19','Buen estado corporal');
  END IF;
END \$\$;
" || true

# Seed medical records for demo cattle (only if none exist yet)
psql "$DATABASE_URL" -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM medical_records mr
    JOIN animals a ON a.id = mr.animal_id
    WHERE a.farm_id = 'a33817a9-7829-49ca-be0d-6c77a2a52e16' AND a.species = 'cattle'
  ) THEN
    INSERT INTO medical_records (animal_id, record_type, title, description, vet_name, cost_cop, record_date, next_due_date) VALUES
    ('2a86ef21-9f6f-4dca-aba3-e7d85f2d5f8c','vaccination','Vacuna Aftosa','Vacunacion obligatoria ICA ciclo II. Aplicada en papada.','Dr. Hernando Rios',18000,'2025-09-15','2026-03-15'),
    ('2a86ef21-9f6f-4dca-aba3-e7d85f2d5f8c','deworming','Desparasitacion interna','Ivermectina 1% dosis 1mL/50kg subcutanea.',NULL,12000,'2026-01-08','2026-07-08'),
    ('2a86ef21-9f6f-4dca-aba3-e7d85f2d5f8c','treatment','Vitaminas AD3E','Aplicacion vitaminas liposolubles via intramuscular.',NULL,25000,'2026-03-22',NULL),
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09','vaccination','Vacuna Aftosa','Vacunacion obligatoria ICA ciclo II.','Dr. Hernando Rios',18000,'2025-09-15','2026-03-15'),
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09','vaccination','Vacuna Carbon Sintomatic','Prevencion Clostridium chauvoei. Zona de alto riesgo.','Dr. Hernando Rios',22000,'2025-10-10','2026-10-10'),
    ('bc9a30c1-803c-4295-aaa7-b7b7eee97a09','deworming','Desparasitacion externa','Bano con cipermetrina 25%. Control garrapatas.',NULL,15000,'2026-02-20','2026-05-20'),
    ('0396aa2c-7106-45da-80d1-4a976d780040','vaccination','Vacuna Aftosa','Primera vacunacion aftosa como novilla.','Dr. Hernando Rios',18000,'2025-10-01','2026-04-01'),
    ('0396aa2c-7106-45da-80d1-4a976d780040','vaccination','Vacuna Brucelosis','Vacuna obligatoria hembras 3-8 meses. Cepa RB51.','Dr. Hernando Rios',35000,'2025-11-15',NULL),
    ('0396aa2c-7106-45da-80d1-4a976d780040','deworming','Desparasitacion interna','Albendazol 10% oral. Control nematodos.',NULL,10000,'2026-01-17','2026-07-17'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114','vaccination','Vacuna Aftosa','Vacunacion obligatoria ICA.','Dr. Hernando Rios',18000,'2025-09-15','2026-03-15'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114','vaccination','Vacuna Carbon Sintomatic','Prevencion Clostridium. Toros jovenes alta susceptibilidad.','Dr. Hernando Rios',22000,'2025-10-15','2026-10-15'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114','deworming','Desparasitacion interna','Ivermectina LA subcutanea.',NULL,28000,'2026-01-15','2026-07-15'),
    ('4abaa0ae-5d62-4410-ac34-1803d9342114','checkup','Evaluacion andrologica','Morfologia espermatica 70% normales. Apto para monta.','Dr. Carlos Mejia',85000,'2026-03-20','2026-09-20'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba','vaccination','Vacuna Aftosa','Vacunacion obligatoria ICA ciclo II.','Dr. Hernando Rios',18000,'2025-09-01','2026-03-01'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba','treatment','Tratamiento Mastitis Subclinica','CMT positivo cuartos anteriores. Tratamiento amoxicilina 3 dias.','Dr. Carlos Mejia',95000,'2025-11-10',NULL),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba','deworming','Desparasitacion interna','Ivermectina 1% post-parto.',NULL,12000,'2026-02-11','2026-08-11'),
    ('0020fe3a-982c-4a89-b637-d61c6b46b5ba','checkup','Revision produccion y salud mamaria','Produccion 18L/dia. CMT negativo todos los cuartos.','Dr. Carlos Mejia',60000,'2026-03-20','2026-06-20'),
    ('bde87835-7e69-44eb-8578-9c521a769748','vaccination','Vacuna Aftosa','Vacunacion ICA ciclo semestral.','Dr. Hernando Rios',18000,'2025-10-01','2026-04-01'),
    ('bde87835-7e69-44eb-8578-9c521a769748','deworming','Desparasitacion interna y externa','Doramectina inyectable.',NULL,32000,'2026-01-20','2026-07-20'),
    ('bde87835-7e69-44eb-8578-9c521a769748','vaccination','Vacuna Carbon Sintomatic','Refuerzo anual. Buenas condiciones inmunitarias.','Dr. Hernando Rios',22000,'2026-03-05','2027-03-05'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2','vaccination','Vacuna Aftosa','Vacunacion ICA ciclo II. Animal en gestacion.','Dr. Hernando Rios',18000,'2025-09-15','2026-03-15'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2','deworming','Desparasitacion externa','Bano garrapaticida cipermetrina.',NULL,15000,'2025-12-01','2026-03-01'),
    ('37e6116d-7623-4d86-8e89-2bad7bfc0ca2','checkup','Revision reproductiva - diagnostico gestacion','Palpacion rectal positiva. Prenez 5 meses. Parto agosto 2026.','Dr. Carlos Mejia',55000,'2026-03-25','2026-06-25'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376','vaccination','Vacuna Aftosa','Vacunacion ICA ciclo II.','Dr. Hernando Rios',18000,'2025-09-01','2026-03-01'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376','deworming','Desparasitacion interna','Levamisol 15% oral. Rotacion de principio activo.',NULL,14000,'2025-12-20','2026-06-20'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376','checkup','Revision reproductiva','IA programada para proximo celo. Vaca apta.','Dr. Carlos Mejia',55000,'2026-02-15','2026-05-15'),
    ('b021d26f-b9b6-4377-8ebc-df6b7d620376','vaccination','Vacuna Rabia Bovina','Refuerzo anual ICA zona endemica.','Dr. Hernando Rios',20000,'2026-03-30','2027-03-30'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479','vaccination','Vacuna Aftosa','Toro reproductor certificado.','Dr. Hernando Rios',18000,'2025-09-10','2026-03-10'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479','checkup','Revision sanitaria anual','Estado general excelente. Sin lesiones articulares.','Dr. Carlos Mejia',80000,'2025-11-20','2026-11-20'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479','deworming','Desparasitacion interna','Ivermectina 1% subcutanea.',NULL,28000,'2026-01-10','2026-07-10'),
    ('bc079cdf-f07e-4d55-9d58-0ad96d7bb479','checkup','Evaluacion andrologica anual','Morfologia 78% normales. Relacion monta 1:25. Apto.','Dr. Carlos Mejia',95000,'2026-03-25','2027-03-25'),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d','vaccination','Vacuna Brucelosis','Vacunacion obligatoria ICA ciclo II.','Dr. Hernando Rios',18000,'2025-12-15',NULL),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d','checkup','Revision prenatal','Gestacion confirmada. Estado fetal normal.','Dr. Carlos Mejia',55000,'2026-03-15',NULL),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d','deworming','Desparasitacion interna','Ivermectina 1% post-parto. Carga controlada.',NULL,12000,'2026-01-20','2026-07-20'),
    ('ff8a4b1f-f4a5-4d0c-9a43-1654f61d403d','vaccination','Vacuna Carbon Sintomatic','Refuerzo anual. Animal gestante.','Dr. Hernando Rios',22000,'2026-02-10','2027-02-10'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40','vaccination','Vacuna Aftosa','Vacunacion ICA.','Dr. Hernando Rios',18000,'2026-01-15','2026-07-15'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40','deworming','Desparasitacion externa','Baño garrapaticida. Resultado conteo fecal bajo.',NULL,15000,'2026-03-15',NULL),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40','deworming','Desparasitacion interna','Ivermectina 1%. Buen control.',NULL,12000,'2026-01-20','2026-07-20'),
    ('9a0b251f-f68b-4cd8-b2f9-026a2cbc8c40','checkup','Revision reproductiva','Prenez positiva ~3 meses. Parto junio 2026.','Dr. Carlos Mejia',55000,'2026-03-24','2026-05-24'),
    ('bd282f94-e94a-4220-be4d-706f38a3d761','vaccination','Vacuna Rabia Bovina','Vacunacion ICA zona de riesgo.','Dr. Hernando Rios',20000,'2025-11-15',NULL),
    ('bd282f94-e94a-4220-be4d-706f38a3d761','vaccination','Vacuna Aftosa','Vacunacion ICA ciclo I.','Dr. Hernando Rios',18000,'2026-03-14','2026-09-14'),
    ('bd282f94-e94a-4220-be4d-706f38a3d761','deworming','Desparasitacion interna','Ivermectina LA subcutanea. Alta exposicion parasitaria.',NULL,28000,'2026-01-20','2026-07-20'),
    ('bd282f94-e94a-4220-be4d-706f38a3d761','checkup','Evaluacion andrologica','Morfologia 82% normales. Condicion corporal 5/5. Apto.','Dr. Carlos Mejia',95000,'2026-03-14','2026-09-14');
  END IF;
END \$\$;
" || true
