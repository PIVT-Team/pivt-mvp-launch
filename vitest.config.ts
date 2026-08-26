import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
        test: {
          name: "app",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./src/test/setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        // Edge-function logic — extraction, entity matching, funds-flow diffing —
        // is the part of this system that touches money and documents, and it
        // was previously never run by the test command at all. It is plain
        // TypeScript with no DOM, so it runs in Node without the jsdom setup.
        //
        // `qa-seed-deals` is excluded because it imports Deno's std library over
        // https, which Node's loader cannot resolve.
        test: {
          name: "functions",
          environment: "node",
          globals: true,
          include: ["supabase/functions/**/*.{test,spec}.ts"],
          exclude: ["**/node_modules/**", "supabase/functions/qa-seed-deals/**"],
        },
      },
    ],
  },
});
