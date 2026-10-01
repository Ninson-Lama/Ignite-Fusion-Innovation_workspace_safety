import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return <main className="state-page" id="main-content"><span><SearchX /></span><p className="section-kicker">404 / Not found</p><h1>That training view is not here</h1><p>The link may be outdated or the requested module may not be published for this account.</p><Link className="button button-primary" href="/dashboard"><ArrowLeft size={18} /> Return to dashboard</Link></main>;
}
