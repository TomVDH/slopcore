/**
 * Single source of truth for portfolio content. Every design direction
 * restyles these same facts; none of them invents its own copy beyond
 * tone-of-voice framing in its own markup.
 *
 * The live site (index.html) predates this module and keeps its content
 * inline by design; this module mirrors it.
 */

export const identity = {
  brand: "tomtoolery",
  person: "Tom V.",
  role: "Marketer, artist, digital nerd, hobbyist",
  headline: { lead: "Half marketer, half artist,", kicker: "all nerd." },
  intro: "I plan campaigns by day and melt pixels after hours. This is the toolbox.",
  manifesto: {
    before: "Good marketing is craft with a deadline. I obsess over the message, then the pixels, then the ",
    emphasis: "weird little details",
    after: " nobody asked for. That last part is where the fun lives.",
  },
  email: "hello@tomtoolery.studio",
  github: "https://github.com/TomVDH",
  contactLine: "Got something weird to build?",
  ctaWork: "See the work",
  ctaContact: "Say hello",
  smallPrint: "© 2026 Tomtoolery. Built by hand with three.js and GSAP. No cookies, no trackers.",
} as const;

export interface Project {
  slug: string;
  title: string;
  category: string;
  year: string;
  summary: string;
  alt: string;
}

export const projects: Project[] = [
  {
    slug: "salt-circuit",
    title: "Salt & Circuit",
    category: "Brand & launch",
    year: "2025",
    summary: "Rebrand and launch campaign for a hardware startup that needed to feel hand-soldered, not venture-polished.",
    alt: "Launch visuals for the Salt and Circuit rebrand",
  },
  {
    slug: "feedback-loop",
    title: "Feedback Loop",
    category: "Audio-reactive visuals",
    year: "2024",
    summary: "Projection visuals for a club night, driven live by the desk feed and a fistful of shaders.",
    alt: "Audio-reactive projection visuals for the Feedback Loop club night",
  },
  {
    slug: "long-funnel",
    title: "The Long Funnel",
    category: "B2B content engine",
    year: "2024",
    summary: "Thirty-eight weeks of shipped campaign content for a buyer journey that refuses to be rushed.",
    alt: "Editorial spread from The Long Funnel content program",
  },
  {
    slug: "plotterbot",
    title: "Plotterbot",
    category: "Drawing machine",
    year: "2023",
    summary: "A pen plotter that turns market data into generative line art, one postcard at a time.",
    alt: "Plotterbot, a pen plotter drawing generative line art",
  },
];

export interface PlaygroundItem {
  slug: string;
  title: string;
  detail: string;
  alt: string;
}

export const playground: PlaygroundItem[] = [
  {
    slug: "plotter-postcards",
    title: "Plotter postcards",
    detail: "ink on paper, 2025",
    alt: "Stack of generative pen plotter postcards",
  },
  {
    slug: "cloud-study",
    title: "Mushroom-cloud particle study",
    detail: "canvas vfx, 2026",
    alt: "Frame from a mushroom cloud particle simulation",
  },
  {
    slug: "shader-sketchbook",
    title: "Shader sketchbook",
    detail: "GLSL doodles, ongoing",
    alt: "Abstract still from a GLSL shader sketch",
  },
];

export const playgroundMotto = "If it beeps, plots, or glows, I want to build one.";

export const currentlyInto = ["WebGPU compute", "Riso printing", "FM synthesis"] as const;

/** Seeded grayscale placeholder; directions apply their own treatment. */
export function image(slug: string, w: number, h: number): string {
  return `https://picsum.photos/seed/tomfolio-${slug}/${w}/${h}?grayscale`;
}
