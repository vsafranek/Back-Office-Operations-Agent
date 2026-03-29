"use client";

import { Anchor, Text } from "@mantine/core";
import type { ReactNode } from "react";

function safeHttpUrl(href: string): string | null {
  try {
    const u = new URL(href.trim());
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
  } catch {
    return null;
  }
  return null;
}

function formatLine(line: string): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      out.push(line.slice(last, m.index));
    }
    if (m[1] != null) {
      out.push(
        <Text span key={k++} fw={700} inherit>
          {m[1]}
        </Text>
      );
    } else if (m[2] != null && m[3] != null) {
      const href = safeHttpUrl(m[3]);
      out.push(
        href ? (
          <Anchor key={k++} href={href} target="_blank" rel="noopener noreferrer" size="sm">
            {m[2]}
          </Anchor>
        ) : (
          `[${m[2]}](${m[3]})`
        )
      );
    } else if (m[4] != null) {
      const href = safeHttpUrl(m[4]);
      const label = m[4].length > 64 ? `${m[4].slice(0, 61)}…` : m[4];
      out.push(
        href ? (
          <Anchor
            key={k++}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            style={{ wordBreak: "break-all" }}
          >
            {label}
          </Anchor>
        ) : (
          m[4]
        )
      );
    }
    last = re.lastIndex;
  }
  if (last < line.length) {
    out.push(line.slice(last));
  }
  if (out.length === 0) return line;
  if (out.length === 1) return out[0]!;
  return <>{out}</>;
}

/** Odpověď asistenta: odstavce, **tučně**, [text](url), holé https odkazy. */
export function FormattedAssistantContent({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((para, pi) => (
        <Text
          key={pi}
          component="div"
          size="sm"
          mb={pi < paragraphs.length - 1 ? "sm" : 0}
          style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
        >
          {para.split("\n").map((line, li) => (
            <span key={li}>
              {li > 0 ? <br /> : null}
              {formatLine(line)}
            </span>
          ))}
        </Text>
      ))}
    </>
  );
}
