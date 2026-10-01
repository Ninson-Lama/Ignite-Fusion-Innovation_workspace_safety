"use client";

import { useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";

const SESSION_KEY = "safety360-initial-session-resolved";

export function InitialLoader() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.sessionStorage.getItem(SESSION_KEY)) {
      queueMicrotask(() => setVisible(false));
      return;
    }
    const client = getBrowserSupabaseClient();
    const finish = () => {
      window.sessionStorage.setItem(SESSION_KEY, "true");
      setVisible(false);
    };

    if (!client) {
      queueMicrotask(finish);
      return;
    }

    void client.auth.getSession().finally(finish);
  }, []);

  if (!visible) return null;

  return (
    <div className="initial-loader" role="status" aria-live="polite" aria-label="Preparing your training environment">
      <div className="loader-grid" />
      <div className="loader-content">
        <span className="loader-ifi">IFI</span>
        <strong>Safety360</strong>
        <span className="loader-line"><i /></span>
        <p>Preparing your training environment</p>
      </div>
    </div>
  );
}
