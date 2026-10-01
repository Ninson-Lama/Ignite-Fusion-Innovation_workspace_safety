import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp, GraduationCap, LockKeyhole, ShieldAlert, Users } from "lucide-react";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import styles from "../public-pages.module.css";

export const metadata: Metadata = {
  title: "Contact",
  description: "Find the right support route for IFI Safety360 accounts, training and project feedback.",
};

const supportRoutes = [
  {
    icon: GraduationCap,
    title: "Training or account help",
    copy: "Ask your local Safety360 administrator about access, assignments, deadlines, module availability or a result you cannot see.",
    href: "/login",
    label: "Sign in to Safety360",
  },
  {
    icon: CircleHelp,
    title: "Signed-in support",
    copy: "The protected Help & support area contains guidance for account access, interactive scenes and completing training.",
    href: "/help",
    label: "Open Help & support",
  },
  {
    icon: Users,
    title: "Project review or feedback",
    copy: "Use the existing IFI or university project channel shared with you. Public contact details are intentionally not published here.",
    href: "/about",
    label: "Read about the project",
  },
];

export default function ContactPage() {
  return (
    <PublicSiteShell active="contact">
      <section className={styles.hero} aria-labelledby="contact-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Contact &amp; support</p>
          <h1 id="contact-title">Reach the right person, <em>without sharing sensitive information.</em></h1>
          <p className={styles.heroLede}>Choose the support route that matches your question. Safety360 does not collect public enquiries through an unmonitored form.</p>
        </div>
        <aside className={styles.heroAside} aria-label="Quick contact guidance">
          <span>Fastest route</span>
          <strong>Start with your Safety360 administrator.</strong>
          <p>They can see your assigned training and help resolve access or progress questions in context.</p>
        </aside>
      </section>

      <div className={styles.content}>
        <section aria-labelledby="support-title">
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>Choose a support path</p>
              <h2 id="support-title">A direct route for every kind of question.</h2>
            </div>
            <p>There is no need to share a password, recovery email or private account data when asking for help.</p>
          </div>
          <div className={styles.supportGrid}>
            {supportRoutes.map(({ icon: Icon, title, copy, href, label }) => (
              <article className={styles.supportCard} key={title}>
                <span className={styles.supportIcon}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
                <h2>{title}</h2>
                <p>{copy}</p>
                <Link className={styles.cardLink} href={href}>{label} <ArrowRight size={16} aria-hidden="true" /></Link>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.contactPanel} aria-labelledby="include-title">
          <div>
            <p className={styles.eyebrow}>Helpful context</p>
            <h2 id="include-title">What to include when reporting a problem.</h2>
          </div>
          <ol className={styles.checklist}>
            <li><span>01</span><span>The page or module where the problem happened.</span></li>
            <li><span>02</span><span>The approximate time and the action you were trying to complete.</span></li>
            <li><span>03</span><span>Your browser and device type, such as Chrome on a Windows laptop.</span></li>
            <li><span>04</span><span>The exact message shown on screen, with a screenshot if it contains no private data.</span></li>
          </ol>
        </section>

        <aside className={styles.securityNotice} aria-labelledby="security-title">
          <span><LockKeyhole size={23} aria-hidden="true" /></span>
          <div>
            <h2 id="security-title">Never send passwords or sign-in links</h2>
            <p>Do not share your password, verification or recovery link, session token, or private quiz answers. A legitimate support request should not require them.</p>
          </div>
        </aside>

        <aside className={styles.emergency} aria-labelledby="emergency-title">
          <div>
            <h2 id="emergency-title">Immediate workplace danger?</h2>
            <p>Stop work if it is safe to do so and follow your site&apos;s emergency and hazard-reporting procedure. This website is a learning platform, not an emergency reporting channel.</p>
          </div>
          <ShieldAlert size={42} strokeWidth={1.5} aria-hidden="true" />
        </aside>
      </div>
    </PublicSiteShell>
  );
}
