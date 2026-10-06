// Studio-style SVG product artwork for the demo catalog. Real stores replace these with
// photos uploaded from the admin panel; the demo still needs to look like a real shop.

export type Shape = 'tshirt' | 'shirt' | 'jeans' | 'dress' | 'top' | 'kurta' | 'shoe' | 'sandal' | 'bag' | 'watch';

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount)));
  const r = c(n >> 16);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

let uid = 0;

/** Fill + soft light-to-shadow overlay clipped to the garment outline. */
function body(_: string, d: string, color: string, extra = '') {
  const id = `clip${++uid}`;
  const light = luminance(color) > 0.85;
  const stroke = shade(color, light ? -45 : -35);
  return `
<clipPath id="${id}"><path d="${d}"/></clipPath>
<path d="${d}" fill="${color}"/>
<g clip-path="url(#${id})">
  <rect x="0" y="0" width="300" height="375" fill="url(#light)"/>
  ${extra}
</g>
<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/>`;
}

const fold = (d: string, color: string, o = 0.22) =>
  `<path d="${d}" fill="none" stroke="${shade(color, -60)}" stroke-width="3" stroke-linecap="round" opacity="${o}"/>`;
const stitch = (d: string, color: string) =>
  `<path d="${d}" fill="none" stroke="${shade(color, luminance(color) > 0.5 ? -70 : 70)}" stroke-width="1" stroke-dasharray="3 3" opacity="0.6"/>`;

