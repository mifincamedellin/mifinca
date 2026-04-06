import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import {
  conversations, messages,
  animalsTable, inventoryItemsTable, financeTransactionsTable, employeesTable,
} from "@workspace/db";
import { eq, and, gte, sql, count, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const DAILY_MSG_LIMIT = 20;

const BASE_SYSTEM_PROMPT = `You are Finca Advisor, a practical farm management assistant for Colombian small and mid-size farms. You help with animal health, vaccinations, feed, inventory, pasture, finances, and local farming practices. You have access to live web search — use it when the user asks about current prices, recent regulations, news, or anything that benefits from fresh information.

FORMATTING RULES:
- Use markdown to structure responses: ## for section headers, **bold** for key terms or important values, bullet lists (- item) for steps or options.
- Keep responses concise. For simple questions, 2-4 sentences with no headers needed. For multi-part topics, use 2-3 short sections with headers.
- Never open with "Of course!", "Certainly!", "Great question!", or filler. Start directly with the answer or first header.
- LANGUAGE RULE (non-negotiable): Always respond in the exact same language the user wrote in. If they write in Spanish, respond in Spanish. If they write in English, respond in English. Never switch languages unless the user explicitly asks you to. Do not mix languages in a single response.
- For serious animal health issues, recommend a licensed vet clearly.
- Be warm but direct. Prioritize practical, actionable advice for rural Colombian context.
- If you used web search, add a brief source note at the end (e.g. *Fuente: ICA, 2025* or *Source: ICA, 2025*).
- When farm data is provided below, use it to give personalized, specific answers. Reference actual animal names, real inventory numbers, and exact financial figures when relevant.`;

async function buildFarmContext(farmId: string): Promise<string> {
  try {
    // Animals by species
    const animalCounts = await db
      .select({ species: animalsTable.species, total: count() })
      .from(animalsTable)
      .where(and(eq(animalsTable.farmId, farmId), eq(animalsTable.status, "active")))
      .groupBy(animalsTable.species);

    // Top 6 individual animals (most recently added)
    const topAnimals = await db
      .select({
        name: animalsTable.name,
        tag: animalsTable.customTag,
        breed: animalsTable.breed,
        species: animalsTable.species,
        sex: animalsTable.sex,
      })
      .from(animalsTable)
      .where(and(eq(animalsTable.farmId, farmId), eq(animalsTable.status, "active")))
      .orderBy(animalsTable.createdAt)
      .limit(6);

    // Inventory — all items, flag low stock
    const inventory = await db
      .select({
        name: inventoryItemsTable.name,
        quantity: inventoryItemsTable.quantity,
        unit: inventoryItemsTable.unit,
        threshold: inventoryItemsTable.lowStockThreshold,
        category: inventoryItemsTable.category,
      })
      .from(inventoryItemsTable)
      .where(eq(inventoryItemsTable.farmId, farmId));

    const lowStock = inventory.filter(
      (i) => i.threshold && parseFloat(i.quantity) <= parseFloat(i.threshold)
    );

    // Finances — last 90 days summary
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split("T")[0]!;

    const financeSummary = await db
      .select({
        type: financeTransactionsTable.type,
        total: sql<string>`SUM(${financeTransactionsTable.amount})`,
      })
      .from(financeTransactionsTable)
      .where(
        and(
          eq(financeTransactionsTable.farmId, farmId),
          gte(financeTransactionsTable.date, dateStr)
        )
      )
      .groupBy(financeTransactionsTable.type);

    // This month finances
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const monthStr = thisMonth.toISOString().split("T")[0]!;

    const monthFinance = await db
      .select({
        type: financeTransactionsTable.type,
        total: sql<string>`SUM(${financeTransactionsTable.amount})`,
      })
      .from(financeTransactionsTable)
      .where(
        and(
          eq(financeTransactionsTable.farmId, farmId),
          gte(financeTransactionsTable.date, monthStr)
        )
      )
      .groupBy(financeTransactionsTable.type);

    // Employees
    const [empRow] = await db
      .select({ total: count(), payroll: sql<string>`SUM(${employeesTable.monthlySalary})` })
      .from(employeesTable)
      .where(eq(employeesTable.farmId, farmId));

    // Format helpers
    const fmtCOP = (n: number) =>
      `$${Math.round(n).toLocaleString("es-CO")} COP`;

    const getTotal = (rows: { type: string; total: string }[], type: string) =>
      parseFloat(rows.find((r) => r.type === type)?.total ?? "0");

    const income90  = getTotal(financeSummary, "income");
    const expense90 = getTotal(financeSummary, "expense");
    const net90     = income90 - expense90;

    const incomeM  = getTotal(monthFinance, "income");
    const expenseM = getTotal(monthFinance, "expense");
    const netM     = incomeM - expenseM;

    const totalAnimals = animalCounts.reduce((s, r) => s + Number(r.total), 0);
    const animalBreakdown = animalCounts
      .map((r) => `${r.total} ${r.species}`)
      .join(", ") || "none";

    const lowStockText =
      lowStock.length > 0
        ? lowStock
            .map((i) => `${i.name} (${i.quantity} ${i.unit}, low — threshold ${i.threshold})`)
            .join("; ")
        : "all items well stocked";

    const sampleAnimals =
      topAnimals
        .map((a) => `${a.name} (${a.tag}, ${a.breed} ${a.sex})`)
        .join(", ") || "none";

    return `
---
## FARM DATA (use this for personalized answers)
**Animals:** ${totalAnimals} active — ${animalBreakdown}
**Sample animals:** ${sampleAnimals}
**Low stock:** ${lowStockText}
**Finances this month:** Income ${fmtCOP(incomeM)} | Expenses ${fmtCOP(expenseM)} | Net ${netM >= 0 ? "+" : ""}${fmtCOP(netM)}
**Finances last 90 days:** Income ${fmtCOP(income90)} | Expenses ${fmtCOP(expense90)} | Net ${net90 >= 0 ? "+" : ""}${fmtCOP(net90)}
**Staff:** ${empRow?.total ?? 0} employees | Monthly payroll ${fmtCOP(parseFloat(empRow?.payroll ?? "0"))}
---`;
  } catch {
    return "";
  }
}

async function countTodayMessages(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const userConvos = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.userId, userId));

  if (userConvos.length === 0) return 0;

  const convIds = userConvos.map((c) => c.id);
  const [row] = await db
    .select({ total: count() })
    .from(messages)
    .where(
      and(
        inArray(messages.conversationId, convIds),
        eq(messages.role, "user"),
        gte(messages.createdAt, today)
      )
    );
  return Number(row?.total ?? 0);
}

