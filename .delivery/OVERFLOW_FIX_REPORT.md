# ThoughtDom — Content Overflow Fix Report

**Date:** August 13, 2026
**Scope:** Horizontal content overflow on the post detail page (and related surfaces) when user-generated text contains long unbroken strings.
**Author:** Manus AI

## 1. Problem

Long, unbroken strings in user-generated content — post bodies, comments, inline code, fenced code blocks, links, blockquotes, and tags — could extend past their container boundaries, producing a horizontal overflow that pushed content outside the post card. The risk applied not only to the post detail page but to any surface rendering raw user text (feed cards, community pages, search results, and community list previews).

## 2. Root cause

The app had no global policy for text that cannot be broken at word boundaries. Individual components rendered markdown and raw strings without `overflow-wrap` or `word-break` rules, and flex rows containing user text (vote rows, comment headers, tag rows) lacked `min-width: 0`, so a child could force its parent wider than the card.

## 3. Fix

The fix is a minimal, **global CSS layer** rather than scattered per-component patches, applied on top of the existing design-token theming. No UI redesign, no algorithm changes (the Steel-Man Gate is untouched), and no new dependencies.

### 3.1 Global content-wrapping rules (`frontend/app/globals.css`)

A new `CONTENT WRAPPING` section was appended to the stylesheet:

| Selector | Rule applied |
| --- | --- |
| `.user-content`, `.prose` | `overflow-wrap: anywhere; word-break: break-word;` — breaks even the most hostile unbroken strings |
| Headings and prose blocks (`blockquote`, `ul/ol/li`, `p`, `code`, `pre`, `a`) | wrapping plus `min-width: 0; max-width: 100%;` |
| `.steelman-mirror` | same wrapping treatment, so Steel-Man restatements never spill |
| Inline `code` | `word-break: break-word; max-width: 100%;` — wraps inside its container |
| `pre` (fenced code blocks) | `overflow-x: auto; max-width: 100%;` — intentional horizontal scroll, kept inside the card |
| `.reply-type-pill` | wraps and is capped at container width |
| `.flex` rows and `.grid` children | `min-width: 0` — stops flex children from forcing parents wider than their container |

The card itself is never force-clipped with `overflow: hidden`; text wraps naturally and only fenced code blocks scroll intentionally.

### 3.2 Markdown wrappers

Markdown output is now rendered inside a `.prose` wrapper at the three rendering sites — the post detail body, comment bodies (including Steel-Man mirrors in `CommentThread.tsx`), and the post editor preview — so all prose rules apply uniformly.

### 3.3 Raw-text preview lines

The two-line `line-clamp` body previews on the feed, community detail, search results, and communities pages now carry the `user-content` class, so even a preview line of pure spam breaks inside the card.

### 3.4 Files changed

| File | Change |
| --- | --- |
| `frontend/app/globals.css` | New content-wrapping CSS layer |
| `frontend/app/[locale]/post/[id]/page.tsx` | Prose wrapper around the post body |
| `frontend/components/CommentThread.tsx` | Prose wrapper around comment bodies |
| `frontend/components/editor/PostEditor.tsx` | Prose wrapper around the editor preview |
| `frontend/app/[locale]/page.tsx`, `app/[locale]/community/[slug]/page.tsx`, `app/[locale]/search/page.tsx`, `app/[locale]/communities/page.tsx` | `user-content` class on raw-text preview lines |

## 4. Verification

A dedicated test post was created containing every hostile case at once — a ~1,200-character unbroken string in the body, in inline code, in a fenced code block, inside a long link, inside a blockquote and a bullet, a 30-character tag, and a neutral comment plus a Steel-Man Gate-passing challenge comment each carrying the same unbroken string in the body and (for the challenge) in the Steel-Man restatement.

| Case | Result |
| --- | --- |
| Post body, unbroken string | Wraps inside card — verified in browser |
| Inline `code` with unbroken string | Wraps inside card |
| Fenced code block | Stays in card, scrolls horizontally (intentional) |
| Long link (`https://a…a.com/b…b?c=d…`) | Wraps, stays in card |
| Blockquote and bullet with unbroken string | Wrap, stay in card |
| Long tag pill | Wraps within the tag row |
| Comment body, unbroken string | Wraps inside the comment card |
| Steel-Man mirror, 3,000-character restatement | Wraps inside the mirror block |

Screenshots: `overflow_fixed_body_en.webp` (post body, inline code), `overflow_fixed_steelman_en.webp` (code block, long link, challenge comment with steelman mirror).

The backend regression suite remains **54/54 passing** after the change; the TypeScript build is clean. Note that the Steel-Man Gate correctly rejected challenge attempts whose restatements were clearly disengaged from the argument — only good-faith restatements published, which is the intended behavior.

## 5. Data hygiene

All verification content (the overflow test post, five test comments, and the screenshot-test account `FrostCrane28`) was purged from the development database. The only remaining account is the real `WinterComet439`, with its original post and replies intact.