function garment(shape: Shape, c: string): string {
  const dark = shade(c, -28);
  switch (shape) {
    case 'tshirt': {
      const d = 'M95 72 L126 58 Q150 76 174 58 L205 72 L252 108 L233 144 L208 128 L210 302 Q150 309 90 302 L92 128 L67 144 L48 108 Z';
      return body('b', d, c, `
        ${fold('M112 165 Q120 230 113 290', c)}${fold('M188 170 Q180 235 189 292', c)}${fold('M140 260 Q150 280 160 300', c, 0.15)}
        ${stitch('M93 292 Q150 299 209 292', c)}${stitch('M72 134 L52 113', c)}${stitch('M228 134 L248 113', c)}`) +
        `<path d="M126 58 Q150 80 174 58" fill="none" stroke="${dark}" stroke-width="6" stroke-linecap="round"/>`;
    }
    case 'top': {
      const d = 'M100 82 Q150 92 200 82 L232 100 L246 140 L222 150 L210 130 L214 268 Q150 276 86 268 L90 130 L78 150 L54 140 L68 100 Z';
      return body('b', d, c, `${fold('M118 160 Q126 215 118 262', c)}${fold('M182 165 Q175 215 184 264', c)}${stitch('M89 259 Q150 266 211 259', c)}`) +
        `<path d="M100 82 Q150 96 200 82" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`;
    }
    case 'shirt': {
      const d = 'M96 70 L126 56 L150 80 L174 56 L204 70 L240 116 L262 236 L236 243 L212 152 L210 304 Q150 311 90 304 L88 152 L64 243 L38 236 L60 116 Z';
      const buttons = [112, 150, 188, 226, 264].map((y) => `<circle cx="150" cy="${y}" r="3.2" fill="${shade(c, luminance(c) > 0.6 ? -60 : 70)}"/>`).join('');
      return body('b', d, c, `
        ${fold('M110 170 Q118 240 110 296', c)}${fold('M190 175 Q182 240 192 298', c)}
        <line x1="150" y1="80" x2="150" y2="306" stroke="${dark}" stroke-width="1.6"/>
        ${stitch('M156 80 L156 306', c)}
        <rect x="166" y="118" width="26" height="28" rx="2" fill="none" stroke="${dark}" stroke-width="1.4"/>
        ${stitch('M40 228 L262 228', c)}`) +
        `<path d="M126 56 L150 80 L136 96 L120 66 Z M174 56 L150 80 L164 96 L180 66 Z" fill="${shade(c, -12)}" stroke="${dark}" stroke-width="1.4" stroke-linejoin="round"/>${buttons}`;
    }
    case 'jeans': {
      const d = 'M90 56 L210 56 L224 322 L166 322 L150 142 L134 322 L76 322 Z';
      const rivet = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#c9a227"/>`;
      return body('b', d, c, `
        <path d="M89 56 L211 56 L212 74 L88 74 Z" fill="${dark}"/>
        ${[104, 130, 170, 196].map((x) => `<rect x="${x}" y="54" width="6" height="22" rx="1.5" fill="${shade(c, -15)}" stroke="${shade(c, -45)}" stroke-width="0.8"/>`).join('')}
        <path d="M92 76 Q116 104 130 76" fill="none" stroke="${shade(c, -40)}" stroke-width="1.6"/>
        <path d="M208 76 Q184 104 170 76" fill="none" stroke="${shade(c, -40)}" stroke-width="1.6"/>
        ${stitch('M150 74 L150 118 Q148 132 140 136', c)}
        ${fold('M105 180 Q112 250 100 312', c, 0.18)}${fold('M195 180 Q188 250 200 312', c, 0.18)}
        ${fold('M120 140 Q128 150 136 146', c, 0.2)}${fold('M180 140 Q172 150 164 146', c, 0.2)}
        ${stitch('M78 312 L133 312', c)}${stitch('M167 312 L222 312', c)}
        ${rivet(130, 79)}${rivet(170, 79)}<circle cx="150" cy="65" r="4" fill="#c9a227"/>`);
    }
    case 'dress': {
      const d = 'M122 52 L178 52 L176 74 Q168 112 174 132 L250 316 Q150 334 50 316 L126 132 Q132 112 124 74 Z';
      const dots = [[120, 190], [170, 215], [100, 260], [145, 240], [200, 270], [130, 295], [180, 300], [155, 170], [215, 300], [85, 300]]
        .map(([x, y]) => `<g opacity="0.55"><circle cx="${x}" cy="${y}" r="5" fill="#fff"/><circle cx="${x}" cy="${y}" r="2" fill="${shade(c, 50)}"/></g>`).join('');
      return `<path d="M124 52 L116 26 M176 52 L184 26" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>` +
        body('b', d, c, `
          ${dots}
          ${fold('M140 140 Q122 230 100 318', c, 0.18)}${fold('M160 140 Q176 230 198 320', c, 0.18)}${fold('M150 140 L150 324', c, 0.12)}
          <rect x="100" y="124" width="100" height="12" fill="${dark}"/>
          ${stitch('M56 308 Q150 325 244 308', c)}`) +
        `<path d="M150 130 q-18 -14 -22 4 q4 14 22 -4 q18 -14 22 4 q-4 14 -22 -4 Z M150 130 l-8 26 M150 130 l8 26" fill="${dark}" stroke="${shade(c, -50)}" stroke-width="1.2"/>`;
    }
    case 'kurta': {
      const d = 'M96 64 L128 54 L150 64 L172 54 L204 64 L246 128 L228 170 L210 148 L214 330 Q150 336 86 330 L90 148 L72 170 L54 128 Z';
      const gold = '#e7b53a';
      const yoke = Array.from({ length: 11 }, (_, i) => {
        const t = i / 10;
        const x = 112 + t * 76;
        const y = 96 + Math.sin(t * Math.PI) * 26;
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${gold}"/>`;
      }).join('');
      const hem = Array.from({ length: 13 }, (_, i) => `<path d="M${92 + i * 9.5} 316 l4 -6 l4 6 z" fill="${gold}"/>`).join('');
      return body('b', d, c, `
        ${yoke}
        <rect x="80" y="306" width="140" height="28" fill="${dark}"/>${hem}
        ${fold('M115 170 Q122 240 112 300', c)}${fold('M185 170 Q178 240 188 300', c)}
        <path d="M150 64 L150 118" stroke="${dark}" stroke-width="2"/>${stitch('M64 150 L232 150', c)}`) +
        `<path d="M128 54 Q150 70 172 54" fill="none" stroke="${gold}" stroke-width="3"/>`;
    }
    case 'shoe': {
      const upper = 'M50 252 L54 204 Q62 180 94 178 L122 182 Q150 150 178 168 L214 204 Q250 216 264 238 L264 254 Z';
      return body('b', upper, c, `
        <path d="M50 252 L50 205 L64 200 L66 252 Z" fill="${dark}"/>
        <path d="M108 238 Q160 212 220 230" fill="none" stroke="${luminance(c) > 0.6 ? shade(c, -50) : '#ffffff'}" stroke-width="7" stroke-linecap="round" opacity="0.75"/>
        ${stitch('M70 246 L258 246', c)}${fold('M200 210 Q230 222 250 236', c, 0.3)}`) +
        `<path d="M94 178 Q108 166 122 182" fill="none" stroke="${shade(c, -50)}" stroke-width="4" stroke-linecap="round"/>
        <g stroke="#f8fafc" stroke-width="3.2" stroke-linecap="round"><path d="M128 188 L146 176"/><path d="M138 198 L158 186"/><path d="M150 208 L170 196"/></g>
        <path d="M44 254 L266 254 Q272 270 258 280 L62 284 Q40 280 44 254 Z" fill="#f5f5f4" stroke="#d6d3d1" stroke-width="1.6"/>
        <path d="M52 272 L262 270" stroke="#d6d3d1" stroke-width="2"/>`;
    }
    case 'sandal': {
      return `<path d="M48 262 Q58 244 110 247 L232 250 Q264 252 264 266 Q260 282 232 282 L72 284 Q46 282 48 262 Z" fill="${shade(c, 25)}" stroke="${shade(c, -30)}" stroke-width="1.6"/>
        <path d="M52 276 Q150 292 262 274 L258 286 Q150 300 56 288 Z" fill="${shade(c, -40)}"/>
        <path d="M92 252 Q118 196 152 250" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round"/>
        <path d="M150 252 Q186 206 218 252" fill="none" stroke="${c}" stroke-width="16" stroke-linecap="round"/>
        <path d="M92 252 Q118 196 152 250 M150 252 Q186 206 218 252" fill="none" stroke="${shade(c, 40)}" stroke-width="1" stroke-dasharray="3 3"/>
        <rect x="176" y="214" width="16" height="12" rx="2" fill="#d4a72c" stroke="#a37f1a"/>`;
    }
    case 'bag': {
      const d = 'M66 142 L234 142 L250 318 L50 318 Z';
      return `<path d="M100 142 C100 70 136 70 136 142 M164 142 C164 70 200 70 200 142" fill="none" stroke="${shade(c, -40)}" stroke-width="9" stroke-linecap="round"/>` +
        body('b', d, c, `
          <rect x="60" y="142" width="180" height="18" fill="${dark}"/>
          ${stitch('M72 168 L228 168 L240 306 L60 306 Z', c)}
          <rect x="112" y="200" width="76" height="56" rx="3" fill="none" stroke="${dark}" stroke-width="1.6"/>
          ${fold('M95 180 Q102 250 90 312', c, 0.15)}${fold('M205 180 Q198 250 210 312', c, 0.15)}`);
    }
    case 'watch': {
      const strap = c;
      const dial = luminance(c) < 0.35 ? '#0f172a' : '#f8fafc';
      const ink = dial === '#0f172a' ? '#f8fafc' : '#0f172a';
      const markers = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const r1 = i % 3 === 0 ? 34 : 38;
        return `<line x1="${(150 + Math.sin(a) * r1).toFixed(1)}" y1="${(185 - Math.cos(a) * r1).toFixed(1)}" x2="${(150 + Math.sin(a) * 42).toFixed(1)}" y2="${(185 - Math.cos(a) * 42).toFixed(1)}" stroke="${ink}" stroke-width="${i % 3 === 0 ? 3 : 1.5}"/>`;
      }).join('');
      return `<rect x="124" y="36" width="52" height="110" rx="10" fill="${strap}" stroke="${shade(strap, -30)}"/>
        <rect x="124" y="224" width="52" height="112" rx="10" fill="${strap}" stroke="${shade(strap, -30)}"/>
        ${[262, 282, 302].map((y) => `<circle cx="150" cy="${y}" r="3" fill="${shade(strap, -45)}"/>`).join('')}
        ${stitch('M130 44 L130 140 M170 44 L170 140 M130 230 L130 330 M170 230 L170 330', strap)}
        <rect x="208" y="176" width="12" height="18" rx="3" fill="#a1a1aa"/>
        <circle cx="150" cy="185" r="60" fill="url(#metal)" stroke="#71717a" stroke-width="1.5"/>
        <circle cx="150" cy="185" r="49" fill="${dial}"/>${markers}
        <line x1="150" y1="185" x2="150" y2="155" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>
        <line x1="150" y1="185" x2="176" y2="198" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
        <line x1="150" y1="185" x2="134" y2="146" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="150" cy="185" r="3.5" fill="${ink}"/>
        <ellipse cx="130" cy="160" rx="22" ry="10" fill="#fff" opacity="0.12" transform="rotate(-30 130 160)"/>`;
    }
  }
}

