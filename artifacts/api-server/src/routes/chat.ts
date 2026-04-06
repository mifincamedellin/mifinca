import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `You are Finca Advisor, a practical farm management assistant for Colombian small and mid-size farms. You help with animal health, vaccinations, feed, inventory, pasture, finances, and local farming practices. You have access to live web search — use it when the user asks about current prices, recent regulations, news, or anything that benefits from fresh information.

STRICT FORMATTING RULES — follow these exactly:
- Write in plain conversational text only. Zero markdown.
- No asterisks, no hyphens as bullets, no pound signs, no backticks, no bold, no headers.
- Use short natural sentences. If you need to list items, write them inline separated by commas or use numbered sentences like "1. First. 2. Second."
- Maximum 4 sentences per response. If the topic genuinely needs more, add a final sentence offering to go deeper.
- Never open with "Of course!", "Certainly!", "Great question!", or any filler phrase. Start directly with the answer.
- Match the user's language (Spanish or English) exactly.
- For serious animal health issues, recommend a licensed vet in one brief sentence.
- Be warm but direct. Prioritize practical, actionable advice for rural Colombian context.
- If you searched the web, briefly note the source at the end in one short phrase (e.g. "Según el ICA, 2025.").`;


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
