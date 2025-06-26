import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.tsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=d77b29d6"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("/app/src/App.tsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$(), _s2 = $RefreshSig$();
import __vite__cjsImport3_react from "/node_modules/.vite/deps/react.js?v=d77b29d6"; const Suspense = __vite__cjsImport3_react["Suspense"]; const lazy = __vite__cjsImport3_react["lazy"]; const useEffect = __vite__cjsImport3_react["useEffect"];
import { TooltipProvider } from "/src/components/ui/tooltip.tsx";
import { QueryClient, QueryClientProvider } from "/node_modules/.vite/deps/@tanstack_react-query.js?v=d77b29d6";
import {
  createBrowserRouter,
  RouterProvider,
  useRouteError,
  isRouteErrorResponse,
  Route,
  createRoutesFromElements,
  Outlet,
  useLocation
} from "/node_modules/.vite/deps/react-router-dom.js?v=d77b29d6";
import "/src/i18n.ts?t=1747068695762";
import { AuthProvider } from "/src/contexts/AuthContext.tsx";
import { LanguageProvider } from "/src/contexts/LanguageContext.tsx";
import { ThemeProvider } from "/src/contexts/ThemeContext.tsx";
import { ProfileProvider } from "/src/contexts/ProfileContext.tsx";
import { SocketProvider } from "/src/contexts/SocketContext.tsx";
import ProtectedRoute from "/src/components/ProtectedRoute.tsx";
import LoadingFallback from "/src/components/LoadingFallback.tsx";
import ErrorBoundary from "/src/components/ErrorBoundary.tsx";
import { SkipLink } from "/src/components/a11y/index.ts";
import ThemedFooter from "/src/components/ThemedFooter.tsx?t=1747068695762";
import { toast } from "/node_modules/.vite/deps/sonner.js?v=d77b29d6";
import { cleanupOldData, getDBStats } from "/src/utils/indexedDBService.ts";
import "/src/components/a11y/SkipLink.css";
const Index = lazy(
  _c = () => import("/src/pages/Index.tsx?t=1747068695762").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c2 = Index;
const SignIn = lazy(
  _c3 = () => import("/src/pages/SignIn.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c4 = SignIn;
const SignUp = lazy(
  _c5 = () => import("/src/pages/SignUp.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c6 = SignUp;
const Dashboard = lazy(
  _c7 = () => import("/src/pages/Dashboard.tsx?t=1747066726390").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c8 = Dashboard;
const ProjectDetail = lazy(_c9 = () => import("/src/pages/ProjectDetail.tsx?t=1747067405035"));
_c0 = ProjectDetail;
const SegmentationPage = lazy(
  _c1 = () => import("/src/pages/segmentation/SegmentationPage.tsx").then((module) => ({ default: module.SegmentationPage })).catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c10 = SegmentationPage;
const NotFound = lazy(_c11 = () => import("/src/pages/NotFound.tsx"));
_c12 = NotFound;
const Settings = lazy(
  _c13 = () => import("/src/pages/Settings.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c14 = Settings;
const Profile = lazy(
  _c15 = () => import("/src/pages/Profile.tsx?t=1747066481387").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c16 = Profile;
const TermsOfService = lazy(
  _c17 = () => import("/src/pages/TermsOfService.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c18 = TermsOfService;
const PrivacyPolicy = lazy(
  _c19 = () => import("/src/pages/PrivacyPolicy.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c20 = PrivacyPolicy;
const RequestAccess = lazy(
  _c21 = () => import("/src/pages/RequestAccess.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c22 = RequestAccess;
const Documentation = lazy(
  _c23 = () => import("/src/pages/Documentation.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c24 = Documentation;
const ProjectExport = lazy(
  _c25 = () => import("/src/pages/export/ProjectExport.tsx?t=1747067275989").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c26 = ProjectExport;
const ForgotPassword = lazy(
  _c27 = () => import("/src/pages/ForgotPassword.tsx").then((module) => ({ default: module.default })).catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c28 = ForgotPassword;
const SegmentationEditorRedirect = lazy(
  _c29 = () => import("/src/pages/segmentation/SegmentationEditorRedirect.tsx").catch(() => {
    return import("/src/pages/NotFound.tsx");
  })
);
_c30 = SegmentationEditorRedirect;
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 6e4
      // 1 minute (reduces unnecessary refetches)
    },
    mutations: {
      onError: () => {
        toast.error("Failed to update data. Please try again.");
      }
    }
  }
});
function RouterErrorBoundary() {
  _s();
  const error = useRouteError();
  if (isRouteErrorResponse(error)) {
    return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full", children: [
      /* @__PURE__ */ jsxDEV("h1", { className: "text-2xl font-bold text-red-600 dark:text-red-400 mb-4", children: [
        error.status,
        " ",
        error.statusText
      ] }, void 0, true, {
        fileName: "/app/src/App.tsx",
        lineNumber: 172,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-gray-700 dark:text-gray-300 mb-6", children: error.data?.message || "Something went wrong while loading this page." }, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 175,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        "a",
        {
          href: "/",
          className: "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700",
          children: "Return to Home"
        },
        void 0,
        false,
        {
          fileName: "/app/src/App.tsx",
          lineNumber: 178,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/app/src/App.tsx",
      lineNumber: 171,
      columnNumber: 9
    }, this) }, void 0, false, {
      fileName: "/app/src/App.tsx",
      lineNumber: 170,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900", children: /* @__PURE__ */ jsxDEV("div", { className: "bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full", children: [
    /* @__PURE__ */ jsxDEV("h1", { className: "text-2xl font-bold text-red-600 dark:text-red-400 mb-4", children: "Unexpected Error" }, void 0, false, {
      fileName: "/app/src/App.tsx",
      lineNumber: 192,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV("p", { className: "text-gray-700 dark:text-gray-300 mb-6", children: "Something went wrong. Please try again later." }, void 0, false, {
      fileName: "/app/src/App.tsx",
      lineNumber: 193,
      columnNumber: 9
    }, this),
    /* @__PURE__ */ jsxDEV(
      "a",
      {
        href: "/",
        className: "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-700",
        children: "Return to Home"
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 194,
        columnNumber: 9
      },
      this
    )
  ] }, void 0, true, {
    fileName: "/app/src/App.tsx",
    lineNumber: 191,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 190,
    columnNumber: 5
  }, this);
}
_s(RouterErrorBoundary, "oAgjgbJzsRXlB89+MoVumxMQqKM=", false, function() {
  return [useRouteError];
});
_c31 = RouterErrorBoundary;
const AppLayout = () => {
  _s2();
  const location = useLocation();
  const noFooterPages = [
    "/sign-in",
    "/sign-up",
    "/request-access",
    "/dashboard",
    "/project",
    "/projects",
    "/settings",
    "/profile"
  ];
  const shouldShowFooter = !noFooterPages.some((page) => location.pathname.startsWith(page));
  useEffect(() => {
    const cleanupStorage = async () => {
      try {
        const statsBefore = await getDBStats();
        console.log("IndexedDB stats before cleanup:", statsBefore);
        const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1e3;
        await cleanupOldData(THREE_DAYS_MS);
        const statsAfter = await getDBStats();
        console.log("IndexedDB stats after cleanup:", statsAfter);
        const freedSpace = statsBefore.totalSize - statsAfter.totalSize;
        if (freedSpace > 10 * 1024 * 1024) {
          toast.info(`Vyčištěno ${(freedSpace / (1024 * 1024)).toFixed(1)} MB starých dat z mezipaměti.`);
        }
      } catch (error) {
        console.error("Error during storage cleanup:", error);
      }
    };
    cleanupStorage();
    const cleanupInterval = setInterval(cleanupStorage, 24 * 60 * 60 * 1e3);
    return () => clearInterval(cleanupInterval);
  }, []);
  return /* @__PURE__ */ jsxDEV(AuthProvider, { children: /* @__PURE__ */ jsxDEV(LanguageProvider, { children: /* @__PURE__ */ jsxDEV(ThemeProvider, { children: /* @__PURE__ */ jsxDEV(ProfileProvider, { children: /* @__PURE__ */ jsxDEV(SocketProvider, { children: [
    /* @__PURE__ */ jsxDEV(SkipLink, { targetId: "main-content" }, void 0, false, {
      fileName: "/app/src/App.tsx",
      lineNumber: 265,
      columnNumber: 15
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "app-container animate-fade-in flex flex-col min-h-screen", children: [
      /* @__PURE__ */ jsxDEV("main", { id: "main-content", tabIndex: -1, className: "flex-grow", children: /* @__PURE__ */ jsxDEV(Suspense, { fallback: /* @__PURE__ */ jsxDEV(LoadingFallback, {}, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 269,
        columnNumber: 39
      }, this), children: /* @__PURE__ */ jsxDEV("div", { className: "outlet-wrapper", style: { minHeight: "50vh" }, children: /* @__PURE__ */ jsxDEV(Outlet, {}, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 272,
        columnNumber: 23
      }, this) }, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 271,
        columnNumber: 21
      }, this) }, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 269,
        columnNumber: 19
      }, this) }, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 268,
        columnNumber: 17
      }, this),
      shouldShowFooter && /* @__PURE__ */ jsxDEV(ThemedFooter, {}, void 0, false, {
        fileName: "/app/src/App.tsx",
        lineNumber: 276,
        columnNumber: 38
      }, this)
    ] }, void 0, true, {
      fileName: "/app/src/App.tsx",
      lineNumber: 267,
      columnNumber: 15
    }, this)
  ] }, void 0, true, {
    fileName: "/app/src/App.tsx",
    lineNumber: 264,
    columnNumber: 13
  }, this) }, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 263,
    columnNumber: 11
  }, this) }, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 262,
    columnNumber: 9
  }, this) }, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 261,
    columnNumber: 7
  }, this) }, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 260,
    columnNumber: 5
  }, this);
};
_s2(AppLayout, "BXcZrDMM76mmm4zA8/QV5UbMNXE=", false, function() {
  return [useLocation];
});
_c32 = AppLayout;
const routes = createRoutesFromElements(
  /* @__PURE__ */ jsxDEV(Route, { element: /* @__PURE__ */ jsxDEV(AppLayout, {}, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 288,
    columnNumber: 19
  }, this), errorElement: /* @__PURE__ */ jsxDEV(RouterErrorBoundary, {}, void 0, false, {
    fileName: "/app/src/App.tsx",
    lineNumber: 288,
    columnNumber: 48
  }, this), children: [
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "IndexPage", children: /* @__PURE__ */ jsxDEV(Index, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 293,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 292,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 289,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/sign-in",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "SignInPage", children: /* @__PURE__ */ jsxDEV(SignIn, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 301,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 300,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 297,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/sign-up",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "SignUpPage", children: /* @__PURE__ */ jsxDEV(SignUp, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 309,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 308,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 305,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/documentation",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "DocumentationPage", children: /* @__PURE__ */ jsxDEV(Documentation, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 317,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 316,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 313,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/terms-of-service",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "TermsOfServicePage", children: /* @__PURE__ */ jsxDEV(TermsOfService, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 325,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 324,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 321,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/privacy-policy",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "PrivacyPolicyPage", children: /* @__PURE__ */ jsxDEV(PrivacyPolicy, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 333,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 332,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 329,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/request-access",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "RequestAccessPage", children: /* @__PURE__ */ jsxDEV(RequestAccess, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 341,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 340,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 337,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/forgot-password",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "ForgotPasswordPage", children: /* @__PURE__ */ jsxDEV(Suspense, { fallback: /* @__PURE__ */ jsxDEV(LoadingFallback, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 349,
          columnNumber: 31
        }, this), children: /* @__PURE__ */ jsxDEV(ForgotPassword, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 350,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 349,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 348,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 345,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/dashboard",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "DashboardPage", children: /* @__PURE__ */ jsxDEV(Dashboard, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 360,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 359,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 358,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 355,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/project/:id",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "ProjectDetailPage", children: /* @__PURE__ */ jsxDEV(ProjectDetail, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 371,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 370,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 369,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 366,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/projects/:id",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "ProjectDetailPage", children: /* @__PURE__ */ jsxDEV(ProjectDetail, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 382,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 381,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 380,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 377,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/projects/:projectId/segmentation/:imageId",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "SegmentationPage", children: /* @__PURE__ */ jsxDEV(SegmentationPage, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 392,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 391,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 390,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 387,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/projects/:projectId/editor/:imageId",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "SegmentationEditorRedirect", children: /* @__PURE__ */ jsxDEV(Suspense, { fallback: /* @__PURE__ */ jsxDEV(LoadingFallback, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 403,
          columnNumber: 33
        }, this), children: /* @__PURE__ */ jsxDEV(SegmentationEditorRedirect, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 404,
          columnNumber: 15
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 403,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 402,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 401,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 398,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/project/:id/export",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "ProjectExportPage", children: /* @__PURE__ */ jsxDEV(ProjectExport, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 415,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 414,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 413,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 410,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/settings",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "SettingsPage", children: /* @__PURE__ */ jsxDEV(Settings, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 425,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 424,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 423,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 420,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "/profile",
        element: /* @__PURE__ */ jsxDEV(ProtectedRoute, { children: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "ProfilePage", children: /* @__PURE__ */ jsxDEV(Profile, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 435,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 434,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 433,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 430,
        columnNumber: 5
      },
      this
    ),
    /* @__PURE__ */ jsxDEV(
      Route,
      {
        path: "*",
        element: /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "NotFoundPage", children: /* @__PURE__ */ jsxDEV(Suspense, { fallback: /* @__PURE__ */ jsxDEV(LoadingFallback, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 445,
          columnNumber: 31
        }, this), children: /* @__PURE__ */ jsxDEV(NotFound, {}, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 446,
          columnNumber: 13
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 445,
          columnNumber: 11
        }, this) }, void 0, false, {
          fileName: "/app/src/App.tsx",
          lineNumber: 444,
          columnNumber: 7
        }, this)
      },
      void 0,
      false,
      {
        fileName: "/app/src/App.tsx",
        lineNumber: 441,
        columnNumber: 5
      },
      this
    )
  ] }, void 0, true, {
    fileName: "/app/src/App.tsx",
    lineNumber: 288,
    columnNumber: 3
  }, this)
);
const router = createBrowserRouter(routes, {
  future: {
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true
  }
});
const App = () => /* @__PURE__ */ jsxDEV(ErrorBoundary, { componentName: "App", resetOnPropsChange: true, children: /* @__PURE__ */ jsxDEV(QueryClientProvider, { client: queryClient, children: /* @__PURE__ */ jsxDEV(TooltipProvider, { children: /* @__PURE__ */ jsxDEV(RouterProvider, { router }, void 0, false, {
  fileName: "/app/src/App.tsx",
  lineNumber: 466,
  columnNumber: 9
}, this) }, void 0, false, {
  fileName: "/app/src/App.tsx",
  lineNumber: 465,
  columnNumber: 7
}, this) }, void 0, false, {
  fileName: "/app/src/App.tsx",
  lineNumber: 464,
  columnNumber: 5
}, this) }, void 0, false, {
  fileName: "/app/src/App.tsx",
  lineNumber: 463,
  columnNumber: 1
}, this);
_c33 = App;
export default App;
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18, _c19, _c20, _c21, _c22, _c23, _c24, _c25, _c26, _c27, _c28, _c29, _c30, _c31, _c32, _c33;
$RefreshReg$(_c, "Index$lazy");
$RefreshReg$(_c2, "Index");
$RefreshReg$(_c3, "SignIn$lazy");
$RefreshReg$(_c4, "SignIn");
$RefreshReg$(_c5, "SignUp$lazy");
$RefreshReg$(_c6, "SignUp");
$RefreshReg$(_c7, "Dashboard$lazy");
$RefreshReg$(_c8, "Dashboard");
$RefreshReg$(_c9, "ProjectDetail$lazy");
$RefreshReg$(_c0, "ProjectDetail");
$RefreshReg$(_c1, "SegmentationPage$lazy");
$RefreshReg$(_c10, "SegmentationPage");
$RefreshReg$(_c11, "NotFound$lazy");
$RefreshReg$(_c12, "NotFound");
$RefreshReg$(_c13, "Settings$lazy");
$RefreshReg$(_c14, "Settings");
$RefreshReg$(_c15, "Profile$lazy");
$RefreshReg$(_c16, "Profile");
$RefreshReg$(_c17, "TermsOfService$lazy");
$RefreshReg$(_c18, "TermsOfService");
$RefreshReg$(_c19, "PrivacyPolicy$lazy");
$RefreshReg$(_c20, "PrivacyPolicy");
$RefreshReg$(_c21, "RequestAccess$lazy");
$RefreshReg$(_c22, "RequestAccess");
$RefreshReg$(_c23, "Documentation$lazy");
$RefreshReg$(_c24, "Documentation");
$RefreshReg$(_c25, "ProjectExport$lazy");
$RefreshReg$(_c26, "ProjectExport");
$RefreshReg$(_c27, "ForgotPassword$lazy");
$RefreshReg$(_c28, "ForgotPassword");
$RefreshReg$(_c29, "SegmentationEditorRedirect$lazy");
$RefreshReg$(_c30, "SegmentationEditorRedirect");
$RefreshReg$(_c31, "RouterErrorBoundary");
$RefreshReg$(_c32, "AppLayout");
$RefreshReg$(_c33, "App");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("/app/src/App.tsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("/app/src/App.tsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,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QUFBQWdDLGFBQUFSLE1BQUE7QUFBQVEsYUFBQUQsTUFBQSIsIm5hbWVzIjpbIlN1c3BlbnNlIiwibGF6eSIsInVzZUVmZmVjdCIsIlRvb2x0aXBQcm92aWRlciIsIlF1ZXJ5Q2xpZW50IiwiUXVlcnlDbGllbnRQcm92aWRlciIsImNyZWF0ZUJyb3dzZXJSb3V0ZXIiLCJSb3V0ZXJQcm92aWRlciIsInVzZVJvdXRlRXJyb3IiLCJpc1JvdXRlRXJyb3JSZXNwb25zZSIsIlJvdXRlIiwiY3JlYXRlUm91dGVzRnJvbUVsZW1lbnRzIiwiT3V0bGV0IiwidXNlTG9jYXRpb24iLCJBdXRoUHJvdmlkZXIiLCJMYW5ndWFnZVByb3ZpZGVyIiwiVGhlbWVQcm92aWRlciIsIlByb2ZpbGVQcm92aWRlciIsIlNvY2tldFByb3ZpZGVyIiwiUHJvdGVjdGVkUm91dGUiLCJMb2FkaW5nRmFsbGJhY2siLCJFcnJvckJvdW5kYXJ5IiwiU2tpcExpbmsiLCJUaGVtZWRGb290ZXIiLCJ0b2FzdCIsImNsZWFudXBPbGREYXRhIiwiZ2V0REJTdGF0cyIsIkluZGV4IiwiX2MiLCJjYXRjaCIsIl9jMiIsIlNpZ25JbiIsIl9jMyIsIl9jNCIsIlNpZ25VcCIsIl9jNSIsIl9jNiIsIkRhc2hib2FyZCIsIl9jNyIsIl9jOCIsIlByb2plY3REZXRhaWwiLCJfYzkiLCJfYzAiLCJTZWdtZW50YXRpb25QYWdlIiwiX2MxIiwidGhlbiIsIm1vZHVsZSIsImRlZmF1bHQiLCJfYzEwIiwiTm90Rm91bmQiLCJfYzExIiwiX2MxMiIsIlNldHRpbmdzIiwiX2MxMyIsIl9jMTQiLCJQcm9maWxlIiwiX2MxNSIsIl9jMTYiLCJUZXJtc09mU2VydmljZSIsIl9jMTciLCJfYzE4IiwiUHJpdmFjeVBvbGljeSIsIl9jMTkiLCJfYzIwIiwiUmVxdWVzdEFjY2VzcyIsIl9jMjEiLCJfYzIyIiwiRG9jdW1lbnRhdGlvbiIsIl9jMjMiLCJfYzI0IiwiUHJvamVjdEV4cG9ydCIsIl9jMjUiLCJfYzI2IiwiRm9yZ290UGFzc3dvcmQiLCJfYzI3IiwiX2MyOCIsIlNlZ21lbnRhdGlvbkVkaXRvclJlZGlyZWN0IiwiX2MyOSIsIl9jMzAiLCJxdWVyeUNsaWVudCIsImRlZmF1bHRPcHRpb25zIiwicXVlcmllcyIsInJlZmV0Y2hPbldpbmRvd0ZvY3VzIiwicmV0cnkiLCJzdGFsZVRpbWUiLCJtdXRhdGlvbnMiLCJvbkVycm9yIiwiZXJyb3IiLCJSb3V0ZXJFcnJvckJvdW5kYXJ5IiwiX3MiLCJzdGF0dXMiLCJzdGF0dXNUZXh0IiwiZGF0YSIsIm1lc3NhZ2UiLCJfYzMxIiwiQXBwTGF5b3V0IiwiX3MyIiwibG9jYXRpb24iLCJub0Zvb3RlclBhZ2VzIiwic2hvdWxkU2hvd0Zvb3RlciIsInNvbWUiLCJwYWdlIiwicGF0aG5hbWUiLCJzdGFydHNXaXRoIiwiY2xlYW51cFN0b3JhZ2UiLCJzdGF0c0JlZm9yZSIsImNvbnNvbGUiLCJsb2ciLCJUSFJFRV9EQVlTX01TIiwic3RhdHNBZnRlciIsImZyZWVkU3BhY2UiLCJ0b3RhbFNpemUiLCJpbmZvIiwidG9GaXhlZCIsImNsZWFudXBJbnRlcnZhbCIsInNldEludGVydmFsIiwiY2xlYXJJbnRlcnZhbCIsIm1pbkhlaWdodCIsIl9jMzIiLCJyb3V0ZXMiLCJyb3V0ZXIiLCJmdXR1cmUiLCJ2N19yZWxhdGl2ZVNwbGF0UGF0aCIsInY3X25vcm1hbGl6ZUZvcm1NZXRob2QiLCJBcHAiLCJfYzMzIiwiJFJlZnJlc2hSZWckIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkFwcC50c3giXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU3VzcGVuc2UsIGxhenksIHVzZUVmZmVjdCB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IFRvb2x0aXBQcm92aWRlciB9IGZyb20gJ0AvY29tcG9uZW50cy91aS90b29sdGlwJztcbmltcG9ydCB7IFF1ZXJ5Q2xpZW50LCBRdWVyeUNsaWVudFByb3ZpZGVyIH0gZnJvbSAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5JztcbmltcG9ydCB7XG4gIGNyZWF0ZUJyb3dzZXJSb3V0ZXIsXG4gIFJvdXRlclByb3ZpZGVyLFxuICB1c2VSb3V0ZUVycm9yLFxuICBpc1JvdXRlRXJyb3JSZXNwb25zZSxcbiAgUm91dGUsXG4gIGNyZWF0ZVJvdXRlc0Zyb21FbGVtZW50cyxcbiAgT3V0bGV0LFxuICB1c2VMb2NhdGlvbixcbn0gZnJvbSAncmVhY3Qtcm91dGVyLWRvbSc7XG5cbi8vIGkxOG5cbmltcG9ydCAnLi9pMThuJztcblxuaW1wb3J0IHsgQXV0aFByb3ZpZGVyIH0gZnJvbSAnQC9jb250ZXh0cy9BdXRoQ29udGV4dCc7XG5pbXBvcnQgeyBMYW5ndWFnZVByb3ZpZGVyIH0gZnJvbSAnQC9jb250ZXh0cy9MYW5ndWFnZUNvbnRleHQnO1xuaW1wb3J0IHsgVGhlbWVQcm92aWRlciB9IGZyb20gJ0AvY29udGV4dHMvVGhlbWVDb250ZXh0JztcbmltcG9ydCB7IFByb2ZpbGVQcm92aWRlciB9IGZyb20gJ0AvY29udGV4dHMvUHJvZmlsZUNvbnRleHQnO1xuaW1wb3J0IHsgU29ja2V0UHJvdmlkZXIgfSBmcm9tICdAL2NvbnRleHRzL1NvY2tldENvbnRleHQnO1xuaW1wb3J0IFByb3RlY3RlZFJvdXRlIGZyb20gJ0AvY29tcG9uZW50cy9Qcm90ZWN0ZWRSb3V0ZSc7XG5pbXBvcnQgTG9hZGluZ0ZhbGxiYWNrIGZyb20gJy4vY29tcG9uZW50cy9Mb2FkaW5nRmFsbGJhY2snO1xuaW1wb3J0IEVycm9yQm91bmRhcnkgZnJvbSAnLi9jb21wb25lbnRzL0Vycm9yQm91bmRhcnknO1xuaW1wb3J0IHsgU2tpcExpbmsgfSBmcm9tICcuL2NvbXBvbmVudHMvYTExeSc7XG5pbXBvcnQgVGhlbWVkRm9vdGVyIGZyb20gJy4vY29tcG9uZW50cy9UaGVtZWRGb290ZXInO1xuaW1wb3J0IHsgdG9hc3QgfSBmcm9tICdzb25uZXInO1xuXG4vLyBJbXBvcnQgSW5kZXhlZERCIHNlcnZpY2UgZm9yIGNsZWFudXBcbmltcG9ydCB7IGNsZWFudXBPbGREYXRhLCBnZXREQlN0YXRzIH0gZnJvbSAnLi91dGlscy9pbmRleGVkREJTZXJ2aWNlJztcblxuLy8gSW1wb3J0IGFjY2Vzc2liaWxpdHkgQ1NTXG5pbXBvcnQgJy4vY29tcG9uZW50cy9hMTF5L1NraXBMaW5rLmNzcyc7XG5cbi8vIExhenkgbG9hZCBjb21wb25lbnRzIHdpdGggaW1wcm92ZWQgZXJyb3IgaGFuZGxpbmdcbmNvbnN0IEluZGV4ID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvSW5kZXgnKS5jYXRjaCgoKSA9PiB7XG4gICAgLy8gRXJyb3IgaGFuZGxlZCBieSByZXR1cm5pbmcgTm90Rm91bmQgcGFnZVxuICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgfSksXG4pO1xuY29uc3QgU2lnbkluID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvU2lnbkluJykuY2F0Y2goKCkgPT4ge1xuICAgIC8vIEVycm9yIGhhbmRsZWQgYnkgcmV0dXJuaW5nIE5vdEZvdW5kIHBhZ2VcbiAgICByZXR1cm4gaW1wb3J0KCcuL3BhZ2VzL05vdEZvdW5kJyk7XG4gIH0pLFxuKTtcbmNvbnN0IFNpZ25VcCA9IGxhenkoKCkgPT5cbiAgaW1wb3J0KCcuL3BhZ2VzL1NpZ25VcCcpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5jb25zdCBEYXNoYm9hcmQgPSBsYXp5KCgpID0+XG4gIGltcG9ydCgnLi9wYWdlcy9EYXNoYm9hcmQnKS5jYXRjaCgoKSA9PiB7XG4gICAgLy8gRXJyb3IgaGFuZGxlZCBieSByZXR1cm5pbmcgTm90Rm91bmQgcGFnZVxuICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgfSksXG4pO1xuY29uc3QgUHJvamVjdERldGFpbCA9IGxhenkoKCkgPT4gaW1wb3J0KCcuL3BhZ2VzL1Byb2plY3REZXRhaWwnKSk7XG5jb25zdCBTZWdtZW50YXRpb25QYWdlID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvc2VnbWVudGF0aW9uL1NlZ21lbnRhdGlvblBhZ2UnKVxuICAgIC50aGVuKChtb2R1bGUpID0+ICh7IGRlZmF1bHQ6IG1vZHVsZS5TZWdtZW50YXRpb25QYWdlIH0pKVxuICAgIC5jYXRjaCgoKSA9PiB7XG4gICAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgICByZXR1cm4gaW1wb3J0KCcuL3BhZ2VzL05vdEZvdW5kJyk7XG4gICAgfSksXG4pO1xuY29uc3QgTm90Rm91bmQgPSBsYXp5KCgpID0+IGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpKTtcbmNvbnN0IFNldHRpbmdzID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvU2V0dGluZ3MnKS5jYXRjaCgoKSA9PiB7XG4gICAgLy8gRXJyb3IgaGFuZGxlZCBieSByZXR1cm5pbmcgTm90Rm91bmQgcGFnZVxuICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgfSksXG4pO1xuY29uc3QgUHJvZmlsZSA9IGxhenkoKCkgPT5cbiAgaW1wb3J0KCcuL3BhZ2VzL1Byb2ZpbGUnKS5jYXRjaCgoKSA9PiB7XG4gICAgLy8gRXJyb3IgaGFuZGxlZCBieSByZXR1cm5pbmcgTm90Rm91bmQgcGFnZVxuICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgfSksXG4pO1xuY29uc3QgVGVybXNPZlNlcnZpY2UgPSBsYXp5KCgpID0+XG4gIGltcG9ydCgnLi9wYWdlcy9UZXJtc09mU2VydmljZScpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5jb25zdCBQcml2YWN5UG9saWN5ID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvUHJpdmFjeVBvbGljeScpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5jb25zdCBSZXF1ZXN0QWNjZXNzID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvUmVxdWVzdEFjY2VzcycpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5jb25zdCBEb2N1bWVudGF0aW9uID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvRG9jdW1lbnRhdGlvbicpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5jb25zdCBQcm9qZWN0RXhwb3J0ID0gbGF6eSgoKSA9PlxuICBpbXBvcnQoJy4vcGFnZXMvZXhwb3J0L1Byb2plY3RFeHBvcnQnKS5jYXRjaCgoKSA9PiB7XG4gICAgLy8gRXJyb3IgaGFuZGxlZCBieSByZXR1cm5pbmcgTm90Rm91bmQgcGFnZVxuICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgfSksXG4pO1xuY29uc3QgRm9yZ290UGFzc3dvcmQgPSBsYXp5KCgpID0+XG4gIGltcG9ydCgnLi9wYWdlcy9Gb3Jnb3RQYXNzd29yZCcpXG4gICAgLnRoZW4oKG1vZHVsZSkgPT4gKHsgZGVmYXVsdDogbW9kdWxlLmRlZmF1bHQgfSkpXG4gICAgLmNhdGNoKCgpID0+IHtcbiAgICAgIC8vIEVycm9yIGhhbmRsZWQgYnkgcmV0dXJuaW5nIE5vdEZvdW5kIHBhZ2VcbiAgICAgIHJldHVybiBpbXBvcnQoJy4vcGFnZXMvTm90Rm91bmQnKTtcbiAgICB9KSxcbik7XG5jb25zdCBTZWdtZW50YXRpb25FZGl0b3JSZWRpcmVjdCA9IGxhenkoKCkgPT5cbiAgaW1wb3J0KCcuL3BhZ2VzL3NlZ21lbnRhdGlvbi9TZWdtZW50YXRpb25FZGl0b3JSZWRpcmVjdCcpLmNhdGNoKCgpID0+IHtcbiAgICAvLyBFcnJvciBoYW5kbGVkIGJ5IHJldHVybmluZyBOb3RGb3VuZCBwYWdlXG4gICAgcmV0dXJuIGltcG9ydCgnLi9wYWdlcy9Ob3RGb3VuZCcpO1xuICB9KSxcbik7XG5cbi8vIENyZWF0ZSBhIGNsaWVudCBmb3IgUmVhY3QgUXVlcnlcbmNvbnN0IHF1ZXJ5Q2xpZW50ID0gbmV3IFF1ZXJ5Q2xpZW50KHtcbiAgZGVmYXVsdE9wdGlvbnM6IHtcbiAgICBxdWVyaWVzOiB7XG4gICAgICByZWZldGNoT25XaW5kb3dGb2N1czogZmFsc2UsXG4gICAgICByZXRyeTogMSxcbiAgICAgIHN0YWxlVGltZTogNjAwMDAsIC8vIDEgbWludXRlIChyZWR1Y2VzIHVubmVjZXNzYXJ5IHJlZmV0Y2hlcylcbiAgICB9LFxuICAgIG11dGF0aW9uczoge1xuICAgICAgb25FcnJvcjogKCkgPT4ge1xuICAgICAgICAvLyBEaXNwbGF5IGVycm9yIHRvIHRoZSB1c2VyIHZpYSB0b2FzdCBub3RpZmljYXRpb25cbiAgICAgICAgdG9hc3QuZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgZGF0YS4gUGxlYXNlIHRyeSBhZ2Fpbi4nKTtcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pO1xuXG4vLyBSb3V0ZXIgZXJyb3IgYm91bmRhcnkgY29tcG9uZW50XG5mdW5jdGlvbiBSb3V0ZXJFcnJvckJvdW5kYXJ5KCkge1xuICBjb25zdCBlcnJvciA9IHVzZVJvdXRlRXJyb3IoKTtcblxuICBpZiAoaXNSb3V0ZUVycm9yUmVzcG9uc2UoZXJyb3IpKSB7XG4gICAgcmV0dXJuIChcbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLWgtc2NyZWVuIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIGJnLWdyYXktMTAwIGRhcms6YmctZ3JheS05MDBcIj5cbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJiZy13aGl0ZSBkYXJrOmJnLWdyYXktODAwIHAtOCByb3VuZGVkLWxnIHNoYWRvdy1sZyBtYXgtdy1tZCB3LWZ1bGxcIj5cbiAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtcmVkLTYwMCBkYXJrOnRleHQtcmVkLTQwMCBtYi00XCI+XG4gICAgICAgICAgICB7ZXJyb3Iuc3RhdHVzfSB7ZXJyb3Iuc3RhdHVzVGV4dH1cbiAgICAgICAgICA8L2gxPlxuICAgICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS03MDAgZGFyazp0ZXh0LWdyYXktMzAwIG1iLTZcIj5cbiAgICAgICAgICAgIHtlcnJvci5kYXRhPy5tZXNzYWdlIHx8ICdTb21ldGhpbmcgd2VudCB3cm9uZyB3aGlsZSBsb2FkaW5nIHRoaXMgcGFnZS4nfVxuICAgICAgICAgIDwvcD5cbiAgICAgICAgICA8YVxuICAgICAgICAgICAgaHJlZj1cIi9cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiaW5saW5lLWZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgYmctYmx1ZS02MDAgcHgtNCBweS0yIHRleHQtc20gZm9udC1tZWRpdW0gdGV4dC13aGl0ZSBzaGFkb3cgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6YmctYmx1ZS03MDAgZm9jdXMtdmlzaWJsZTpvdXRsaW5lLW5vbmUgZm9jdXMtdmlzaWJsZTpyaW5nLTEgZm9jdXMtdmlzaWJsZTpyaW5nLWJsdWUtNzAwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICBSZXR1cm4gdG8gSG9tZVxuICAgICAgICAgIDwvYT5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICApO1xuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLXNjcmVlbiBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBiZy1ncmF5LTEwMCBkYXJrOmJnLWdyYXktOTAwXCI+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImJnLXdoaXRlIGRhcms6YmctZ3JheS04MDAgcC04IHJvdW5kZWQtbGcgc2hhZG93LWxnIG1heC13LW1kIHctZnVsbFwiPlxuICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC0yeGwgZm9udC1ib2xkIHRleHQtcmVkLTYwMCBkYXJrOnRleHQtcmVkLTQwMCBtYi00XCI+VW5leHBlY3RlZCBFcnJvcjwvaDE+XG4gICAgICAgIDxwIGNsYXNzTmFtZT1cInRleHQtZ3JheS03MDAgZGFyazp0ZXh0LWdyYXktMzAwIG1iLTZcIj5Tb21ldGhpbmcgd2VudCB3cm9uZy4gUGxlYXNlIHRyeSBhZ2FpbiBsYXRlci48L3A+XG4gICAgICAgIDxhXG4gICAgICAgICAgaHJlZj1cIi9cIlxuICAgICAgICAgIGNsYXNzTmFtZT1cImlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIGJnLWJsdWUtNjAwIHB4LTQgcHktMiB0ZXh0LXNtIGZvbnQtbWVkaXVtIHRleHQtd2hpdGUgc2hhZG93IHRyYW5zaXRpb24tY29sb3JzIGhvdmVyOmJnLWJsdWUtNzAwIGZvY3VzLXZpc2libGU6b3V0bGluZS1ub25lIGZvY3VzLXZpc2libGU6cmluZy0xIGZvY3VzLXZpc2libGU6cmluZy1ibHVlLTcwMFwiXG4gICAgICAgID5cbiAgICAgICAgICBSZXR1cm4gdG8gSG9tZVxuICAgICAgICA8L2E+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn1cblxuLy8gTGF5b3V0IGNvbXBvbmVudCB0byB3cmFwIGFsbCByb3V0ZXNcbmNvbnN0IEFwcExheW91dCA9ICgpID0+IHtcbiAgLy8gVXNlIGxvY2F0aW9uIHRvIGNvbmRpdGlvbmFsbHkgcmVuZGVyIHRoZSBmb290ZXJcbiAgY29uc3QgbG9jYXRpb24gPSB1c2VMb2NhdGlvbigpO1xuXG4gIC8vIFBhZ2VzIHRoYXQgc2hvdWxkIG5vdCBoYXZlIGEgZm9vdGVyIC0gaW5jbHVkZXMgYWxsIHBvc3QtbG9naW4gcGFnZXNcbiAgY29uc3Qgbm9Gb290ZXJQYWdlcyA9IFtcbiAgICAnL3NpZ24taW4nLFxuICAgICcvc2lnbi11cCcsXG4gICAgJy9yZXF1ZXN0LWFjY2VzcycsXG4gICAgJy9kYXNoYm9hcmQnLFxuICAgICcvcHJvamVjdCcsXG4gICAgJy9wcm9qZWN0cycsXG4gICAgJy9zZXR0aW5ncycsXG4gICAgJy9wcm9maWxlJyxcbiAgXTtcbiAgY29uc3Qgc2hvdWxkU2hvd0Zvb3RlciA9ICFub0Zvb3RlclBhZ2VzLnNvbWUoKHBhZ2UpID0+IGxvY2F0aW9uLnBhdGhuYW1lLnN0YXJ0c1dpdGgocGFnZSkpO1xuXG4gIC8vIEF1dG9tYXRpY2vDqSDEjWnFoXTEm27DrSBzdGFyw71jaCBkYXQgcMWZaSBzcHXFoXTEm27DrSBhcGxpa2FjZVxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGNsZWFudXBTdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgLy8gWsOtc2vDoW1lIHN0YXRpc3Rpa3kgcMWZZWQgxI1pxaF0xJtuw61tXG4gICAgICAgIGNvbnN0IHN0YXRzQmVmb3JlID0gYXdhaXQgZ2V0REJTdGF0cygpO1xuICAgICAgICBjb25zb2xlLmxvZygnSW5kZXhlZERCIHN0YXRzIGJlZm9yZSBjbGVhbnVwOicsIHN0YXRzQmVmb3JlKTtcblxuICAgICAgICAvLyBWecSNaXN0w61tZSBzdGFyw6EgZGF0YSAoc3RhcsWhw60gbmXFviAzIGRueSlcbiAgICAgICAgY29uc3QgVEhSRUVfREFZU19NUyA9IDMgKiAyNCAqIDYwICogNjAgKiAxMDAwO1xuICAgICAgICBhd2FpdCBjbGVhbnVwT2xkRGF0YShUSFJFRV9EQVlTX01TKTtcblxuICAgICAgICAvLyBaw61za8OhbWUgc3RhdGlzdGlreSBwbyDEjWnFoXTEm27DrVxuICAgICAgICBjb25zdCBzdGF0c0FmdGVyID0gYXdhaXQgZ2V0REJTdGF0cygpO1xuICAgICAgICBjb25zb2xlLmxvZygnSW5kZXhlZERCIHN0YXRzIGFmdGVyIGNsZWFudXA6Jywgc3RhdHNBZnRlcik7XG5cbiAgICAgICAgLy8gUG9rdWQgYnlsbyB2ecSNacWhdMSbbm8gaG9kbsSbIGRhdCwgaW5mb3JtdWplbWUgdcW+aXZhdGVsZVxuICAgICAgICBjb25zdCBmcmVlZFNwYWNlID0gc3RhdHNCZWZvcmUudG90YWxTaXplIC0gc3RhdHNBZnRlci50b3RhbFNpemU7XG4gICAgICAgIGlmIChmcmVlZFNwYWNlID4gMTAgKiAxMDI0ICogMTAyNCkgeyAvLyBWw61jZSBuZcW+IDEwIE1CXG4gICAgICAgICAgdG9hc3QuaW5mbyhgVnnEjWnFoXTEm25vICR7KGZyZWVkU3BhY2UgLyAoMTAyNCAqIDEwMjQpKS50b0ZpeGVkKDEpfSBNQiBzdGFyw71jaCBkYXQgeiBtZXppcGFtxJt0aS5gKTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignRXJyb3IgZHVyaW5nIHN0b3JhZ2UgY2xlYW51cDonLCBlcnJvcik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFNwdXN0w61tZSDEjWnFoXTEm27DrSBwbyBuYcSNdGVuw60gYXBsaWthY2VcbiAgICBjbGVhbnVwU3RvcmFnZSgpO1xuXG4gICAgLy8gTmFzdGF2w61tZSBpbnRlcnZhbCBwcm8gcHJhdmlkZWxuw6kgxI1pxaF0xJtuw60gKGthxb5kw71jaCAyNCBob2RpbilcbiAgICBjb25zdCBjbGVhbnVwSW50ZXJ2YWwgPSBzZXRJbnRlcnZhbChjbGVhbnVwU3RvcmFnZSwgMjQgKiA2MCAqIDYwICogMTAwMCk7XG5cbiAgICAvLyBVa2xpZMOtbWUgaW50ZXJ2YWwgcMWZaSB1bm1vdW50XG4gICAgcmV0dXJuICgpID0+IGNsZWFySW50ZXJ2YWwoY2xlYW51cEludGVydmFsKTtcbiAgfSwgW10pO1xuXG4gIHJldHVybiAoXG4gICAgPEF1dGhQcm92aWRlcj5cbiAgICAgIDxMYW5ndWFnZVByb3ZpZGVyPlxuICAgICAgICA8VGhlbWVQcm92aWRlcj5cbiAgICAgICAgICA8UHJvZmlsZVByb3ZpZGVyPlxuICAgICAgICAgICAgPFNvY2tldFByb3ZpZGVyPlxuICAgICAgICAgICAgICA8U2tpcExpbmsgdGFyZ2V0SWQ9XCJtYWluLWNvbnRlbnRcIiAvPlxuICAgICAgICAgICAgICB7LyogSG90IHJlbG9hZCB0ZXN0IC0gdGhpcyBjb21tZW50IHNob3VsZCBiZSB1cGRhdGVkIHdoZW4gdGhlIGZpbGUgaXMgc2F2ZWQgKi99XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYXBwLWNvbnRhaW5lciBhbmltYXRlLWZhZGUtaW4gZmxleCBmbGV4LWNvbCBtaW4taC1zY3JlZW5cIj5cbiAgICAgICAgICAgICAgICA8bWFpbiBpZD1cIm1haW4tY29udGVudFwiIHRhYkluZGV4PXstMX0gY2xhc3NOYW1lPVwiZmxleC1ncm93XCI+XG4gICAgICAgICAgICAgICAgICA8U3VzcGVuc2UgZmFsbGJhY2s9ezxMb2FkaW5nRmFsbGJhY2sgLz59PlxuICAgICAgICAgICAgICAgICAgICB7LyogRnJvbnRlbmQgaG90IHJlbG9hZCBpcyB3b3JraW5nISAqL31cbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJvdXRsZXQtd3JhcHBlclwiIHN0eWxlPXt7IG1pbkhlaWdodDogJzUwdmgnIH19PlxuICAgICAgICAgICAgICAgICAgICAgIDxPdXRsZXQgLz5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L1N1c3BlbnNlPlxuICAgICAgICAgICAgICAgIDwvbWFpbj5cbiAgICAgICAgICAgICAgICB7c2hvdWxkU2hvd0Zvb3RlciAmJiA8VGhlbWVkRm9vdGVyIC8+fVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvU29ja2V0UHJvdmlkZXI+XG4gICAgICAgICAgPC9Qcm9maWxlUHJvdmlkZXI+XG4gICAgICAgIDwvVGhlbWVQcm92aWRlcj5cbiAgICAgIDwvTGFuZ3VhZ2VQcm92aWRlcj5cbiAgICA8L0F1dGhQcm92aWRlcj5cbiAgKTtcbn07XG5cbi8vIENyZWF0ZSByb3V0ZXMgdXNpbmcgdGhlIGNyZWF0ZVJvdXRlc0Zyb21FbGVtZW50cyBmdW5jdGlvblxuY29uc3Qgcm91dGVzID0gY3JlYXRlUm91dGVzRnJvbUVsZW1lbnRzKFxuICA8Um91dGUgZWxlbWVudD17PEFwcExheW91dCAvPn0gZXJyb3JFbGVtZW50PXs8Um91dGVyRXJyb3JCb3VuZGFyeSAvPn0+XG4gICAgPFJvdXRlXG4gICAgICBwYXRoPVwiL1wiXG4gICAgICBlbGVtZW50PXtcbiAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIkluZGV4UGFnZVwiPlxuICAgICAgICAgIDxJbmRleCAvPlxuICAgICAgICA8L0Vycm9yQm91bmRhcnk+XG4gICAgICB9XG4gICAgLz5cbiAgICA8Um91dGVcbiAgICAgIHBhdGg9XCIvc2lnbi1pblwiXG4gICAgICBlbGVtZW50PXtcbiAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlNpZ25JblBhZ2VcIj5cbiAgICAgICAgICA8U2lnbkluIC8+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9zaWduLXVwXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiU2lnblVwUGFnZVwiPlxuICAgICAgICAgIDxTaWduVXAgLz5cbiAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgfVxuICAgIC8+XG4gICAgPFJvdXRlXG4gICAgICBwYXRoPVwiL2RvY3VtZW50YXRpb25cIlxuICAgICAgZWxlbWVudD17XG4gICAgICAgIDxFcnJvckJvdW5kYXJ5IGNvbXBvbmVudE5hbWU9XCJEb2N1bWVudGF0aW9uUGFnZVwiPlxuICAgICAgICAgIDxEb2N1bWVudGF0aW9uIC8+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi90ZXJtcy1vZi1zZXJ2aWNlXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiVGVybXNPZlNlcnZpY2VQYWdlXCI+XG4gICAgICAgICAgPFRlcm1zT2ZTZXJ2aWNlIC8+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9wcml2YWN5LXBvbGljeVwiXG4gICAgICBlbGVtZW50PXtcbiAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlByaXZhY3lQb2xpY3lQYWdlXCI+XG4gICAgICAgICAgPFByaXZhY3lQb2xpY3kgLz5cbiAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgfVxuICAgIC8+XG4gICAgPFJvdXRlXG4gICAgICBwYXRoPVwiL3JlcXVlc3QtYWNjZXNzXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiUmVxdWVzdEFjY2Vzc1BhZ2VcIj5cbiAgICAgICAgICA8UmVxdWVzdEFjY2VzcyAvPlxuICAgICAgICA8L0Vycm9yQm91bmRhcnk+XG4gICAgICB9XG4gICAgLz5cbiAgICA8Um91dGVcbiAgICAgIHBhdGg9XCIvZm9yZ290LXBhc3N3b3JkXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiRm9yZ290UGFzc3dvcmRQYWdlXCI+XG4gICAgICAgICAgPFN1c3BlbnNlIGZhbGxiYWNrPXs8TG9hZGluZ0ZhbGxiYWNrIC8+fT5cbiAgICAgICAgICAgIDxGb3Jnb3RQYXNzd29yZCAvPlxuICAgICAgICAgIDwvU3VzcGVuc2U+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9kYXNoYm9hcmRcIlxuICAgICAgZWxlbWVudD17XG4gICAgICAgIDxQcm90ZWN0ZWRSb3V0ZT5cbiAgICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiRGFzaGJvYXJkUGFnZVwiPlxuICAgICAgICAgICAgPERhc2hib2FyZCAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICAgIH1cbiAgICAvPlxuICAgIHsvKiBVc2UgdW5pZmllZCBQcm9qZWN0RGV0YWlsIGNvbXBvbmVudCB3aXRoIHJlZGlyZWN0IGNhcGFiaWxpdHkgKi99XG4gICAgPFJvdXRlXG4gICAgICBwYXRoPVwiL3Byb2plY3QvOmlkXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8UHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlByb2plY3REZXRhaWxQYWdlXCI+XG4gICAgICAgICAgICA8UHJvamVjdERldGFpbCAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICAgIH1cbiAgICAvPlxuICAgIHsvKiBFbnN1cmUgYm90aCBVUkwgZm9ybWF0cyB3b3JrIHByb3Blcmx5ICovfVxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9wcm9qZWN0cy86aWRcIlxuICAgICAgZWxlbWVudD17XG4gICAgICAgIDxQcm90ZWN0ZWRSb3V0ZT5cbiAgICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiUHJvamVjdERldGFpbFBhZ2VcIj5cbiAgICAgICAgICAgIDxQcm9qZWN0RGV0YWlsIC8+XG4gICAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgICA8L1Byb3RlY3RlZFJvdXRlPlxuICAgICAgfVxuICAgIC8+XG4gICAgPFJvdXRlXG4gICAgICBwYXRoPVwiL3Byb2plY3RzLzpwcm9qZWN0SWQvc2VnbWVudGF0aW9uLzppbWFnZUlkXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8UHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlNlZ21lbnRhdGlvblBhZ2VcIj5cbiAgICAgICAgICAgIDxTZWdtZW50YXRpb25QYWdlIC8+XG4gICAgICAgICAgPC9FcnJvckJvdW5kYXJ5PlxuICAgICAgICA8L1Byb3RlY3RlZFJvdXRlPlxuICAgICAgfVxuICAgIC8+XG4gICAgey8qIEFkZCByb3V0ZSBmb3Igb2xkIHNlZ21lbnRhdGlvbiBlZGl0b3IgcGF0aCAqL31cbiAgICA8Um91dGVcbiAgICAgIHBhdGg9XCIvcHJvamVjdHMvOnByb2plY3RJZC9lZGl0b3IvOmltYWdlSWRcIlxuICAgICAgZWxlbWVudD17XG4gICAgICAgIDxQcm90ZWN0ZWRSb3V0ZT5cbiAgICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiU2VnbWVudGF0aW9uRWRpdG9yUmVkaXJlY3RcIj5cbiAgICAgICAgICAgIDxTdXNwZW5zZSBmYWxsYmFjaz17PExvYWRpbmdGYWxsYmFjayAvPn0+XG4gICAgICAgICAgICAgIDxTZWdtZW50YXRpb25FZGl0b3JSZWRpcmVjdCAvPlxuICAgICAgICAgICAgPC9TdXNwZW5zZT5cbiAgICAgICAgICA8L0Vycm9yQm91bmRhcnk+XG4gICAgICAgIDwvUHJvdGVjdGVkUm91dGU+XG4gICAgICB9XG4gICAgLz5cbiAgICA8Um91dGVcbiAgICAgIHBhdGg9XCIvcHJvamVjdC86aWQvZXhwb3J0XCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8UHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlByb2plY3RFeHBvcnRQYWdlXCI+XG4gICAgICAgICAgICA8UHJvamVjdEV4cG9ydCAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9zZXR0aW5nc1wiXG4gICAgICBlbGVtZW50PXtcbiAgICAgICAgPFByb3RlY3RlZFJvdXRlPlxuICAgICAgICAgIDxFcnJvckJvdW5kYXJ5IGNvbXBvbmVudE5hbWU9XCJTZXR0aW5nc1BhZ2VcIj5cbiAgICAgICAgICAgIDxTZXR0aW5ncyAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICAgIH1cbiAgICAvPlxuICAgIDxSb3V0ZVxuICAgICAgcGF0aD1cIi9wcm9maWxlXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8UHJvdGVjdGVkUm91dGU+XG4gICAgICAgICAgPEVycm9yQm91bmRhcnkgY29tcG9uZW50TmFtZT1cIlByb2ZpbGVQYWdlXCI+XG4gICAgICAgICAgICA8UHJvZmlsZSAvPlxuICAgICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgICAgPC9Qcm90ZWN0ZWRSb3V0ZT5cbiAgICAgIH1cbiAgICAvPlxuICAgIHsvKiBBREQgQUxMIENVU1RPTSBST1VURVMgQUJPVkUgVEhFIENBVENILUFMTCBcIipcIiBST1VURSAqL31cbiAgICA8Um91dGVcbiAgICAgIHBhdGg9XCIqXCJcbiAgICAgIGVsZW1lbnQ9e1xuICAgICAgICA8RXJyb3JCb3VuZGFyeSBjb21wb25lbnROYW1lPVwiTm90Rm91bmRQYWdlXCI+XG4gICAgICAgICAgPFN1c3BlbnNlIGZhbGxiYWNrPXs8TG9hZGluZ0ZhbGxiYWNrIC8+fT5cbiAgICAgICAgICAgIDxOb3RGb3VuZCAvPlxuICAgICAgICAgIDwvU3VzcGVuc2U+XG4gICAgICAgIDwvRXJyb3JCb3VuZGFyeT5cbiAgICAgIH1cbiAgICAvPlxuICA8L1JvdXRlPixcbik7XG5cbi8vIENyZWF0ZSB0aGUgcm91dGVyIHdpdGggZnV0dXJlIGZsYWdzIHRvIHJlbW92ZSB3YXJuaW5nc1xuY29uc3Qgcm91dGVyID0gY3JlYXRlQnJvd3NlclJvdXRlcihyb3V0ZXMsIHtcbiAgZnV0dXJlOiB7XG4gICAgdjdfcmVsYXRpdmVTcGxhdFBhdGg6IHRydWUsXG4gICAgdjdfbm9ybWFsaXplRm9ybU1ldGhvZDogdHJ1ZSxcbiAgfSxcbn0pO1xuXG5jb25zdCBBcHAgPSAoKSA9PiAoXG4gIDxFcnJvckJvdW5kYXJ5IGNvbXBvbmVudE5hbWU9XCJBcHBcIiByZXNldE9uUHJvcHNDaGFuZ2U9e3RydWV9PlxuICAgIDxRdWVyeUNsaWVudFByb3ZpZGVyIGNsaWVudD17cXVlcnlDbGllbnR9PlxuICAgICAgPFRvb2x0aXBQcm92aWRlcj5cbiAgICAgICAgPFJvdXRlclByb3ZpZGVyIHJvdXRlcj17cm91dGVyfSAvPlxuICAgICAgPC9Ub29sdGlwUHJvdmlkZXI+XG4gICAgPC9RdWVyeUNsaWVudFByb3ZpZGVyPlxuICA8L0Vycm9yQm91bmRhcnk+XG4pO1xuXG5leHBvcnQgZGVmYXVsdCBBcHA7XG4iXSwiZmlsZSI6Ii9hcHAvc3JjL0FwcC50c3gifQ==