// POST /api/chat/conversations
router.post("/chat/conversations", requireAuth, async (req, res) => {
  try {
    const { title = "Nueva consulta", farmId } = req.body;
    const [convo] = await db
      .insert(conversations)
      .values({ title, userId: req.userId!, farmId: farmId ?? null })
      .returning();
    return res.json(convo);
  } catch (err) {
    req.log.error({ err }, "Create conversation error");
    return res.status(500).json({ error: "internal" });
  }
});

// POST /api/chat/conversations/:id/messages
router.post("/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Verify conversation belongs to this user
    const [convo] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));

    if (!convo) {
      return res.status(403).json({ error: "forbidden" });
    }

    // Daily rate limit check
    const todayCount = await countTodayMessages(req.userId!);
    if (todayCount >= DAILY_MSG_LIMIT) {
      return res.status(429).json({
        error: "daily_limit_reached",
        limit: DAILY_MSG_LIMIT,
        used: todayCount,
      });
    }

    // Save user message
    await db.insert(messages).values({ conversationId: id, role: "user", content });

    // Load conversation history (last 20)
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt)
      .limit(20);

    const inputMessages = history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Build farm context if farmId is known
    const farmContext = convo.farmId ? await buildFarmContext(convo.farmId) : "";
    const systemPrompt = BASE_SYSTEM_PROMPT + farmContext;

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Send remaining messages count
    const remaining = DAILY_MSG_LIMIT - todayCount - 1;
    res.write(`data: ${JSON.stringify({ remaining, limit: DAILY_MSG_LIMIT })}\n\n`);

    let fullResponse = "";

    const stream = await openai.responses.create({
      model: "gpt-5.2",
      instructions: systemPrompt,
      input: inputMessages,
      tools: [{ type: "web_search_preview" }],
      stream: true,
    } as any);

    for await (const event of stream as any) {
      if (event.type === "response.output_text.delta") {
        const token = event.delta as string;
        if (token) {
          fullResponse += token;
          res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
        }
      }
    }

    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Chat message error");
    if (!res.headersSent) {
      return res.status(500).json({ error: "internal" });
    }
    res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
    res.end();
  }
});

// GET /api/chat/conversations/:id/messages
router.get("/chat/conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [convo] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId!)));

    if (!convo) return res.status(403).json({ error: "forbidden" });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    return res.json(history);
  } catch (err) {
    req.log.error({ err }, "Get messages error");
    return res.status(500).json({ error: "internal" });
  }
});

// GET /api/chat/usage — today's message count for the current user
router.get("/chat/usage", requireAuth, async (req, res) => {
  try {
    const used = await countTodayMessages(req.userId!);
    return res.json({ used, limit: DAILY_MSG_LIMIT, remaining: Math.max(0, DAILY_MSG_LIMIT - used) });
  } catch (err) {
    req.log.error({ err }, "Chat usage error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
