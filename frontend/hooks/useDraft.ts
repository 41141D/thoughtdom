import { useEffect, useRef, useState } from "react";

const SAVE_DEBOUNCE_MS = 1500;

export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [restored, setRestored] = useState(false);
  const loadedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore once, on mount -- this is the "browser crashed, get my draft
  // back" path. No prompt, no confirmation: it just comes back.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setValue({ ...initial, ...JSON.parse(raw) });
        setRestored(true);
      }
    } catch {
      // corrupt or unavailable storage -- start fresh rather than crash
    }
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced autosave on every change after the initial load.
  useEffect(() => {
    if (!loadedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage full/unavailable -- fail silently, editing still works
      }
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [value, key]);

  function clearDraft() {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }

  return { value, setValue, restored, dismissRestored: () => setRestored(false), clearDraft };
}
