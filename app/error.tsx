"use client";

import { CircleAlert, RotateCcw } from "lucide-react";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="state-page" id="main-content"><span><CircleAlert /></span><p className="section-kicker">Safety360 interruption</p><h1>This view could not be loaded</h1><p>Your saved training data has not been intentionally changed. Try the request again or return to the dashboard.</p><button className="button button-primary" onClick={reset}><RotateCcw size={18} /> Try again</button></main>;
}
