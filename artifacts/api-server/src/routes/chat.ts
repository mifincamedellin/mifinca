import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `You are Finca Advisor, an expert farm management assistant specializing in Colombian small and mid-size farms. You help farm owners with:
- Animal health, diseases, vaccinations, and treatments
- Weight monitoring and growth tracking
- Breeding and lineage management
- Inventory and feed management
- Pasture and land management
- Farm regulations and best practices in Colombia
- Crop rotation and sustainable farming

You speak the language of the user (Spanish or English). Be concise, practical, and friendly. When discussing animal health, always recommend consulting a licensed veterinarian for serious issues. Provide actionable advice based on local Colombian farming contexts.`;

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

    const chatMessages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (token) {
        fullResponse += token;
        res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
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
