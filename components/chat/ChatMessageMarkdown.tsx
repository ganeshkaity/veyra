"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Icon } from "@/components/ui/Icon";

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
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // Clipboard write fallback
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
          className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus:outline-none"
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

          // Paragraphs
          p({ children }) {
            return (
              <p className="leading-relaxed mb-1.5 last:mb-0 whitespace-pre-wrap select-text">
                {children}
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
            return <li className="leading-relaxed select-text">{children}</li>;
          },

          // Blockquotes
          blockquote({ children }) {
            return (
              <blockquote className="border-l-[3px] border-current pl-2.5 my-1.5 opacity-85 italic select-text">
                {children}
              </blockquote>
            );
          },

          // Headings
          h1({ children }) {
            return (
              <h1 className="text-base font-bold my-1.5 leading-snug select-text">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="text-sm font-bold my-1 leading-snug select-text">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="text-xs font-bold my-0.5 leading-snug select-text">
                {children}
              </h3>
            );
          },

          // Links
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-80 font-medium select-text"
              >
                {children}
              </a>
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
    </div>
  );
};
