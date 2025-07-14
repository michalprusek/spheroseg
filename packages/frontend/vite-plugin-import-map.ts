import type { Plugin } from 'vite';

export function importMapPlugin(): Plugin {
  return {
    name: 'vite-plugin-import-map',
    transformIndexHtml(html) {
      // Add import map to resolve bare module specifiers
      const importMap = `
    <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime"
      }
    }
    </script>`;
      
      // Insert import map before any other scripts
      return html.replace('<head>', '<head>\n' + importMap);
    },
  };
}