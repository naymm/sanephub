import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");

  return {
    server: {
      host: "::",
      port: 8080,
      allowedHosts: [
      'app.sanephub.com',
      'api.sanephub.com',
      'studio.sanephub.com'
    ],
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
    plugins: [
      react(),
      VitePWA({
        // `autoUpdate` recarrega a página quando há nova versão do SW — frequentemente ao voltar à aba
        // (revalidação + activação). `prompt` regista updates em background sem reload forçado.
        registerType: "prompt",
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        // Ícones com dimensões reais — o Chrome exige 192+512 e valida sizes vs pixels do PNG
        includeAssets: ["icon_app.png", "pwa-192.png", "pwa-512.png"],
        manifest: {
          id: "/",
          name: "Sanep Hub",
          short_name: "Sanep Hub",
          description: "ERP Intranet Corporativa do Grupo SANEP",
          theme_color: "#101828",
          background_color: "#101828",
          display: "standalone",
          orientation: "portrait-primary",
          scope: "/",
          start_url: "/",
          lang: "pt",
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        // SW em dev causa navegações/reloads estranhos ao trocar de aba; testar PWA com `vite preview`/build.
        devOptions: {
          enabled: false,
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
