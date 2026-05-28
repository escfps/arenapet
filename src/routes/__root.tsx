import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { TutorialProvider } from "@/lib/use-tutorial";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";
import { Toaster } from "@/components/ui/sonner";

function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let inIframe = false;
    try { inIframe = window.self !== window.top; } catch { inIframe = true; }
    const host = window.location.hostname;
    const isPreview =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.dev");

    if (inIframe || isPreview) {
      // Limpa qualquer SW antigo no preview/iframe pra evitar cache stale
      navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[PWA] SW register failed:", err);
    });
  }, []);
  return null;
}


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" },
      { title: "Lovable App" },
      { name: "description", content: "🐾 Colecione pets, evolua criaturas raras e lute em batalhas épicas na arena! Suba de rank, desbloqueie pets lendários e torne-se o mestre definitivo do Pet Are" },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "🐾 Colecione pets, evolua criaturas raras e lute em batalhas épicas na arena! Suba de rank, desbloqueie pets lendários e torne-se o mestre definitivo do Pet Are" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "🐾 Colecione pets, evolua criaturas raras e lute em batalhas épicas na arena! Suba de rank, desbloqueie pets lendários e torne-se o mestre definitivo do Pet Are" },
      { property: "og:image", content: "https://arenapet.lovable.app/og-image.jpg" },
      { name: "twitter:image", content: "https://arenapet.lovable.app/og-image.jpg" },
      { name: "theme-color", content: "#d9a82a" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "ArenaPet" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <PWARegister />
      <TutorialRoot />
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}

function TutorialRoot() {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        setUserId(session?.user?.id ?? null);
      });
      return () => subscription.unsubscribe();
    });
  }, []);

  return (
    <TutorialProvider userId={userId}>
      <Outlet />
      <TutorialSpotlight />
    </TutorialProvider>
  );
}
