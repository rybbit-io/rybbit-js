import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", "dist"],
    environmentOptions: {
      jsdom: {
        url: "https://example.com/",
      },
    },
  },
});
