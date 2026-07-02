import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Dev-only landing override. When TOMFOLIO_LANDING is set, the dev server
 * redirects the bare "/" to that path so a fresh serve opens there instead
 * of the shader hero. Used by the `dev:claude` script (the Claude preview
 * serve config) so spinning up does not start on the fbm "lava" hero. Only
 * bare "/" is redirected: the hero stays reachable at /index.html, and a
 * plain `npm run dev` leaves the env unset and opens the real homepage.
 */
function devLanding(): Plugin {
  const target = process.env.TOMFOLIO_LANDING;
  return {
    name: "tomfolio-dev-landing",
    apply: "serve",
    configureServer(server) {
      if (!target) return;
      server.middlewares.use((req, res, next) => {
        if (req.url === "/") {
          res.statusCode = 302;
          res.setHeader("Location", target);
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [devLanding()],
  build: {
    target: "es2022",
    rollupOptions: {
      input: {
        main: entry("./index.html"),
        shelf: entry("./shelf.html"),
        directions: entry("./directions/index.html"),
        press: entry("./directions/press.html"),
        journal: entry("./directions/journal.html"),
        y2k: entry("./directions/y2k.html"),
        klein: entry("./directions/klein.html"),
        bauhaus: entry("./directions/bauhaus.html"),
        brut: entry("./directions/brut.html"),
        lavanda: entry("./directions/lavanda.html"),
        cognac: entry("./directions/cognac.html"),
        orchid: entry("./directions/orchid.html"),
        greige: entry("./directions/greige.html"),
        mauve: entry("./directions/mauve.html"),
        twilight: entry("./directions/twilight.html"),
        port: entry("./directions/port.html"),
        ube: entry("./directions/ube.html"),
        sepia: entry("./directions/sepia.html"),
        fresco: entry("./directions/fresco.html"),
        letterpress: entry("./sandbox/letterpress.html"),
        rig: entry("./sandbox/rig.html"),
        artefact: entry("./sandbox/artefact.html"),
        "cursor-shelf": entry("./sandbox/cursor-shelf.html"),
        "cursor-colour": entry("./sandbox/cursor-colour.html"),
        "cursor-particles": entry("./sandbox/cursor-particles.html"),
        components: entry("./sandbox/components.html"),
      },
    },
  },
  server: {
    host: true,
  },
});
