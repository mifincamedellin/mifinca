import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, Loader2, Sprout, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const LS_KEY = "finca_advisor_conv_id";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-2 h-2 rounded-full bg-secondary/60"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function FarmAdvisor() {
  const { i18n } = useTranslation();
  const isEn = i18n.language === "en";

  const [open, setOpen]                 = useState(false);
  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loading, setLoading]           = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  const autoResize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  const greeting: Message = {
    role: "assistant",
    content: isEn
      ? "Hello! I'm your Finca Advisor. Ask me anything about your animals, pasture, inventory, or finances."
      : "¡Hola! Soy tu Asesor Finca. Pregúntame sobre tus animales, potreros, inventario o finanzas.",
  };

  const loadHistory = useCallback(async (cid: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${cid}/messages`);
      if (!res.ok) throw new Error("failed");
      const rows: Array<{ role: string; content: string }> = await res.json();
      if (rows.length === 0) {
        setMessages([greeting]);
      } else {
        setMessages(rows.map(r => ({ role: r.role as "user" | "assistant", content: r.content })));
      }
    } catch {
      setMessages([greeting]);
    } finally {
      setHistoryLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const cid = parseInt(saved, 10);
      if (!isNaN(cid)) {
        setConversationId(cid);
        loadHistory(cid);
        return;
      }
    }
    setMessages([greeting]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const getOrCreateConversation = async (): Promise<number> => {
    if (conversationId) return conversationId;
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: isEn ? "Farm Consultation" : "Consulta de Finca" }),
    });
    const data = await res.json();
    setConversationId(data.id);
    localStorage.setItem(LS_KEY, String(data.id));
    return data.id;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setLoading(true);

    const streamingMsg: Message = { role: "assistant", content: "", streaming: true };
    setMessages(prev => [...prev, streamingMsg]);

    try {
      const cid = await getOrCreateConversation();
      const res = await fetch(`/api/chat/conversations/${cid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!res.body) throw new Error("No stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, content: last.content + data.content };
                }
                return next;
              });
            }
            if (data.done) {
              setMessages(prev => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.streaming) {
                  next[next.length - 1] = { ...last, streaming: false };
                }
                return next;
              });
            }
          } catch {}
        }
      }
    } catch {
      setMessages(prev => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.streaming) {
          next[next.length - 1] = {
            role: "assistant",
            content: isEn ? "Sorry, something went wrong. Please try again." : "Lo siento, algo salió mal. Por favor intenta de nuevo.",
            streaming: false,
          };
        }
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([greeting]);
    setConversationId(null);
    localStorage.removeItem(LS_KEY);
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center bg-secondary hover:bg-secondary/90 transition-colors ${open ? "hidden" : ""}`}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        title={isEn ? "Farm Advisor" : "Asesor Finca"}
      >
        <Sprout className="h-7 w-7 text-white" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-accent rounded-full border-2 border-white" />
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] flex flex-col rounded-2xl shadow-2xl overflow-hidden border border-border/30 bg-card"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-secondary text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sprout className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm leading-tight">
                    {isEn ? "Farm Advisor" : "Asesor Finca"}
                  </p>
                  <p className="text-white/70 text-xs">
                    {isEn ? "AI-powered farm assistant" : "Asistente agrícola con IA"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={reset}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  title={isEn ? "New chat" : "Nueva conversación"}
                >
                  <RotateCcw className="h-4 w-4 text-white/80" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  <X className="h-4 w-4 text-white/80" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-sand/30">
              {historyLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center shrink-0 mt-1 mr-2">
                        <Sprout className="h-3.5 w-3.5 text-secondary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border border-border/40 text-foreground rounded-bl-sm shadow-sm"
                      }`}
                    >
                      {msg.streaming && msg.content === "" ? (
                        <TypingDots />
                      ) : msg.role === "assistant" ? (
                        <div className="prose-chat">
                          <ReactMarkdown
                            components={{
                              h1: ({ children }) => <p className="font-bold text-base mb-1 mt-2 first:mt-0">{children}</p>,
                              h2: ({ children }) => <p className="font-bold text-sm mb-1 mt-2 first:mt-0 text-secondary">{children}</p>,
                              h3: ({ children }) => <p className="font-semibold text-sm mb-0.5 mt-1.5 first:mt-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                              ul: ({ children }) => <ul className="mt-1 mb-1.5 space-y-0.5 pl-4 list-disc">{children}</ul>,
                              ol: ({ children }) => <ol className="mt-1 mb-1.5 space-y-0.5 pl-4 list-decimal">{children}</ol>,
                              li: ({ children }) => <li className="leading-snug">{children}</li>,
                              code: ({ children }) => <code className="bg-muted/60 px-1 py-0.5 rounded text-xs font-mono">{children}</code>,
                              hr: () => <hr className="my-2 border-border/30" />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                          {msg.streaming && msg.content !== "" && (
                            <span className="inline-block w-0.5 h-4 bg-secondary/70 ml-0.5 animate-pulse align-middle" />
                          )}
                        </div>
                      ) : (
                        <span style={{ whiteSpace: "pre-wrap" }}>{msg.content}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-border/30 bg-card shrink-0">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={1}
                  onChange={e => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={isEn ? "Ask about your farm..." : "Pregunta sobre tu finca..."}
                  disabled={loading || historyLoading}
                  className="flex-1 resize-none rounded-xl border border-border/40 bg-background text-sm px-3 py-2.5 leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:opacity-50 min-h-[40px] overflow-hidden"
                  style={{ height: "40px" }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={sendMessage}
                  disabled={!input.trim() || loading || historyLoading}
                  className="h-10 w-10 rounded-xl bg-secondary hover:bg-secondary/90 shrink-0 mb-0"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 pl-1">
                {isEn ? "Enter to send · Shift+Enter for new line" : "Enter para enviar · Shift+Enter para nueva línea"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
