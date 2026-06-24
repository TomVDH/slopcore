import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
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
      },
    },
  },
  server: {
    host: true,
  },
});
