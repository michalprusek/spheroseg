import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=d77b29d6"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=d77b29d6"; const React = __vite__cjsImport1_react.__esModule ? __vite__cjsImport1_react.default : __vite__cjsImport1_react;
import __vite__cjsImport2_reactDom_client from "/node_modules/.vite/deps/react-dom_client.js?v=d77b29d6"; const ReactDOM = __vite__cjsImport2_reactDom_client.__esModule ? __vite__cjsImport2_reactDom_client.default : __vite__cjsImport2_reactDom_client;
import App from "/src/App.tsx?t=1747068695762";
import "/src/index.css";
import "/src/styles/tailwind.css?t=1747068695762";
import "/src/App.css";
import { Toaster } from "/node_modules/.vite/deps/sonner.js?v=d77b29d6";
import { initPerformanceMonitoring, markPerformance } from "/src/utils/performance.ts";
import logger from "/src/utils/logger.ts";
const handleError = (error) => {
  console.error("Global error:", error);
  if (error.error && error.error.stack) {
    console.error("Error stack:", error.error.stack);
  }
};
window.addEventListener("error", handleError);
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});
window.addEventListener("mouseup", () => {
  document.body.style.cursor = "";
});
try {
  markPerformance("app-init-start");
  initPerformanceMonitoring();
} catch (error) {
  logger.error("Failed to initialize performance monitoring", { error });
}
ReactDOM.createRoot(document.getElementById("root")).render(
  /* @__PURE__ */ jsxDEV(React.StrictMode, { children: [
    /* @__PURE__ */ jsxDEV(App, {}, void 0, false, {
      fileName: "/app/src/main.tsx",
      lineNumber: 45,
      columnNumber: 5
    }, this),
    /* @__PURE__ */ jsxDEV(
      Toaster,
      {
        richColors: true,
        position: "bottom-right",
        closeButton: true,
        expand: true,
        duration: 4e3,
        visibleToasts: 3,
        toastOptions: {
          className: "custom-toast",
          style: {
            padding: "var(--toast-padding)",
            borderRadius: "var(--toast-border-radius)"
          }
        }
      },
      void 0,
      false,
      {
        fileName: "/app/src/main.tsx",
        lineNumber: 46,
        columnNumber: 5
      },
      this
    )
  ] }, void 0, true, {
    fileName: "/app/src/main.tsx",
    lineNumber: 44,
    columnNumber: 3
  }, this)
);
markPerformance("app-init-end");

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBNENJO0FBMUNKLE9BQU9BLFdBQVc7QUFDbEIsT0FBT0MsY0FBYztBQUNyQixPQUFPQyxTQUFTO0FBQ2hCLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLFNBQVNDLGVBQWU7QUFDeEIsU0FBU0MsMkJBQTJCQyx1QkFBdUI7QUFDM0QsT0FBT0MsWUFBWTtBQUduQixNQUFNQyxjQUFjQSxDQUFDQyxVQUFzQjtBQUN6Q0MsVUFBUUQsTUFBTSxpQkFBaUJBLEtBQUs7QUFHcEMsTUFBSUEsTUFBTUEsU0FBU0EsTUFBTUEsTUFBTUUsT0FBTztBQUNwQ0QsWUFBUUQsTUFBTSxnQkFBZ0JBLE1BQU1BLE1BQU1FLEtBQUs7QUFBQSxFQUNqRDtBQUNGO0FBR0FDLE9BQU9DLGlCQUFpQixTQUFTTCxXQUFXO0FBQzVDSSxPQUFPQyxpQkFBaUIsc0JBQXNCLENBQUNDLFVBQVU7QUFDdkRKLFVBQVFELE1BQU0sZ0NBQWdDSyxNQUFNQyxNQUFNO0FBQzVELENBQUM7QUFHREgsT0FBT0MsaUJBQWlCLFdBQVcsTUFBTTtBQUV2Q0csV0FBU0MsS0FBS0MsTUFBTUMsU0FBUztBQUMvQixDQUFDO0FBR0QsSUFBSTtBQUNGYixrQkFBZ0IsZ0JBQWdCO0FBQ2hDRCw0QkFBMEI7QUFDNUIsU0FBU0ksT0FBTztBQUNkRixTQUFPRSxNQUFNLCtDQUErQyxFQUFFQSxNQUFNLENBQUM7QUFDdkU7QUFFQVAsU0FBU2tCLFdBQVdKLFNBQVNLLGVBQWUsTUFBTSxDQUFFLEVBQUVDO0FBQUFBLEVBQ3BELHVCQUFDLE1BQU0sWUFBTixFQUNDO0FBQUEsMkJBQUMsU0FBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQUk7QUFBQSxJQUNKO0FBQUEsTUFBQztBQUFBO0FBQUEsUUFDQztBQUFBLFFBQ0EsVUFBUztBQUFBLFFBQ1Q7QUFBQSxRQUNBLFFBQVE7QUFBQSxRQUNSLFVBQVU7QUFBQSxRQUNWLGVBQWU7QUFBQSxRQUNmLGNBQWM7QUFBQSxVQUNaQyxXQUFXO0FBQUEsVUFDWEwsT0FBTztBQUFBLFlBQ0xNLFNBQVM7QUFBQSxZQUNUQyxjQUFjO0FBQUEsVUFDaEI7QUFBQSxRQUNGO0FBQUE7QUFBQSxNQWJGO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQWFJO0FBQUEsT0FmTjtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBaUJBO0FBQ0Y7QUFHQW5CLGdCQUFnQixjQUFjIiwibmFtZXMiOlsiUmVhY3QiLCJSZWFjdERPTSIsIkFwcCIsIlRvYXN0ZXIiLCJpbml0UGVyZm9ybWFuY2VNb25pdG9yaW5nIiwibWFya1BlcmZvcm1hbmNlIiwibG9nZ2VyIiwiaGFuZGxlRXJyb3IiLCJlcnJvciIsImNvbnNvbGUiLCJzdGFjayIsIndpbmRvdyIsImFkZEV2ZW50TGlzdGVuZXIiLCJldmVudCIsInJlYXNvbiIsImRvY3VtZW50IiwiYm9keSIsInN0eWxlIiwiY3Vyc29yIiwiY3JlYXRlUm9vdCIsImdldEVsZW1lbnRCeUlkIiwicmVuZGVyIiwiY2xhc3NOYW1lIiwicGFkZGluZyIsImJvcmRlclJhZGl1cyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJtYWluLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBSZWFjdCBSb3V0ZXIgZnV0dXJlIGZsYWdzIGFyZSBzZXQgaW4gaW5kZXguaHRtbFxuXG5pbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IFJlYWN0RE9NIGZyb20gJ3JlYWN0LWRvbS9jbGllbnQnO1xuaW1wb3J0IEFwcCBmcm9tICcuL0FwcC50c3gnO1xuaW1wb3J0ICcuL2luZGV4LmNzcyc7XG5pbXBvcnQgJy4vc3R5bGVzL3RhaWx3aW5kLmNzcyc7XG5pbXBvcnQgJy4vQXBwLmNzcyc7XG5pbXBvcnQgeyBUb2FzdGVyIH0gZnJvbSAnc29ubmVyJztcbmltcG9ydCB7IGluaXRQZXJmb3JtYW5jZU1vbml0b3JpbmcsIG1hcmtQZXJmb3JtYW5jZSB9IGZyb20gJy4vdXRpbHMvcGVyZm9ybWFuY2UnO1xuaW1wb3J0IGxvZ2dlciBmcm9tICcuL3V0aWxzL2xvZ2dlcic7XG5cbi8vIEdsb2JhbCBlcnJvciBoYW5kbGVyXG5jb25zdCBoYW5kbGVFcnJvciA9IChlcnJvcjogRXJyb3JFdmVudCkgPT4ge1xuICBjb25zb2xlLmVycm9yKCdHbG9iYWwgZXJyb3I6JywgZXJyb3IpO1xuXG4gIC8vIExvZyBkZXRhaWxlZCBlcnJvciBpbmZvcm1hdGlvblxuICBpZiAoZXJyb3IuZXJyb3IgJiYgZXJyb3IuZXJyb3Iuc3RhY2spIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBzdGFjazonLCBlcnJvci5lcnJvci5zdGFjayk7XG4gIH1cbn07XG5cbi8vIEFkZCBnbG9iYWwgZXJyb3IgbGlzdGVuZXJcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsIGhhbmRsZUVycm9yKTtcbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCd1bmhhbmRsZWRyZWplY3Rpb24nLCAoZXZlbnQpID0+IHtcbiAgY29uc29sZS5lcnJvcignVW5oYW5kbGVkIHByb21pc2UgcmVqZWN0aW9uOicsIGV2ZW50LnJlYXNvbik7XG59KTtcblxuLy8gQWRkIGZhbGxiYWNrIGZvciBjdXJzb3IgcmVzZXQgaW4gY2FzZSBtb3VzZSB1cCBldmVudHMgYXJlIG1pc3NlZFxud2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCAoKSA9PiB7XG4gIC8vIFJlc2V0IGN1cnNvciBpZiBtb3VzZSB1cCBoYXBwZW5zIG91dHNpZGUgb2YgY29tcG9uZW50c1xuICBkb2N1bWVudC5ib2R5LnN0eWxlLmN1cnNvciA9ICcnO1xufSk7XG5cbi8vIEluaXRpYWxpemUgcGVyZm9ybWFuY2UgbW9uaXRvcmluZ1xudHJ5IHtcbiAgbWFya1BlcmZvcm1hbmNlKCdhcHAtaW5pdC1zdGFydCcpO1xuICBpbml0UGVyZm9ybWFuY2VNb25pdG9yaW5nKCk7XG59IGNhdGNoIChlcnJvcikge1xuICBsb2dnZXIuZXJyb3IoJ0ZhaWxlZCB0byBpbml0aWFsaXplIHBlcmZvcm1hbmNlIG1vbml0b3JpbmcnLCB7IGVycm9yIH0pO1xufVxuXG5SZWFjdERPTS5jcmVhdGVSb290KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyb290JykhKS5yZW5kZXIoXG4gIDxSZWFjdC5TdHJpY3RNb2RlPlxuICAgIDxBcHAgLz5cbiAgICA8VG9hc3RlclxuICAgICAgcmljaENvbG9yc1xuICAgICAgcG9zaXRpb249XCJib3R0b20tcmlnaHRcIlxuICAgICAgY2xvc2VCdXR0b25cbiAgICAgIGV4cGFuZD17dHJ1ZX1cbiAgICAgIGR1cmF0aW9uPXs0MDAwfVxuICAgICAgdmlzaWJsZVRvYXN0cz17M31cbiAgICAgIHRvYXN0T3B0aW9ucz17e1xuICAgICAgICBjbGFzc05hbWU6ICdjdXN0b20tdG9hc3QnLFxuICAgICAgICBzdHlsZToge1xuICAgICAgICAgIHBhZGRpbmc6ICd2YXIoLS10b2FzdC1wYWRkaW5nKScsXG4gICAgICAgICAgYm9yZGVyUmFkaXVzOiAndmFyKC0tdG9hc3QtYm9yZGVyLXJhZGl1cyknLFxuICAgICAgICB9LFxuICAgICAgfX1cbiAgICAvPlxuICA8L1JlYWN0LlN0cmljdE1vZGU+LFxuKTtcblxuLy8gTWFyayBhcHBsaWNhdGlvbiByZW5kZXJlZFxubWFya1BlcmZvcm1hbmNlKCdhcHAtaW5pdC1lbmQnKTtcbiJdLCJmaWxlIjoiL2FwcC9zcmMvbWFpbi50c3gifQ==