---
name: premium-ui-ux-design
description: Guidelines, tokens, and workflows for building premium, high-fidelity (9/10+) landing pages and marketing UIs. Use when designing, upgrading, or writing CSS/React/Tailwind components for frontend interfaces.
---

# Premium UI/UX Web Design & Tokens System

This skill enforces Vercel/Linear/Stripe/Textura-level engineering standards. It dictates how to analyze designs, write layout structures, and implement high-fidelity visual styling.

---

## 1. Core Principles

1. **Tokens Over Adjectives**: Do not write styling choices as subjective text descriptions (e.g. "make a nice dark glass card"). Think in exact token dimensions: background opacity, border-radius, box-shadow bevel strings, font family/weights, and letter spacing.
2. **Visual-First Pipeline**: When matching a design style, always follow the proper pipeline:
   `Capture Screenshot` -> `Vision Model / DOM Inspection` -> `CSS/JSON Token Extraction` -> `Component Decomposition` -> `CSS & React Implementation`
3. **No Hardcoded Hex/Pixel Values**: Never use arbitrary hex codes or pixel spacings directly in Tailwind classes or inline styles. Declare them as variables in `globals.css` under `:root` first, with a comment explaining their source.

---

## 2. Visually Extracted Token Set

Always consume these standard premium CSS variables when writing styles. If updating them, preserve their commented sources:

```css
:root {
  /* Backgrounds: derived from getlayers.ai (#070708) & refero.design (#0a0a0c) */
  --bg-base:    #070810;  /* Deep dark canvas */
  --bg-surface: rgba(12, 12, 16, 0.97);
  --bg-card:    rgba(255, 255, 255, 0.02);  /* getlayers: 2% white card */
  --bg-card-hover: rgba(255, 255, 255, 0.04);
  --bg-nav:     rgba(255, 255, 255, 0.03);  /* getlayers nav base */

  /* Borders: derived from getlayers.ai and refero.design computed styles */
  --border:      rgba(255, 255, 255, 0.05); /* getlayers card border */
  --border-md:   rgba(255, 255, 255, 0.08); /* getlayers hover/godly border */
  
  /* Glass Bevel: derived from godly.website button shadow */
  --glass-bevel: 0px -1px 0px rgba(255, 255, 255, 0.35),
                 1px 0px 0px rgba(255, 255, 255, 0.15),
                 -1px 0px 0px rgba(255, 255, 255, 0.15),
                 0px 1px 0px rgba(255, 255, 255, 0.30),
                 0px 1px 1px rgba(0, 0, 0, 0.20);
  
  /* Top Inner Glow: derived from getlayers.ai inset */
  --glass-inset: inset 0 1px 0 rgba(255, 255, 255, 0.08);

  /* Blurs: derived from getlayers.ai nav and card blurs */
  --blur-nav:  blur(20px);
  --blur-card: blur(10px);
  --blur-btn:  saturate(150%) blur(12px); /* godly glass-button style */

  /* Typography: Space Grotesk / Inter pairings */
  --font-display: 'Space Grotesk', sans-serif;
  --font-body:    'Inter', sans-serif;
  --heading-tracking: -0.03em;  /* getlayers h1: letter-spacing: -0.03em */
  --heading-lh: 1.08;           /* tight heads from getlayers/refero */

  /* Radii: getlayers card & button styles */
  --r-lg:  16px;    /* getlayers card border-radius */
  --r-pill: 9999px; /* getlayers pill buttons & floating nav */
}
```

---

## 3. Web Component Conventions

When designing layouts, decompose them into these named semantic component sub-structures:

### Navbar (Floating Glass Pill)
- **Style**: Centered floating pill with `rgba(255, 255, 255, 0.03)` bg, `1px solid rgba(255, 255, 255, 0.08)` border, `backdrop-filter: blur(20px)`.
- **Items**: Logo (left) -> Text-only links with custom bottom-border hover state (center) -> Glass-pill secondary CTA button (right).

### Hero Section (Stripe/Linear Decomposition)
- **Component Stack**:
  1. `AnnouncementPill`: Upper small badge with green live-pulse dot.
  2. `H1 Heading`: Big, tight display typography (Space Grotesk, letter-spacing -0.03em, line-height 1.08).
  3. `Subtitle`: Muted body text (`rgba(255, 255, 255, 0.60)`), maximum width 540px.
  4. `CTAGroup`: Button container. Primary is glass-bevel button, secondary is transparent border button.
  5. `InputBar`: Glass URL bar with hover glow borders and embedded right-aligned accent button.
  6. `ProductVisual`: Low-opacity neon gradients / orbiting web scene / screen frame container.

### Bento Feature Section
- **Grid Layout**: Split asymmetric layouts (`1fr 2fr` or staggered rows). Avoid boring symmetric boxes.
- **Card Styling**:
  - Deep glass card background (`rgba(255,255,255,0.02)`), thin border (`rgba(255,255,255,0.05)`), border-radius `16px`.
  - Top inner bevel glow using `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08)`.
  - Top edge horizontal highlight overlay (`1px` height white gradient).
  - Hover state: Background lifts to `rgba(255,255,255,0.04)`, border brightens to `rgba(255,255,255,0.08)`, drop shadow adds low-opacity colored glow (`var(--purple-dim)`).

---

## 4. Animation & Physics System

1. **GPU Composited Only**: Never trigger browser layouts during animations. Scroll effects, tickers, and reveals must use transform/opacity only.
2. **CSS-Only Ticker (Marquee)**:
   - Always implement tickers as CSS-only animations using `transform: translateX` from `0%` to `-50%` with duplicates.
   - Use `will-change: transform` to force GPU layer compositing (avoiding browser recalculations).
   - Include `:hover { animation-play-state: paused }` on the container to allow users to read static text when focused.
3. **Spring Reveals (Textura Pattern)**:
   - Prefer physics-based spring motions (using libraries like `@react-spring/web` or GSAP timelines).
   - Avoid linear or standard cubic-bezier curves for premium movements. Use spring coefficients or strict ease-expo curves: `cubic-bezier(0.16, 1, 0.3, 1)`.
