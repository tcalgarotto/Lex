"use client";

import { useEffect, useState } from "react";

/** True após o primeiro paint no cliente — evita mismatch SSR vs hidratação. */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);
  return isClient;
}
