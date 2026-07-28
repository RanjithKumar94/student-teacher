
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: './' keeps asset paths relative so this works when hosted in a
// sub-path, like https://<you>.github.io/<repo-name>/
export default defineConfig({
  plugins: [react()],
  base: "./",
});
