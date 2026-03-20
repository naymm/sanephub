import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Evita CORS ao carregar imagens do Storage (PDF) quando o API está noutro host (ex.: 172.x).
      ...(supabaseUrl
        ? {
            proxy: {
              "/__supabase": {
                target: supabaseUrl,
                changeOrigin: true,
                secure: false,
                rewrite: (p) => p.replace(/^\/__supabase/, ""),
              },
            },
          }
        : {}),
    },
    plugins: [react()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
