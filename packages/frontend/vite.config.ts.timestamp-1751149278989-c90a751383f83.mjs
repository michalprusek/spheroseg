// vite.config.ts
import { defineConfig, loadEnv } from "file:///home/cvat/spheroseg/spheroseg/packages/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///home/cvat/spheroseg/spheroseg/node_modules/@vitejs/plugin-react/dist/index.mjs";
import path2 from "path";

// vite-static-fix.js
import fs from "fs";
import path from "path";
function staticAssetsPlugin() {
  return {
    name: "static-assets-fix",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes("/assets/illustrations/")) {
          const imageName = req.url.split("/").pop();
          const imagePath = path.resolve(process.cwd(), "public", "assets", "illustrations", imageName);
          console.log(`[Static Assets] Requested: ${req.url}`);
          console.log(`[Static Assets] Looking for file at: ${imagePath}`);
          if (fs.existsSync(imagePath)) {
            console.log(`[Static Assets] Found file: ${imagePath}`);
            let contentType = "application/octet-stream";
            if (imagePath.endsWith(".png")) contentType = "image/png";
            else if (imagePath.endsWith(".jpg") || imagePath.endsWith(".jpeg")) contentType = "image/jpeg";
            else if (imagePath.endsWith(".gif")) contentType = "image/gif";
            else if (imagePath.endsWith(".svg")) contentType = "image/svg+xml";
            const fileContent = fs.readFileSync(imagePath);
            res.setHeader("Content-Type", contentType);
            res.setHeader("Cache-Control", "public, max-age=3600");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.statusCode = 200;
            res.end(fileContent);
            return;
          } else {
            console.log(`[Static Assets] File not found: ${imagePath}`);
            const illustrationsDir = path.resolve(process.cwd(), "public", "assets", "illustrations");
            if (fs.existsSync(illustrationsDir)) {
              const files = fs.readdirSync(illustrationsDir);
              const matchingFile = files.find(
                (file) => file.toLowerCase() === imageName.toLowerCase()
              );
              if (matchingFile) {
                console.log(`[Static Assets] Found file with different case: ${matchingFile}`);
                const correctPath = path.resolve(illustrationsDir, matchingFile);
                let contentType = "application/octet-stream";
                if (correctPath.endsWith(".png")) contentType = "image/png";
                else if (correctPath.endsWith(".jpg") || correctPath.endsWith(".jpeg")) contentType = "image/jpeg";
                else if (correctPath.endsWith(".gif")) contentType = "image/gif";
                else if (correctPath.endsWith(".svg")) contentType = "image/svg+xml";
                const fileContent = fs.readFileSync(correctPath);
                res.setHeader("Content-Type", contentType);
                res.setHeader("Cache-Control", "public, max-age=3600");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.statusCode = 200;
                res.end(fileContent);
                return;
              }
            }
          }
        }
        return next();
      });
    }
  };
}

