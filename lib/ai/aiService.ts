import { BRAND } from "@/constants/brand";
import { Conversation, UserProfile } from "@/types";

export interface AiProviderConfig {
  providerName: string;
  isConfigured: boolean;
  modelName?: string;
  statusMessage: string;
}

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface AiCompletionResult {
  success: boolean;
  text?: string;
  error?: string;
  isReady: boolean;
}

/**
 * Built-in Veyra AI Identity
 */
export const VEYRA_AI_PROFILE: UserProfile = {
  uid: "veyra_ai_system_companion",
  displayName: "Veyra AI",
  username: "veyra_ai",
  avatarUrl: "/assets/veyra_ai_logo.png",
  bio: "Your friendly AI companion on Veyra — ask questions, brainstorm ideas, learn something new, or just have a chat.",
  email: "ai@veyra.app",
  createdAt: 1727200000000,
  updatedAt: 1727200000000,
  emailVerified: true,
  twoFactorEnabled: false,
  authProviders: [],
};

export const VEYRA_AI_CONVERSATION_ID = "conv_veyra_ai_companion";

/**
 * Returns deterministic AI conversation ID scoped per user so chat histories stay private
 */
export function getVeyraAiConversationId(userId: string): string {
  return `ai_${userId}`;
}

export function getVeyraAiConversation(currentUserUid: string): Conversation {
  return {
    id: getVeyraAiConversationId(currentUserUid),
    type: "ai",
    participantIds: [currentUserUid, VEYRA_AI_PROFILE.uid],
    participants: {
      [currentUserUid]: {
        uid: currentUserUid,
        displayName: "You",
        username: "you",
        avatarUrl: "",
      },
      [VEYRA_AI_PROFILE.uid]: {
        uid: VEYRA_AI_PROFILE.uid,
        displayName: VEYRA_AI_PROFILE.displayName,
        username: VEYRA_AI_PROFILE.username,
        avatarUrl: VEYRA_AI_PROFILE.avatarUrl,
      },
    },
    createdAt: 1727200000000,
    updatedAt: Date.now(),
  };
}

/**
 * Clean Service Abstraction for Veyra AI
 * Checked dynamically before attempting generation
 */
export function getAiProviderStatus(): AiProviderConfig {
  return {
    providerName: "OpenRouter (GPT-OSS)",
    isConfigured: true,
    modelName: "openai/gpt-oss-20b",
    statusMessage: "Veyra AI is online and ready.",
  };
}

/**
 * Service Abstraction for sending prompt to Veyra AI
 * Communicates via server-side /api/ai/chat route to protect credentials.
 */
export async function sendPromptToVeyraAi(
  prompt: string,
  history: AiChatMessage[] = []
): Promise<AiCompletionResult> {
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        history: history.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        isReady: false,
        error: data.error || "Failed to receive a response from Veyra AI.",
      };
    }

    return {
      success: true,
      isReady: true,
      text: data.text,
    };
  } catch (err: unknown) {
    console.error("sendPromptToVeyraAi client error:", err);
    const msg = err instanceof Error ? err.message : "Network error communicating with Veyra AI.";
    return {
      success: false,
      isReady: false,
      error: msg,
    };
  }
}

/**
 * Sample prompt suggestions for Veyra AI interface
 */
export const VEYRA_AI_SUGGESTIONS = [
  {
    icon: "lightbulb",
    title: "Brainstorm ideas",
    prompt: "Brainstorm 5 innovative ideas for a community project.",
  },
  {
    icon: "edit_note",
    title: "Draft an email",
    prompt: "Draft a polite and concise follow-up email after a meeting.",
  },
  {
    icon: "translate",
    title: "Language & translations",
    prompt: "Help me practice conversational Hindi phrases for everyday greetings.",
  },
  {
    icon: "psychology",
    title: "Learn something new",
    prompt: "Explain how space telescopes capture distant galaxies in simple terms.",
  },
];
