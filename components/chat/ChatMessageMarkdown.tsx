import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { Icon } from "@/components/ui/Icon";

export type EntityType = "url" | "email" | "phone";

export interface DetectedEntity {
  type: EntityType;
  raw: string;
  actionValue: string;
  displayValue: string;
}

/**
 * Robust cross-platform clipboard copy helper with mobile HTTP/HTTPS fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern asynchronous Clipboard API (available on HTTPS or localhost)
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // Fall through to mobile legacy textarea fallback
    }
  }

  // 2. Mobile fallback using document.execCommand('copy') via temporary textarea
  // This is required on mobile browsers over local network (HTTP)
  if (typeof document !== "undefined") {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.top = "0";
      textarea.style.left = "0";
      textarea.style.width = "2em";
      textarea.style.height = "2em";
      textarea.style.padding = "0";
      textarea.style.border = "none";
      textarea.style.outline = "none";
      textarea.style.boxShadow = "none";
      textarea.style.background = "transparent";
      textarea.style.fontSize = "16px"; // Prevents iOS browser auto-zoom
      textarea.setAttribute("readonly", "");
      document.body.appendChild(textarea);

      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) return true;
    } catch (err) {
      console.warn("Fallback copy failed:", err);
    }
  }

  return false;
}

// Master regex matching URL, Email, or 10-digit Phone numbers
const ENTITY_REGEX =
  /((?:https?:\/\/[^\s<>"'{}|\\^`]+|www\.[^\s<>"'{}|\\^`]+|\b[a-zA-Z0-9-]+\.(?:com|org|net|edu|gov|io|app|in|co|me|ai|dev|xyz|info|tech|biz|online|site|store|live)\b(?:\/[^\s<>"'{}|\\^`]*)?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b|\b\d{10}\b))/gi;

export function classifyEntity(text: string): DetectedEntity | null {
  if (!text) return null;
  const trimmed = text.trim().replace(/[.,;!?:]+$/, "");

  // Email check
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) {
    return {
      type: "email",
      raw: trimmed,
      actionValue: trimmed,
      displayValue: trimmed,
    };
  }

  // URL check
  if (
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /^[a-zA-Z0-9-]+\.(?:com|org|net|edu|gov|io|app|in|co|me|ai|dev|xyz|info|tech|biz|online|site|store|live)\b/i.test(trimmed)
  ) {
    let url = trimmed;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return {
      type: "url",
      raw: trimmed,
      actionValue: url,
      displayValue: trimmed,
    };
  }

  // Phone number check (10 digits, optional country code)
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10 || (digits.length >= 11 && digits.length <= 13 && trimmed.startsWith("+"))) {
    const cleanTel = trimmed.startsWith("+") ? `+${digits}` : digits;
    return {
      type: "phone",
      raw: trimmed,
      actionValue: cleanTel,
      displayValue: trimmed,
    };
  }

  return null;
}

/**
 * Returns light-mode and dark-mode compatible classnames for entity links inside bubbles
 */
export function getEntityLinkClasses(isMe: boolean): string {
  if (isMe) {
    // Outgoing bubble: light-mode is #d9fdd3 (pale green) -> deep teal-900; dark-mode is #0e4e5e -> bright teal-200
    return "inline cursor-pointer underline underline-offset-2 decoration-1 transition-colors font-semibold break-all select-text text-teal-900 hover:text-teal-950 decoration-teal-800/70 dark:text-teal-200 dark:hover:text-white dark:decoration-teal-300/80";
  }
  // Incoming bubble: light-mode is #ffffff -> deep blue-700; dark-mode is #1e293b -> bright teal-300
  return "inline cursor-pointer underline underline-offset-2 decoration-1 transition-colors font-semibold break-all select-text text-blue-700 hover:text-blue-900 decoration-blue-500/60 dark:text-teal-300 dark:hover:text-teal-100 dark:decoration-teal-400/70";
}

function enhanceChildrenWithEntities(
  children: React.ReactNode,
  isMe: boolean,
  onEntityClick: (entity: DetectedEntity) => void
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === "string") {
      const parts = child.split(ENTITY_REGEX);
      if (parts.length <= 1) return child;

      return parts.map((part, index) => {
        if (!part) return null;
        const entity = classifyEntity(part);
        if (!entity) return part;

        return (
          <span
            key={index}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onEntityClick(entity);
            }}
            className={getEntityLinkClasses(isMe)}
          >
            {part}
          </span>
        );
      });
    }

    if (React.isValidElement(child)) {
      // Avoid modifying code blocks or typewriter fonts
      if (
        child.type === "code" ||
        child.type === "pre" ||
        (typeof child.type === "function" && (child.type as any).name === "CodeBlock")
      ) {
        return child;
      }
      if (child.props && (child.props as any).children) {
        return React.cloneElement(child, {
          children: enhanceChildrenWithEntities((child.props as any).children, isMe, onEntityClick),
        } as any);
      }
    }

    return child;
  });
}