// vite.config.ts
var __vite_injected_original_dirname = "/home/cvat/spheroseg/spheroseg/packages/frontend";
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = env.VITE_API_URL || "http://localhost:5001";
  const apiBaseUrl = env.VITE_API_BASE_URL || "/api";
  const apiAuthPrefix = env.VITE_API_AUTH_PREFIX ? `/api${env.VITE_API_AUTH_PREFIX}` : "/api/auth";
  const apiUsersPrefix = env.VITE_API_USERS_PREFIX ? `/api${env.VITE_API_USERS_PREFIX}` : "/api/users";
  console.log(`Using API URL: ${apiUrl} for proxy configuration`);
  console.log(`API Base URL: ${apiBaseUrl}`);
  console.log(`Auth Prefix: ${apiAuthPrefix}`);
  console.log(`Users Prefix: ${apiUsersPrefix}`);
  return {
    plugins: [react(), staticAssetsPlugin()],
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "@mui/icons-material",
        "@mui/material",
        "@radix-ui/react-dialog",
        "@radix-ui/react-alert-dialog",
        "@radix-ui/react-dropdown-menu",
        "lucide-react",
        "sonner"
      ],
      esbuildOptions: {
        target: "es2020"
      }
    },
    resolve: {
      alias: {
        "@": path2.resolve(__vite_injected_original_dirname, "./src"),
        "@shared": path2.resolve(__vite_injected_original_dirname, "./src/shared"),
        "@spheroseg/shared": path2.resolve(__vite_injected_original_dirname, "../shared/src")
      }
    },
    server: {
      watch: {
        ignored: [
          "**/assets/illustrations/**",
          "**/uploads/**",
          "**/node_modules/**"
        ],
        usePolling: true
        // Use polling for Docker volumes
      },
      // Allow external access from any host
      allowedHosts: ["localhost", "spherosegapp.utia.cas.cz", ".utia.cas.cz"],
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      proxy: {
        // Socket.IO proxy - highest priority to avoid conflicts
        "/socket.io": {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          ws: true,
          rewrite: (path3) => path3,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              console.log("Socket.IO proxy error", err);
            });
            proxy.on("proxyReq", (_proxyReq, req) => {
              console.log("Socket.IO Request:", req.method, req.url);
            });
          }
        },
        // Main API proxy
        "/api": {
          target: apiUrl,
          changeOrigin: true,
          secure: false,
          rewrite: (path3) => path3,
          configure: (proxy) => {
            proxy.on("error", (err) => {
              console.log("API proxy error", err);
            });
            proxy.on("proxyReq", (_proxyReq, req) => {
              console.log("API Request:", req.method, req.url);
            });
            proxy.on("proxyRes", (proxyRes, req) => {
              console.log("API Response:", proxyRes.statusCode, req.url);
            });
          }
        },
        // File uploads
        "/uploads": {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        },
        // Static assets
        "/assets/illustrations": {
          target: apiUrl,
          changeOrigin: true,
          secure: false
        }
      },
      host: "0.0.0.0",
      port: 3e3,
      strictPort: true,
      // Don't try other ports if 3000 is taken
      cors: true,
      // Enable CORS for all requests
      hmr: {
        // Always use secure WebSocket when served over HTTPS
        clientPort: 443,
        protocol: "wss",
        host: "spherosegapp.utia.cas.cz",
        path: "/@hmr",
        timeout: 18e4,
        overlay: true
      },
      // Allow all hosts
      origin: "*"
    },
    // Optimize build
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 1e3
    },
    // Configure base path for production
    base: "/",
    // Improve error handling
    logLevel: "info"
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAidml0ZS1zdGF0aWMtZml4LmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2hvbWUvY3ZhdC9zcGhlcm9zZWcvc3BoZXJvc2VnL3BhY2thZ2VzL2Zyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9jdmF0L3NwaGVyb3NlZy9zcGhlcm9zZWcvcGFja2FnZXMvZnJvbnRlbmQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvY3ZhdC9zcGhlcm9zZWcvc3BoZXJvc2VnL3BhY2thZ2VzL2Zyb250ZW5kL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52LCB0eXBlIFBsdWdpbk9wdGlvbiB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IHN0YXRpY0Fzc2V0c1BsdWdpbiBmcm9tICcuL3ZpdGUtc3RhdGljLWZpeCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiB7XG4gIC8vIExvYWQgZW52IHZhcmlhYmxlcyBiYXNlZCBvbiBtb2RlXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xuXG4gIC8vIERldGVybWluZSBBUEkgVVJMIGZyb20gZW52aXJvbm1lbnQgb3IgZmFsbGJhY2sgdG8gZGVmYXVsdFxuICBjb25zdCBhcGlVcmwgPSBlbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0OjUwMDEnO1xuICBjb25zdCBhcGlCYXNlVXJsID0gZW52LlZJVEVfQVBJX0JBU0VfVVJMIHx8ICcvYXBpJztcbiAgLy8gQWRqdXN0IHByZWZpeGVzIGJhc2VkIG9uIGVudmlyb25tZW50IHZhcmlhYmxlc1xuICBjb25zdCBhcGlBdXRoUHJlZml4ID0gZW52LlZJVEVfQVBJX0FVVEhfUFJFRklYID8gYC9hcGkke2Vudi5WSVRFX0FQSV9BVVRIX1BSRUZJWH1gIDogJy9hcGkvYXV0aCc7XG4gIGNvbnN0IGFwaVVzZXJzUHJlZml4ID0gZW52LlZJVEVfQVBJX1VTRVJTX1BSRUZJWCA/IGAvYXBpJHtlbnYuVklURV9BUElfVVNFUlNfUFJFRklYfWAgOiAnL2FwaS91c2Vycyc7XG5cbiAgY29uc29sZS5sb2coYFVzaW5nIEFQSSBVUkw6ICR7YXBpVXJsfSBmb3IgcHJveHkgY29uZmlndXJhdGlvbmApO1xuICBjb25zb2xlLmxvZyhgQVBJIEJhc2UgVVJMOiAke2FwaUJhc2VVcmx9YCk7XG4gIGNvbnNvbGUubG9nKGBBdXRoIFByZWZpeDogJHthcGlBdXRoUHJlZml4fWApO1xuICBjb25zb2xlLmxvZyhgVXNlcnMgUHJlZml4OiAke2FwaVVzZXJzUHJlZml4fWApO1xuXG4gIHJldHVybiB7XG4gICAgcGx1Z2luczogW3JlYWN0KCksIHN0YXRpY0Fzc2V0c1BsdWdpbigpXSBhcyBQbHVnaW5PcHRpb25bXSxcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGluY2x1ZGU6IFtcbiAgICAgICAgJ3JlYWN0JyxcbiAgICAgICAgJ3JlYWN0LWRvbScsXG4gICAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcbiAgICAgICAgJ0BtdWkvaWNvbnMtbWF0ZXJpYWwnLFxuICAgICAgICAnQG11aS9tYXRlcmlhbCcsXG4gICAgICAgICdAcmFkaXgtdWkvcmVhY3QtZGlhbG9nJyxcbiAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1hbGVydC1kaWFsb2cnLFxuICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWRyb3Bkb3duLW1lbnUnLFxuICAgICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICAgJ3Nvbm5lcidcbiAgICAgIF0sXG4gICAgICBlc2J1aWxkT3B0aW9uczoge1xuICAgICAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHJlc29sdmU6IHtcbiAgICAgIGFsaWFzOiB7XG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXG4gICAgICAgICdAc2hhcmVkJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL3NoYXJlZCcpLFxuICAgICAgICAnQHNwaGVyb3NlZy9zaGFyZWQnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vc2hhcmVkL3NyYycpLFxuICAgICAgfSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgaWdub3JlZDogW1xuICAgICAgICAgICcqKi9hc3NldHMvaWxsdXN0cmF0aW9ucy8qKicsXG4gICAgICAgICAgJyoqL3VwbG9hZHMvKionLFxuICAgICAgICAgICcqKi9ub2RlX21vZHVsZXMvKionLFxuICAgICAgICBdLFxuICAgICAgICB1c2VQb2xsaW5nOiB0cnVlLCAvLyBVc2UgcG9sbGluZyBmb3IgRG9ja2VyIHZvbHVtZXNcbiAgICAgIH0sXG4gICAgICAvLyBBbGxvdyBleHRlcm5hbCBhY2Nlc3MgZnJvbSBhbnkgaG9zdFxuICAgICAgYWxsb3dlZEhvc3RzOiBbJ2xvY2FsaG9zdCcsICdzcGhlcm9zZWdhcHAudXRpYS5jYXMuY3onLCAnLnV0aWEuY2FzLmN6J10sXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nOiAnKicsXG4gICAgICB9LFxuICAgICAgcHJveHk6IHtcbiAgICAgICAgLy8gU29ja2V0LklPIHByb3h5IC0gaGlnaGVzdCBwcmlvcml0eSB0byBhdm9pZCBjb25mbGljdHNcbiAgICAgICAgJy9zb2NrZXQuaW8nOiB7XG4gICAgICAgICAgdGFyZ2V0OiBhcGlVcmwsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgICAgd3M6IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgsXG4gICAgICAgICAgY29uZmlndXJlOiAocHJveHkpID0+IHtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ1NvY2tldC5JTyBwcm94eSBlcnJvcicsIGVycik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChfcHJveHlSZXEsIHJlcSkgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnU29ja2V0LklPIFJlcXVlc3Q6JywgcmVxLm1ldGhvZCwgcmVxLnVybCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICAvLyBNYWluIEFQSSBwcm94eVxuICAgICAgICAnL2FwaSc6IHtcbiAgICAgICAgICB0YXJnZXQ6IGFwaVVybCxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aCxcbiAgICAgICAgICBjb25maWd1cmU6IChwcm94eSkgPT4ge1xuICAgICAgICAgICAgcHJveHkub24oJ2Vycm9yJywgKGVycikgPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQVBJIHByb3h5IGVycm9yJywgZXJyKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVxJywgKF9wcm94eVJlcSwgcmVxKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdBUEkgUmVxdWVzdDonLCByZXEubWV0aG9kLCByZXEudXJsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEpID0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0FQSSBSZXNwb25zZTonLCBwcm94eVJlcy5zdGF0dXNDb2RlLCByZXEudXJsKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIEZpbGUgdXBsb2Fkc1xuICAgICAgICAnL3VwbG9hZHMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiBhcGlVcmwsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFN0YXRpYyBhc3NldHNcbiAgICAgICAgJy9hc3NldHMvaWxsdXN0cmF0aW9ucyc6IHtcbiAgICAgICAgICB0YXJnZXQ6IGFwaVVybCxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBob3N0OiAnMC4wLjAuMCcsXG4gICAgICBwb3J0OiAzMDAwLFxuICAgICAgc3RyaWN0UG9ydDogdHJ1ZSwgLy8gRG9uJ3QgdHJ5IG90aGVyIHBvcnRzIGlmIDMwMDAgaXMgdGFrZW5cbiAgICAgIGNvcnM6IHRydWUsIC8vIEVuYWJsZSBDT1JTIGZvciBhbGwgcmVxdWVzdHNcbiAgICAgIGhtcjoge1xuICAgICAgICAvLyBBbHdheXMgdXNlIHNlY3VyZSBXZWJTb2NrZXQgd2hlbiBzZXJ2ZWQgb3ZlciBIVFRQU1xuICAgICAgICBjbGllbnRQb3J0OiA0NDMsXG4gICAgICAgIHByb3RvY29sOiAnd3NzJyxcbiAgICAgICAgaG9zdDogJ3NwaGVyb3NlZ2FwcC51dGlhLmNhcy5jeicsXG4gICAgICAgIHBhdGg6ICcvQGhtcicsXG4gICAgICAgIHRpbWVvdXQ6IDE4MDAwMCxcbiAgICAgICAgb3ZlcmxheTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICAvLyBBbGxvdyBhbGwgaG9zdHNcbiAgICAgIG9yaWdpbjogJyonLFxuICAgIH0sXG4gICAgLy8gT3B0aW1pemUgYnVpbGRcbiAgICBidWlsZDoge1xuICAgICAgc291cmNlbWFwOiB0cnVlLFxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxuICAgIH0sXG4gICAgLy8gQ29uZmlndXJlIGJhc2UgcGF0aCBmb3IgcHJvZHVjdGlvblxuICAgIGJhc2U6ICcvJyxcbiAgICAvLyBJbXByb3ZlIGVycm9yIGhhbmRsaW5nXG4gICAgbG9nTGV2ZWw6ICdpbmZvJyxcbiAgfTtcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9jdmF0L3NwaGVyb3NlZy9zcGhlcm9zZWcvcGFja2FnZXMvZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL2N2YXQvc3BoZXJvc2VnL3NwaGVyb3NlZy9wYWNrYWdlcy9mcm9udGVuZC92aXRlLXN0YXRpYy1maXguanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvY3ZhdC9zcGhlcm9zZWcvc3BoZXJvc2VnL3BhY2thZ2VzL2Zyb250ZW5kL3ZpdGUtc3RhdGljLWZpeC5qc1wiOy8qKlxuICogUGx1Z2luIHBybyBzcHJcdTAwRTF2blx1MDBFOSB6cHJhY292XHUwMEUxblx1MDBFRCBzdGF0aWNrXHUwMEZEY2ggc291Ym9yXHUwMTZGIHYgRG9ja2VyIGtvbnRlam5lcnVcbiAqL1xuXG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHN0YXRpY0Fzc2V0c1BsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnc3RhdGljLWFzc2V0cy1maXgnLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIC8vIFpwcmFjb3ZcdTAwRTFuXHUwMEVEIHBvXHUwMTdFYWRhdmtcdTAxNkYgbmEgaWx1c3RyYVx1MDEwRG5cdTAwRUQgb2JyXHUwMEUxemt5XG4gICAgICAgIGlmIChyZXEudXJsICYmIHJlcS51cmwuaW5jbHVkZXMoJy9hc3NldHMvaWxsdXN0cmF0aW9ucy8nKSkge1xuICAgICAgICAgIGNvbnN0IGltYWdlTmFtZSA9IHJlcS51cmwuc3BsaXQoJy8nKS5wb3AoKTtcbiAgICAgICAgICBjb25zdCBpbWFnZVBhdGggPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJ3B1YmxpYycsICdhc3NldHMnLCAnaWxsdXN0cmF0aW9ucycsIGltYWdlTmFtZSk7XG5cbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1N0YXRpYyBBc3NldHNdIFJlcXVlc3RlZDogJHtyZXEudXJsfWApO1xuICAgICAgICAgIGNvbnNvbGUubG9nKGBbU3RhdGljIEFzc2V0c10gTG9va2luZyBmb3IgZmlsZSBhdDogJHtpbWFnZVBhdGh9YCk7XG5cbiAgICAgICAgICAvLyBLb250cm9sYSwgemRhIHNvdWJvciBleGlzdHVqZVxuICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGltYWdlUGF0aCkpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU3RhdGljIEFzc2V0c10gRm91bmQgZmlsZTogJHtpbWFnZVBhdGh9YCk7XG5cbiAgICAgICAgICAgIC8vIFVyXHUwMTBEZW5cdTAwRUQgTUlNRSB0eXB1IHBvZGxlIHBcdTAxNTlcdTAwRURwb255IHNvdWJvcnVcbiAgICAgICAgICAgIGxldCBjb250ZW50VHlwZSA9ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xuICAgICAgICAgICAgaWYgKGltYWdlUGF0aC5lbmRzV2l0aCgnLnBuZycpKSBjb250ZW50VHlwZSA9ICdpbWFnZS9wbmcnO1xuICAgICAgICAgICAgZWxzZSBpZiAoaW1hZ2VQYXRoLmVuZHNXaXRoKCcuanBnJykgfHwgaW1hZ2VQYXRoLmVuZHNXaXRoKCcuanBlZycpKSBjb250ZW50VHlwZSA9ICdpbWFnZS9qcGVnJztcbiAgICAgICAgICAgIGVsc2UgaWYgKGltYWdlUGF0aC5lbmRzV2l0aCgnLmdpZicpKSBjb250ZW50VHlwZSA9ICdpbWFnZS9naWYnO1xuICAgICAgICAgICAgZWxzZSBpZiAoaW1hZ2VQYXRoLmVuZHNXaXRoKCcuc3ZnJykpIGNvbnRlbnRUeXBlID0gJ2ltYWdlL3N2Zyt4bWwnO1xuXG4gICAgICAgICAgICAvLyBOYVx1MDEwRHRlblx1MDBFRCBzb3Vib3J1XG4gICAgICAgICAgICBjb25zdCBmaWxlQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyhpbWFnZVBhdGgpO1xuXG4gICAgICAgICAgICAvLyBOYXN0YXZlblx1MDBFRCBzcHJcdTAwRTF2blx1MDBGRGNoIGhsYXZpXHUwMTBEZWtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGNvbnRlbnRUeXBlKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAncHVibGljLCBtYXgtYWdlPTM2MDAnKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU9yaWdpbicsICcqJyk7XG5cbiAgICAgICAgICAgIC8vIE9kZXNsXHUwMEUxblx1MDBFRCBvYnNhaHUgc291Ym9ydVxuICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSAyMDA7XG4gICAgICAgICAgICByZXMuZW5kKGZpbGVDb250ZW50KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coYFtTdGF0aWMgQXNzZXRzXSBGaWxlIG5vdCBmb3VuZDogJHtpbWFnZVBhdGh9YCk7XG5cbiAgICAgICAgICAgIC8vIFRyeSB3aXRoIGRpZmZlcmVudCBjYXNpbmcgb3Igd2l0aG91dCBVVUlEIGZvcm1hdFxuICAgICAgICAgICAgY29uc3QgaWxsdXN0cmF0aW9uc0RpciA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAncHVibGljJywgJ2Fzc2V0cycsICdpbGx1c3RyYXRpb25zJyk7XG4gICAgICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhpbGx1c3RyYXRpb25zRGlyKSkge1xuICAgICAgICAgICAgICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKGlsbHVzdHJhdGlvbnNEaXIpO1xuXG4gICAgICAgICAgICAgIC8vIFRyeSB0byBmaW5kIGEgY2FzZS1pbnNlbnNpdGl2ZSBtYXRjaFxuICAgICAgICAgICAgICBjb25zdCBtYXRjaGluZ0ZpbGUgPSBmaWxlcy5maW5kKGZpbGUgPT5cbiAgICAgICAgICAgICAgICBmaWxlLnRvTG93ZXJDYXNlKCkgPT09IGltYWdlTmFtZS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgICAgICk7XG5cbiAgICAgICAgICAgICAgaWYgKG1hdGNoaW5nRmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbU3RhdGljIEFzc2V0c10gRm91bmQgZmlsZSB3aXRoIGRpZmZlcmVudCBjYXNlOiAke21hdGNoaW5nRmlsZX1gKTtcbiAgICAgICAgICAgICAgICBjb25zdCBjb3JyZWN0UGF0aCA9IHBhdGgucmVzb2x2ZShpbGx1c3RyYXRpb25zRGlyLCBtYXRjaGluZ0ZpbGUpO1xuXG4gICAgICAgICAgICAgICAgLy8gRGV0ZXJtaW5lIGNvbnRlbnQgdHlwZVxuICAgICAgICAgICAgICAgIGxldCBjb250ZW50VHlwZSA9ICdhcHBsaWNhdGlvbi9vY3RldC1zdHJlYW0nO1xuICAgICAgICAgICAgICAgIGlmIChjb3JyZWN0UGF0aC5lbmRzV2l0aCgnLnBuZycpKSBjb250ZW50VHlwZSA9ICdpbWFnZS9wbmcnO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvcnJlY3RQYXRoLmVuZHNXaXRoKCcuanBnJykgfHwgY29ycmVjdFBhdGguZW5kc1dpdGgoJy5qcGVnJykpIGNvbnRlbnRUeXBlID0gJ2ltYWdlL2pwZWcnO1xuICAgICAgICAgICAgICAgIGVsc2UgaWYgKGNvcnJlY3RQYXRoLmVuZHNXaXRoKCcuZ2lmJykpIGNvbnRlbnRUeXBlID0gJ2ltYWdlL2dpZic7XG4gICAgICAgICAgICAgICAgZWxzZSBpZiAoY29ycmVjdFBhdGguZW5kc1dpdGgoJy5zdmcnKSkgY29udGVudFR5cGUgPSAnaW1hZ2Uvc3ZnK3htbCc7XG5cbiAgICAgICAgICAgICAgICAvLyBSZWFkIGFuZCBzZW5kIHRoZSBmaWxlXG4gICAgICAgICAgICAgICAgY29uc3QgZmlsZUNvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY29ycmVjdFBhdGgpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIGNvbnRlbnRUeXBlKTtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDYWNoZS1Db250cm9sJywgJ3B1YmxpYywgbWF4LWFnZT0zNjAwJyk7XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcbiAgICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDIwMDtcbiAgICAgICAgICAgICAgICByZXMuZW5kKGZpbGVDb250ZW50KTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5leHQoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn0iXSwKICAibWFwcGluZ3MiOiAiO0FBQWtVLFNBQVMsY0FBYyxlQUFrQztBQUMzWCxPQUFPLFdBQVc7QUFDbEIsT0FBT0EsV0FBVTs7O0FDRWpCLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTtBQUVGLFNBQVIscUJBQXNDO0FBQzNDLFNBQU87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LFFBQVE7QUFDekIsc0JBQVEsSUFBSSx5QkFBeUIsR0FBRztBQUFBLFlBQzFDLENBQUM7QUFDRCxrQkFBTSxHQUFHLFlBQVksQ0FBQyxXQUFXLFFBQVE7QUFDdkMsc0JBQVEsSUFBSSxzQkFBc0IsSUFBSSxRQUFRLElBQUksR0FBRztBQUFBLFlBQ3ZELENBQUM7QUFBQSxVQUNIO0FBQUEsUUFDRjtBQUFBO0FBQUEsUUFFQSxRQUFRO0FBQUEsVUFDTixRQUFRO0FBQUEsVUFDUixjQUFjO0FBQUEsVUFDZCxRQUFRO0FBQUEsVUFDUixTQUFTLENBQUNBLFVBQVNBO0FBQUEsVUFDbkIsV0FBVyxDQUFDLFVBQVU7QUFDcEIsa0JBQU0sR0FBRyxTQUFTLENBQUMsUUFBUTtBQUN6QixzQkFBUSxJQUFJLG1CQUFtQixHQUFHO0FBQUEsWUFDcEMsQ0FBQztBQUNELGtCQUFNLEdBQUcsWUFBWSxDQUFDLFdBQVcsUUFBUTtBQUN2QyxzQkFBUSxJQUFJLGdCQUFnQixJQUFJLFFBQVEsSUFBSSxHQUFHO0FBQUEsWUFDakQsQ0FBQztBQUNELGtCQUFNLEdBQUcsWUFBWSxDQUFDLFVBQVUsUUFBUTtBQUN0QyxzQkFBUSxJQUFJLGlCQUFpQixTQUFTLFlBQVksSUFBSSxHQUFHO0FBQUEsWUFDM0QsQ0FBQztBQUFBLFVBQ0g7QUFBQSxRQUNGO0FBQUE7QUFBQSxRQUVBLFlBQVk7QUFBQSxVQUNWLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUE7QUFBQSxRQUVBLHlCQUF5QjtBQUFBLFVBQ3ZCLFFBQVE7QUFBQSxVQUNSLGNBQWM7QUFBQSxVQUNkLFFBQVE7QUFBQSxRQUNWO0FBQUEsTUFDRjtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLE1BQ04sWUFBWTtBQUFBO0FBQUEsTUFDWixNQUFNO0FBQUE7QUFBQSxNQUNOLEtBQUs7QUFBQTtBQUFBLFFBRUgsWUFBWTtBQUFBLFFBQ1osVUFBVTtBQUFBLFFBQ1YsTUFBTTtBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QsU0FBUztBQUFBLE1BQ1g7QUFBQTtBQUFBLE1BRUEsUUFBUTtBQUFBLElBQ1Y7QUFBQTtBQUFBLElBRUEsT0FBTztBQUFBLE1BQ0wsV0FBVztBQUFBLE1BQ1gsdUJBQXVCO0FBQUEsSUFDekI7QUFBQTtBQUFBLElBRUEsTUFBTTtBQUFBO0FBQUEsSUFFTixVQUFVO0FBQUEsRUFDWjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInBhdGgiLCAicGF0aCJdCn0K
