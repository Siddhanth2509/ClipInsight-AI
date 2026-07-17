# Workspace Rules for ClipInsight AI

## UI/UX & Styling Standards (Vercel, Linear, Stripe level)

- **Token Discipline**: Do NOT use arbitrary hex codes or ad-hoc margin/padding sizes. If a color, radius, or spacing is not in `globals.css`, add it as a variable first.
- **Glassmorphism Spec**: Glass cards must have:
  - Radius: `16px` (`var(--r-lg)`)
  - Border: `1px solid rgba(255, 255, 255, 0.05)` (`var(--border)`)
  - Background: `rgba(255, 255, 255, 0.02)` (`var(--bg-card)`)
  - Blur: `10px` (`var(--blur-card)`)
  - Bevel drop-shadow + inner glow shadow:
    `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 1px 3px rgba(0, 0, 0, 0.3)`
- **Header Navigation Spec**:
  - Centered floating glass pill with blur: `20px` (`var(--blur-nav)`)
  - Border: `1px solid rgba(255, 255, 255, 0.08)`
  - Link text hover states: under-line slides from left-to-right (`scaleX` transform on hover).
- **GPU-Accelerated CSS-Only Marquees**:
  - Scrolling must run on `transform: translateX` with `will-change: transform` to force GPU layers and avoid layout recalculations.
  - No Javascript triggers for normal loop marquee scrolling.
  - Hovering on the marquee must pause the scroll animation for accessibility.
- **Typography Standards**:
  - Headings (H1/H2): Space Grotesk, tight letter-spacing `-0.03em` (`var(--heading-tracking)`), weight 700 (avoid heavy 800/900 weights that look bloated).
- **Interactive States**:
  - Use hover reveals, subtle glow drifts, and 3D tilts. Ensure hover interactions feel spring-like rather than robotic linear delays.

## Ponytail Coding Discipline (Pragmatic & Minimalist Philosophy)

Follow the **Ponytail Decision Ladder** before writing any code to prevent over-engineering and code bloat:
1. **Does this need to exist?** (YAGNI - You Ain't Gonna Need It). If not, skip it.
2. **Does it already exist in the codebase?** Reuse existing patterns and utilities rather than rewriting.
3. **Does the standard library do it?** Prioritize native language APIs and standard library functions.
4. **Does a native platform feature cover it?** Prioritize native HTML/CSS/browser features over custom library implementations.
5. **Does an installed dependency solve it?** Use an existing package if appropriate.
6. **Can it be done in one line?** If a simple one-liner works, do not write a multi-line utility.
7. **Write minimum code:** Only write custom code when none of the above are sufficient. Write the absolute minimum code that works.

### Lazy, Not Negligent
* Safety, data validation, error handling, performance optimization, and accessibility (a11y) must **never** be skipped.
* "Lazy" means avoiding unnecessary abstractions, new dependencies, and bloat—not skipping core software quality.
