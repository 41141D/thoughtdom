import React from "react";
import { mediaUrl } from "./api";

// Deliberately scoped to what the editor's toolbar actually produces:
// headers, bold, italic, inline code, fenced code blocks, blockquotes,
// bullet lists, links, and images. No tables, no raw HTML passthrough.
//
// Builds React elements directly (never dangerouslySetInnerHTML), so
// there's no HTML injection surface regardless of what a user pastes in.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Order matters: code first (so markers inside `code` aren't touched),
  // then images (before links -- images are just links with a leading !),
  // then links, bold, italic.
  const pattern =
    /(`[^`]+`)|(!\[[^\]]*\]\([^)\s]+\))|(\[[^\]]+\]\([^)\s]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${i++}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-surface2 px-1.5 py-0.5 text-[0.85em] text-signal">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("![")) {
      const imgMatch = token.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
      if (imgMatch) {
        const [, alt, src] = imgMatch;
        const safe = /^(https?:|\/media\/)/.test(src);
        if (safe) {
          nodes.push(
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={key}
              src={mediaUrl(src)}
              alt={alt}
              loading="lazy"
              className="rounded-xl border border-line max-w-full my-1.5 max-h-[480px] object-contain bg-surface2"
            />
          );
        }
      }
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const safe = /^https?:\/\//.test(href);
        nodes.push(
          safe ? (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-signal underline decoration-signal/40 underline-offset-2 hover:decoration-signal"
            >
              {label}
            </a>
          ) : (
            label
          )
        );
      }
    } else if (token.startsWith("**")) {
      nodes.push(
        <strong key={key} className="font-semibold text-text">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

const HEADER_STYLES: Record<number, string> = {
  1: "text-2xl font-display font-semibold mt-1 mb-2",
  2: "text-xl font-display font-semibold mt-1 mb-1.5",
  3: "text-lg font-display font-semibold mt-1 mb-1",
};

export function renderMarkdown(source: string): React.ReactNode {
  const lines = source.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let quoteBuffer: string[] = [];

  function flushList(key: string) {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc pl-5 my-1 space-y-0.5">
        {listBuffer.map((item, idx) => (
          <li key={idx}>{renderInline(item, `${key}-li-${idx}`)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  function flushQuote(key: string) {
    if (quoteBuffer.length === 0) return;
    blocks.push(
      <blockquote key={key} className="border-l-2 border-signal/40 pl-3 my-1.5 text-muted italic">
        {quoteBuffer.map((line, idx) => (
          <p key={idx}>{renderInline(line, `${key}-q-${idx}`)}</p>
        ))}
      </blockquote>
    );
    quoteBuffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```lang ... ```
    if (line.trim().startsWith("```")) {
      flushList(`list-${i}`);
      flushQuote(`quote-${i}`);
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <pre
          key={`code-${i}`}
          className="rounded-lg bg-surface2 border border-line p-3 my-1.5 overflow-x-auto text-[0.85em]"
        >
          <code className="text-text/90">{codeLines.join("\n")}</code>
        </pre>
      );
      if (lang) {
        // no-op: language tag currently unused, reserved for future syntax highlighting
      }
      i++; // skip closing ```
      continue;
    }

    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      flushList(`list-${i}`);
      flushQuote(`quote-${i}`);
      const level = headerMatch[1].length;
      const Tag = (`h${level}` as unknown) as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={`h-${i}`} className={HEADER_STYLES[level]}>
          {renderInline(headerMatch[2], `h-${i}`)}
        </Tag>
      );
      i++;
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.*)$/);
    if (quoteMatch) {
      flushList(`list-${i}`);
      quoteBuffer.push(quoteMatch[1]);
      i++;
      continue;
    }
    flushQuote(`quote-${i}`);

    const bulletMatch = line.match(/^\s*[-*]\s+(.*)$/);
    if (bulletMatch) {
      listBuffer.push(bulletMatch[1]);
      i++;
      continue;
    }
    flushList(`list-${i}`);

    if (line.trim() === "") {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
    } else {
      blocks.push(
        <p key={`p-${i}`} className="leading-relaxed">
          {renderInline(line, `p-${i}`)}
        </p>
      );
    }
    i++;
  }
  flushList("list-end");
  flushQuote("quote-end");

  return <>{blocks}</>;
}
