import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `You are Finca Advisor, a practical farm management assistant for Colombian small and mid-size farms. You help with animal health, vaccinations, feed, inventory, pasture, finances, and local farming practices. You have access to live web search — use it when the user asks about current prices, recent regulations, news, or anything that benefits from fresh information.

FORMATTING RULES:
- Use markdown to structure responses: ## for section headers, **bold** for key terms or important values, bullet lists (- item) for steps or options.
- Keep responses concise. For simple questions, 2-4 sentences with no headers needed. For multi-part topics, use 2-3 short sections with headers.
- Never open with "Of course!", "Certainly!", "Great question!", or filler. Start directly with the answer or first header.
- Match the user's language (Spanish or English) exactly.
- For serious animal health issues, recommend a licensed vet clearly.
- Be warm but direct. Prioritize practical, actionable advice for rural Colombian context.
- If you used web search, add a brief source note at the end (e.g. *Fuente: ICA, 2025* or *Source: ICA, 2025*).`;


// Create a new conversation
router.post("/chat/conversations", async (req, res) => {
  try {
    const { title = "Nueva consulta" } = req.body;
    const [convo] = await db.insert(conversations).values({ title }).returning();
    return res.json(convo);
  } catch (err) {
    req.log.error({ err }, "Create conversation error");
    return res.status(500).json({ error: "internal" });
  }
});

// Send a message and stream the AI response
router.post("/chat/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: "Message content is required" });
    }

    // Save user message
    await db.insert(messages).values({ conversationId: id, role: "user", content });

    // Load history for context (last 20 messages)
    const history = await db.select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt)
      .limit(20);

    const inputMessages = history.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.responses.create({
      model: "gpt-5.2",
      instructions: SYSTEM_PROMPT,
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

    // Save assistant response
    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });

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

// Get conversation history
router.get("/chat/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const history = await db.select().from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    return res.json(history);
  } catch (err) {
    req.log.error({ err }, "Get messages error");
    return res.status(500).json({ error: "internal" });
  }
});

export default router;
