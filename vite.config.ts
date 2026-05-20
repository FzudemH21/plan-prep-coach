import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Force Vite to pre-bundle @react-pdf/renderer and its CJS dependencies
    // (e.g. base64-js) so ESM interop is handled correctly at runtime.
    // The library is still loaded lazily via dynamic import in ExportPDFButton.
    include: ["@react-pdf/renderer"],
  },
}));
