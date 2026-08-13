export const TOPIC_SUGGESTIONS = [
  "Artificial Intelligence",
  "Machine Learning",
  "Biology",
  "Physics",
  "Chemistry",
  "Mathematics",
  "History",
  "Philosophy",
  "Psychology",
  "Economics",
  "Politics",
  "Programming",
  "Software Engineering",
  "Climate",
  "Space",
  "Neuroscience",
  "Ethics",
  "Sociology",
  "Linguistics",
  "Medicine",
  "Education",
  "Design",
  "Startups",
  "Cryptography",
  "Astronomy",
  "Anthropology",
  "Game Theory",
  "Robotics",
];

export function suggestTopics(query: string, exclude: string[]): string[] {
  const q = query.trim().toLowerCase();
  const excluded = new Set(exclude.map((t) => t.toLowerCase()));
  if (!q) return [];
  return TOPIC_SUGGESTIONS.filter(
    (t) => t.toLowerCase().includes(q) && !excluded.has(t.toLowerCase())
  ).slice(0, 6);
}
