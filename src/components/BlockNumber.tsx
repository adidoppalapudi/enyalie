/**
 * Big chunky digits, drawn from a 3×5 pixel font like an old scoreboard.
 * Rendered as SVG squares rather than block characters so the shapes stay
 * crisp whatever monospace font a device has.
 */
const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '..#', '..#'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  ',': ['.', '.', '.', '#', '#'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
};

const GAP = 1; // empty columns between characters

interface BlockNumberProps {
  /** Text to draw; only digits, commas and % are supported. */
  text: string;
  /** Spoken instead of the drawing, e.g. "1,030 points". */
  label: string;
}

export function BlockNumber({ text, label }: BlockNumberProps) {
  const pixels: { x: number; y: number }[] = [];
  let x = 0;
  for (const char of text) {
    const glyph = GLYPHS[char];
    if (!glyph) continue;
    glyph.forEach((row, y) => {
      [...row].forEach((cell, column) => {
        if (cell === '#') pixels.push({ x: x + column, y });
      });
    });
    x += glyph[0].length + GAP;
  }
  const width = Math.max(x - GAP, 1);

  return (
    <svg className="block-number" viewBox={`0 0 ${width} 5`} role="img" aria-label={label} shapeRendering="crispEdges">
      {pixels.map((pixel) => (
        <rect key={`${pixel.x}-${pixel.y}`} x={pixel.x} y={pixel.y} width={1} height={1} />
      ))}
    </svg>
  );
}
