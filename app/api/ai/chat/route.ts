import { NextRequest, NextResponse } from "next/server";

// Rate limiting map: IP -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return true;
}

const SYSTEM_PROMPT = `You are Veyra AI, the friendly, intelligent, and helpful built-in companion on Veyra — a modern, privacy-focused messaging application whose motto is "Har Baat, Apno Ke Saath."

Your personality and guidelines:
- You are warm, polite, articulate, and naturally conversational.
- You speak English fluently, and you can also understand and naturally converse in Hindi and Hinglish when the user writes in it.
- Keep your answers comfortable for a chat interface: clear, helpful, and concise without dumping overwhelming blocks of text, unless the user asks for deep detail.
- Format responses cleanly with light markdown (such as bolding, lists, code snippets, or emojis) when helpful.
- Help users brainstorm ideas, draft messages, solve problems, answer questions, and learn new things.`;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many AI requests. Please slow down and try again shortly." },
        { status: 429 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Veyra AI is not configured. Please set OPENROUTER_API_KEY." },
        { status: 503 }
      );
    }

    const body = await req.json();
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const history = Array.isArray(body.history) ? body.history : [];

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    // Limit history length to last 12 messages for performance and context
    const recentHistory = history
      .slice(-12)
      .map((msg: { role: string; content: string }) => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: String(msg.content).slice(0, 2000),
      }));

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...recentHistory,
      { role: "user", content: prompt.slice(0, 3000) },
    ];

    const primaryModel = process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b";
    const modelsToTry = [primaryModel, "openai/gpt-oss-120b", "openrouter/free"];

    let lastError: any = null;
    let completionText: string | null = null;
    let modelUsed: string = primaryModel;

    for (const model of modelsToTry) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://veyra.app",
            "X-Title": "Veyra AI Companion",
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.choices?.[0]?.message?.content;
          if (text) {
            completionText = text.trim();
            modelUsed = model;
            break;
          }
        } else {
          const errData = await response.json().catch(() => ({}));
          lastError = errData;
          console.warn(`Model ${model} returned status ${response.status}:`, errData);
        }
      } catch (callErr) {
        lastError = callErr;
        console.warn(`Model ${model} request error:`, callErr);
      }
    }

    if (!completionText) {
      console.error("OpenRouter all model attempts failed. Last error:", lastError);
      return NextResponse.json(
        {
          error: "Veyra AI is temporarily unavailable. Please try again in a moment.",
          details: lastError?.error?.message || lastError?.message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      text: completionText,
      model: modelUsed,
    });
  } catch (err: any) {
    console.error("Veyra AI chat route uncaught exception:", err);
    return NextResponse.json(
      { error: err.message || "An unexpected error occurred while communicating with Veyra AI." },
      { status: 500 }
    );
  }
}
