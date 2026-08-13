import { useEffect } from "react";

export function useUnsavedChangesWarning(when: boolean) {
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (!when) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when]);
}