interface ChatMessageMarkdownProps {
  content: string;
  isMe: boolean;
}

/**
 * Returns customized language badge metadata for HTML, CSS, JS, and common web code formats
 */
function getLanguageMeta(langRaw?: string) {
  const clean = (langRaw || "").toLowerCase().trim().replace(/^language-/, "");
  
  if (clean === "html" || clean === "htm") {
    return {
      label: "HTML",
      badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
      dotClass: "bg-orange-500",
    };
  }
  if (clean === "css" || clean === "scss" || clean === "sass") {
    return {
      label: "CSS",
      badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
      dotClass: "bg-sky-400",
    };
  }
  if (clean === "js" || clean === "javascript" || clean === "jsx") {
    return {
      label: clean === "jsx" ? "JSX" : "JAVASCRIPT",
      badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/30",
      dotClass: "bg-amber-400",
    };
  }
  if (clean === "ts" || clean === "typescript" || clean === "tsx") {
    return {
      label: clean === "tsx" ? "TSX" : "TYPESCRIPT",
      badgeClass: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      dotClass: "bg-blue-400",
    };
  }
  if (clean === "json") {
    return {
      label: "JSON",
      badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
      dotClass: "bg-emerald-400",
    };
  }
  if (clean) {
    return {
      label: clean.toUpperCase(),
      badgeClass: "bg-teal-500/15 text-teal-300 border-teal-500/30",
      dotClass: "bg-teal-400",
    };
  }
  return {
    label: "CODE",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/30",
    dotClass: "bg-slate-400",
  };
}

/**
 * Typewriter font family definition
 * Specifically Courier New, Courier, Lucida Console, Cascadia Code, monospace
 */
const TYPEWRITER_FONT =
  "'Courier New', Courier, 'Cascadia Code', Consolas, 'Lucida Console', Monaco, monospace";

