// Preset tags shown as quick-add suggestions. Users can also type any
// custom tag (e.g. "Python", "Rust", "Open Source") -- this list just
// seeds discovery so communities converge on shared tags instead of every
// post inventing its own spelling.
export const TAG_SUGGESTIONS = [
  "Politics",
  "Religion",
  "Programming",
  "Technology",
  "Science",
  "History",
  "Psychology",
  "Gaming",
  "Movies",
  "Books",
  "Art",
  "Music",
  "Economics",
  "Philosophy",
  "Questions",
];

export function suggestTags(query: string, exclude: string[]): string[] {
  const q = query.trim().toLowerCase();
  const excluded = new Set(exclude.map((t) => t.toLowerCase()));
  if (!q) return [];
  return TAG_SUGGESTIONS.filter(
    (t) => t.toLowerCase().includes(q) && !excluded.has(t.toLowerCase())
  ).slice(0, 6);
}
