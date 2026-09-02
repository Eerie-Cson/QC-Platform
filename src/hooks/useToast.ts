import { useState, useCallback } from "react";

export function useToast(duration = 2400) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback(
    (msg: string) => {
      setToast(msg);
      const timer = setTimeout(() => setToast(null), duration);
      return () => clearTimeout(timer);
    },
    [duration],
  );

  return { toast, showToast };
}