const CodeBlock: React.FC<{ language?: string; code: string; isMe: boolean }> = ({
  language,
  code,
}) => {
  const [copied, setCopied] = useState(false);
  const meta = getLanguageMeta(language);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="my-2.5 rounded-xl overflow-hidden border border-slate-700/60 bg-[#0d1117] text-slate-100 shadow-md not-prose max-w-full">
      {/* Code Header Bar with Language Badge and Typewriter Indicators */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-slate-700/50 text-[11px] select-none">
        <div className="flex items-center gap-2">
          {/* Subtle editor window dots */}
          <div className="flex items-center gap-1.5 opacity-70 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-500/70 inline-block" />
          </div>

          {/* Language Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border ${meta.badgeClass}`}
            style={{ fontFamily: TYPEWRITER_FONT }}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
            {meta.label}
          </span>
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus:outline-none cursor-pointer"
          title="Copy code to clipboard"
        >
          <span className="text-[10px] font-medium">{copied ? "Copied!" : "Copy"}</span>
        </button>
      </div>

      {/* Code Body in Distinct Typewriter Monospace Font */}
      <pre
        className="p-3 text-[12.5px] leading-relaxed overflow-x-auto scrollbar-thin select-text text-emerald-300 dark:text-emerald-400 whitespace-pre"
        style={{ fontFamily: TYPEWRITER_FONT, letterSpacing: "-0.01em" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const ChatMessageMarkdown: React.FC<ChatMessageMarkdownProps> = ({
  content,
  isMe,
}) => {
  const [activeEntity, setActiveEntity] = useState<DetectedEntity | null>(null);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleEntityClick = (entity: DetectedEntity) => {
    setActiveEntity(entity);
    setCopiedFeedback(false);
  };

  return (
    <div className="chat-markdown text-sm break-words select-text">
      <ReactMarkdown
        components={{
          // Unwrap outer pre tag so CodeBlock can render its own card container without invalid HTML nesting
          pre({ children }) {
            return <>{children}</>;
          },

          // Code elements (inline vs block)
          code({ className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isMultiline = codeString.includes("\n") || Boolean(match);

            if (isMultiline) {
              return (
                <CodeBlock
                  language={match ? match[1] : undefined}
                  code={codeString}
                  isMe={isMe}
                />
              );
            }

            // Inline code in typewriter font
            return (
              <code
                className={`text-[12px] px-1.5 py-0.5 rounded font-medium ${
                  isMe
                    ? "bg-black/15 dark:bg-white/15 text-inherit border border-black/10 dark:border-white/10"
                    : "bg-slate-100 dark:bg-slate-800 text-teal-700 dark:text-teal-300 border border-slate-200/80 dark:border-slate-700/80"
                }`}
                style={{ fontFamily: TYPEWRITER_FONT }}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Paragraphs with entity highlighting
          p({ children }) {
            return (
              <p className="leading-relaxed mb-1.5 last:mb-0 whitespace-pre-wrap select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </p>
            );
          },

          // Unordered Lists
          ul({ children }) {
            return (
              <ul className="list-disc pl-5 my-1.5 space-y-1 select-text">
                {children}
              </ul>
            );
          },

          // Ordered Lists
          ol({ children }) {
            return (
              <ol className="list-decimal pl-5 my-1.5 space-y-1 select-text">
                {children}
              </ol>
            );
          },

          li({ children }) {
            return (
              <li className="leading-relaxed select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </li>
            );
          },

          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-[3px] border-current pl-2.5 my-1.5 opacity-85 italic select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </blockquote>
            );
          },

          // Headings
          h1({ children }) {
            return (
              <h1 className="text-base font-bold my-1.5 leading-snug select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm font-bold my-1 leading-snug select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs font-bold my-0.5 leading-snug select-text">
                {enhanceChildrenWithEntities(children, isMe, handleEntityClick)}
              </h3>
            );
          },

          // Links
          a({ href, children }) {
            return (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (href) {
                    const classified = classifyEntity(href);
                    handleEntityClick(
                      classified || {
                        type: "url",
                        raw: href,
                        actionValue: href,
                        displayValue: href,
                      }
                    );
                  }
                }}
                className={getEntityLinkClasses(isMe)}
              >
                {children}
              </span>
            );
          },

          // Horizontal rule
          hr() {
            return <hr className="my-2 border-current opacity-20" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Mini Modal for Interactive URLs, Numbers, and Emails */}
      {mounted &&
        activeEntity &&
        createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none"
            onClick={(e) => {
              e.stopPropagation();
              setActiveEntity(null);
            }}
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700/80 p-5 animate-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with Type Icon and Value */}
              <div className="flex items-center gap-3.5 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activeEntity.type === "url"
                      ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                      : activeEntity.type === "phone"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                      : "bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400"
                  }`}
                >
                  <Icon
                    name={
                      activeEntity.type === "url"
                        ? "link"
                        : activeEntity.type === "phone"
                        ? "call"
                        : "mail"
                    }
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {activeEntity.type === "url"
                      ? "Link"
                      : activeEntity.type === "phone"
                      ? "Phone Number"
                      : "Email Address"}
                  </h4>
                  <p
                    className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate"
                    title={activeEntity.displayValue}
                  >
                    {activeEntity.displayValue}
                  </p>
                </div>
              </div>

              {/* Action Options */}
              <div className="space-y-1.5">
                {/* URL: Open in new tab */}
                {activeEntity.type === "url" && (
                  <button
                    type="button"
                    onClick={() => {
                      window.open(activeEntity.actionValue, "_blank", "noopener,noreferrer");
                      setActiveEntity(null);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <Icon name="open_in_new" size="sm" className="text-blue-600 dark:text-teal-400" />
                    <div>
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        Open link
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Opens in a new browser tab
                      </p>
                    </div>
                  </button>
                )}

                {/* Phone: Call (tel attribute) */}
                {activeEntity.type === "phone" && (
                  <a
                    href={`tel:${activeEntity.actionValue}`}
                    onClick={() => setActiveEntity(null)}
                    className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <Icon name="call" size="sm" className="text-[#00A884]" />
                    <div>
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        Call {activeEntity.actionValue}
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Dial number on this device
                      </p>
                    </div>
                  </a>
                )}

                {/* Email: Send email (mailTo) */}
                {activeEntity.type === "email" && (
                  <a
                    href={`mailto:${activeEntity.actionValue}`}
                    onClick={() => setActiveEntity(null)}
                    className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group cursor-pointer"
                  >
                    <Icon name="mail" size="sm" className="text-purple-600 dark:text-purple-400" />
                    <div>
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                        Send email
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Compose in default email app
                      </p>
                    </div>
                  </a>
                )}

                {/* Copy Action for all entities */}
                <button
                  type="button"
                  onClick={async () => {
                    const textToCopy =
                      activeEntity.type === "url" ? activeEntity.actionValue : activeEntity.raw;
                    await copyToClipboard(textToCopy);
                    setCopiedFeedback(true);
                    setTimeout(() => {
                      setCopiedFeedback(false);
                      setActiveEntity(null);
                    }, 700);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl flex items-center gap-3 text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group cursor-pointer"
                >
                  <Icon name="content_copy" size="sm" className="text-slate-500 dark:text-slate-400" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                      {activeEntity.type === "url"
                        ? "Copy link"
                        : activeEntity.type === "phone"
                        ? "Copy number"
                        : "Copy email"}
                    </span>
                    {copiedFeedback && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold animate-in fade-in">
                        Copied!
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {/* Cancel button */}
              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setActiveEntity(null)}
                  className="w-full py-2.5 text-center text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