const DEFS = `<defs>
  <radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eceef1"/></radialGradient>
  <linearGradient id="light" x1="0" x2="1" y1="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0"/>
    <stop offset="1" stop-color="#000000" stop-opacity="0.22"/>
  </linearGradient>
  <linearGradient id="metal" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f4f4f5"/><stop offset="0.5" stop-color="#a1a1aa"/><stop offset="1" stop-color="#e4e4e7"/></linearGradient>
  <radialGradient id="floor" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity="0.18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>`;

/**
 * 4:5 product image. `view` 0 = full product, 1 = close-up detail shot (second gallery image).
 */
export function productSvg(shape: Shape, color: string, view = 0): string {
  const art = garment(shape, color);
  const floorY = shape === 'shoe' || shape === 'sandal' ? 292 : 338;
  const scene =
    view === 0
      ? `<ellipse cx="150" cy="${floorY}" rx="110" ry="12" fill="url(#floor)"/>${art}`
      : `<g transform="translate(150 150) scale(1.45) translate(-150 ${shape === 'shoe' || shape === 'sandal' ? -235 : shape === 'watch' ? -185 : -140})">${art}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 375" width="600" height="750">
${DEFS}
<rect width="300" height="375" fill="url(#bg)"/>
${scene}
</svg>`;
}

/** Wide promotional banner with product silhouettes on the right. */
export function bannerSvg(label: string, from: string, to: string, shapes: Shape[] = ['tshirt', 'dress', 'shoe']): string {
  const palette = ['#ffffff', '#fde68a', '#fbcfe8'];
  const items = shapes
    .map((s, i) => {
      const x = 880 + i * 200;
      const y = i === 1 ? 30 : 140;
      return `<g transform="translate(${x} ${y}) scale(${i === 1 ? 1.15 : 0.95})" opacity="0.95">${garment(s, palette[i % palette.length])}</g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 500" width="1600" height="500">
${DEFS}
<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<pattern id="dots" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#ffffff" opacity="0.12"/></pattern></defs>
<rect width="1600" height="500" fill="url(#g)"/>
<rect width="1600" height="500" fill="url(#dots)"/>
<circle cx="1180" cy="250" r="260" fill="#ffffff" opacity="0.08"/>
<circle cx="1180" cy="250" r="190" fill="#ffffff" opacity="0.07"/>
${items}
<text x="1560" y="470" text-anchor="end" font-family="Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="6" fill="#ffffff" opacity="0.35">${label}</text>
</svg>`;
}
