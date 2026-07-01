import { useEffect, useState } from "react";

/** Toggle the whole document in/out of fullscreen. No-op where unsupported. */
export function toggleFullscreen(): void {
  if (document.fullscreenElement) {
    void document.exitFullscreen?.();
  } else {
    void document.documentElement.requestFullscreen?.();
  }
}

/** Reactive fullscreen flag, kept in sync with the browser's own changes. */
export function useIsFullscreen(): boolean {
  const [fs, setFs] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  return fs;
}
