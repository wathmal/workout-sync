"use client";

import { useEffect } from "react";

// Registers the minimal shell-cache service worker (public/sw.js). Failures are
// swallowed — the app works fine without it, the SW only adds offline shell load
// + the Android install prompt.
export function SwRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
