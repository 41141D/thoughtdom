// Deterministic seed -> same username always renders the same avatar, and
// it's computed entirely client-side. No DiceBear/Gravatar/etc: those work
// by sending the seed (i.e. the username) to a third-party server, which is
// exactly the kind of identity leakage an anonymity-first product shouldn't
// introduce just to draw a pretty picture.

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Palette pulled straight from tailwind.config.js -- avatars should feel
// native to the product, not like a bolted-on widget.
// Palette mirrors the product's identity colors (tailwind.config.js):
// signal, challenge, danger, agree, muted -- always native to the design.
const PALETTE = ["#1f5564", "#c28b46", "#a94040", "#3e7058", "#6b6457"];

export default function Avatar({
  seed,
  size = 40,
}: {
  seed: string;
  size?: number;
}) {
  const rand = mulberry32(hashSeed(seed));

  const bg = PALETTE[Math.floor(rand() * PALETTE.length)];
  const fg = "#faf8f4";

  // 4x4 symmetric grid (mirrored left/right), a la identicons, but rendered
  // as rounded blobs instead of hard squares to match the "premium, elegant"
  // brief rather than a blocky GitHub-style icon.
  const cols = 4;
  const rows = 4;
  const half = Math.ceil(cols / 2);
  const cells: boolean[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < half; x++) {
      row.push(rand() > 0.55);
    }
    for (let x = half; x < cols; x++) {
      row.push(row[cols - 1 - x]);
    }
    cells.push(row);
  }

  const cell = size / cols;
  const r = cell * 0.32;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-full shrink-0"
      role="img"
      aria-label={`Avatar for ${seed}`}
    >
      {/* Base uses the page background so the avatar blends with any theme
          (the palette blobs are what carry the identity). */}
      <rect
        width={size}
        height={size}
        rx={size / 2}
        fill="var(--td-paper, #faf8f4)"
        stroke="var(--td-line, #ddd7cb)"
        strokeWidth={1}
      />
      {cells.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell + cell * 0.12}
              y={y * cell + cell * 0.12}
              width={cell * 0.76}
              height={cell * 0.76}
              rx={r}
              fill={bg}
            />
          ) : null
        )
      )}
      <circle cx={size / 2} cy={size / 2} r={size / 2 - 1} fill="none" stroke={fg} strokeOpacity={0.08} />
    </svg>
  );
}
