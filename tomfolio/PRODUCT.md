# Product

## Register

brand

## Users

Hiring managers, collaborators, and design-literate clients deciding in under a minute whether Tom is worth a conversation. Secondary user: Tom himself, who treats the site as a sandbox for marketing-meets-creative-code experiments. Visitors arrive curious, scan fast, and remember texture and confidence more than copy.

## Product Purpose

A one-page portfolio for the Tomtoolery persona (marketer / artist / digital nerd / hobbyist) that proves craft by being craft: the site itself is the portfolio piece. Success looks like a visitor scrolling to the end, poking the shader, and sending the "Say hello" email. The project also hosts an explicit iteration program: an iteration shelf for hero shaders (`/shelf.html`) and a direction shelf of complete, wholly different design languages (`/directions/`), because choosing boldly between strong options is part of the brand story.

## Brand Personality

Crafted, playful, nerdy-precise. "Serious craft, unserious attitude." Confident enough to be plain when plain works; the wit lives in the details (a shader that breathes, a lime period on the wordmark), never in forced clever copy.

## Anti-references

- Generic AI-slop landing pages: purple gradients, eyebrow kickers over every section, three equal feature cards, fake product screenshots.
- Template portfolios (Squarespace/Webflow sameness, stock "creative" serif moodiness without a reason).
- Crypto/tech-bro neon dashboards and terminal cosplay; "too techy" was explicit feedback on round one.
- Anything that reads as made-by-a-model-in-one-pass: em-dash prose, poetic micro-labels, decorative locale strips.

## Design Principles

1. **Show, don't claim.** The page demonstrates the skills it advertises; no testimonials to taste, just taste.
2. **One bold idea per surface, executed fully.** Each direction commits to an extreme; blends and middle paths are failure modes.
3. **Motion must mean something.** Hierarchy, storytelling, feedback, or state; never GSAP for GSAP's sake.
4. **The whole gamut, never the middle.** When iterating, candidates should be wholly different (palette, type, layout, motion), not variations on a default.
5. **Degrade gracefully.** Reduced motion, no JS, weak GPUs, and narrow screens all get a real, intentional experience.

## Accessibility & Inclusion

WCAG AA contrast minimum everywhere (AAA target for hero copy). Full `prefers-reduced-motion` paths: static shader frames, native scrolling, content visible without animation. Keyboard operability for all interactive affordances (including hover-driven previews). Semantic HTML, real alt text, focus-visible styling. `?still` and `?nogl` URL flags exist as deterministic fallbacks for testing and constrained devices.
