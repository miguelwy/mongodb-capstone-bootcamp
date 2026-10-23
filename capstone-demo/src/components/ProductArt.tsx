import type { Product } from '../data';

// Hand-drawn SVG illustrations for the synthetic catalog — local, no external images.

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function Art({ id, c, d }: { id: string; c: string; d: string }) {
  const s = { stroke: d, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (id) {
    case 'p1': // sneaker
      return (
        <g {...s} transform="translate(60 60) scale(1.06) translate(-63 -70)">
          <path d="M14 80 Q14 92 26 92 L104 92 Q112 92 112 84 L112 80 Z" fill="#fff" />
          <path d="M18 80 L22 56 Q24 46 34 46 L50 45 Q58 45 63 52 L72 62 Q80 68 96 68 Q110 70 110 80 Z" fill={c} />
          <path d="M18 72 L22 54 Q24 50 28 50 L28 72 Z" fill={d} />
          <path d="M50 52 L57 56 M55 57 L62 61 M60 62 L67 66" fill="none" />
          <path d="M16 86 L110 86" fill="none" opacity={0.5} />
        </g>
      );
    case 'p2': // slip-on
      return (
        <g {...s} transform="translate(60 60) scale(1.06) translate(-63 -70)">
          <path d="M14 82 Q14 92 26 92 L104 92 Q112 92 112 86 L112 82 Z" fill="#fff" />
          <path d="M16 82 Q16 64 30 62 L56 60 Q64 60 70 66 Q78 72 96 72 Q110 74 110 82 Z" fill={c} />
          <path d="M28 63 Q44 56 62 62" fill="none" strokeWidth={3} />
          <path d="M66 64 L70 72 L74 66" fill="none" />
          <path d="M30 76 L100 78" fill="none" opacity={0.35} strokeDasharray="3 4" />
        </g>
      );
    case 'p3': // sandal
      return (
        <g {...s} transform="translate(60 60) scale(1.06) translate(-63 -70)">
          <path d="M14 86 Q14 80 28 80 L100 80 Q112 80 112 86 Q112 92 100 92 L28 92 Q14 92 14 86 Z" fill={d} />
          <path d="M16 81 Q16 76 28 76 L100 76 Q110 76 110 81 Z" fill="#E9D8BE" />
          <path d="M38 78 Q50 52 66 78" fill="none" stroke={c} strokeWidth={8} />
          <path d="M74 78 Q86 58 100 78" fill="none" stroke={c} strokeWidth={8} />
          <rect x="44" y="60" width="8" height="7" rx="1.5" fill="#E9D8BE" />
        </g>
      );
    case 'p4': // linen overshirt
      return (
        <g {...s}>
          <path
            d="M38 24 L52 18 Q60 24 68 18 L82 24 L104 40 L95 57 L86 50 L86 102 L34 102 L34 50 L25 57 L16 40 Z"
            fill={c}
          />
          <path d="M52 18 L60 32 L68 18" fill="#fff" />
          <path d="M60 32 L60 102" fill="none" />
          {[44, 58, 72, 86].map((y) => (
            <circle key={y} cx="60" cy={y} r="1.8" fill={d} />
          ))}
          <rect x="40" y="44" width="13" height="13" rx="1.5" fill="none" />
        </g>
      );
    case 'p5': // rain shell
      return (
        <g {...s}>
          <path d="M44 28 Q46 8 60 8 Q74 8 76 28 Z" fill={c} />
          <path
            d="M38 26 L82 26 L104 44 L98 92 L88 92 L86 56 L86 104 L34 104 L34 56 L32 92 L22 92 L16 44 Z"
            fill={c}
          />
          <path d="M60 26 L60 104" fill="none" stroke="#C1C7C6" />
          <path d="M40 66 L52 66 M68 66 L80 66" fill="none" />
          <path d="M54 26 L54 34 M66 26 L66 34" fill="none" stroke="#C1C7C6" />
        </g>
      );
    case 'p6': // crossbody
      return (
        <g {...s}>
          <path d="M30 60 Q60 2 90 60" fill="none" strokeWidth={3} />
          <rect x="24" y="54" width="72" height="46" rx="10" fill={c} />
          <path d="M24 70 L96 70" fill="none" stroke="#5C6C75" />
          <rect x="70" y="66" width="10" height="8" rx="2" fill="#C1C7C6" stroke="#5C6C75" />
        </g>
      );
    case 'p7': // duffel
      return (
        <g {...s}>
          <path d="M42 52 Q60 26 78 52" fill="none" strokeWidth={4} />
          <rect x="14" y="48" width="92" height="46" rx="22" fill={c} />
          <ellipse cx="26" cy="71" rx="8" ry="19" fill={d} />
          <path d="M34 54 L92 54" fill="none" strokeDasharray="2 3" />
          <path d="M44 50 L44 94 M76 50 L76 94" fill="none" stroke="#E9D8BE" strokeWidth={4} />
        </g>
      );
    case 'p8': // sunglasses
      return (
        <g {...s}>
          <path d="M22 54 L10 50 M98 54 L110 50" fill="none" stroke={c} strokeWidth={4} />
          <circle cx="40" cy="62" r="18" fill="#2F3A40" stroke={c} strokeWidth={5} />
          <circle cx="80" cy="62" r="18" fill="#2F3A40" stroke={c} strokeWidth={5} />
          <path d="M57 58 Q60 51 63 58" fill="none" stroke={c} strokeWidth={4} />
          <path d="M30 54 Q34 49 40 48 M70 54 Q74 49 80 48" fill="none" stroke="#fff" opacity={0.6} />
        </g>
      );
    default:
      return <rect x="30" y="30" width="60" height="60" rx="10" fill={c} />;
  }
}

export default function ProductArt({ product, size }: { product: Product; size: number }) {
  const d = shade(product.swatch, product.swatch.toLowerCase() === '#2a2a2a' ? -0.6 : 0.45);
  return (
    <svg className="art" width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <rect width="120" height="120" rx="14" fill="#F2F4F3" />
      <ellipse cx="60" cy="102" rx="44" ry="5" fill="#001E2B" opacity={0.06} />
      <Art id={product.id} c={product.swatch} d={d} />
    </svg>
  );
}
