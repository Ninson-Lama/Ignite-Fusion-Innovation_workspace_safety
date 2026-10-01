import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, Eye, ShieldCheck, Waypoints } from "lucide-react";
import { PublicSiteShell } from "@/components/public/PublicSiteShell";
import styles from "../public-pages.module.css";

export const metadata: Metadata = {
  title: "About",
  description: "Learn why IFI Safety360 was created and how its connected safety training pathway works.",
};

const principles = [
  { number: "01", title: "Observe", copy: "Notice the conditions, behaviours and warning signs that can turn routine work into an unsafe situation." },
  { number: "02", title: "Apply", copy: "Make realistic decisions in interactive activities designed around automotive warehouse operations." },
  { number: "03", title: "Verify", copy: "Complete a focused knowledge check, preserve the result and make achievement visible to the learner." },
];

const capabilities = [
  { icon: Eye, title: "Practical warehouse context", copy: "Training connects safety principles to recognisable equipment, routes, loads and work decisions." },
  { icon: Waypoints, title: "Inclusive interaction", copy: "Immersive scenes sit alongside accessible list views, while activities support keyboard, touch and pointer input." },
  { icon: BellRing, title: "Learning continuity", copy: "Assignments, notifications and saved progress help a trainee return to the next meaningful action." },
  { icon: ShieldCheck, title: "Accountable oversight", copy: "Administrators can coordinate modules, assignments, results and live activity from one protected workspace." },
];

export default function AboutPage() {
  return (
    <PublicSiteShell active="about">
      <section className={styles.hero} aria-labelledby="about-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>About IFI Safety360</p>
          <h1 id="about-title">Built for the decisions between <em>instruction and action.</em></h1>
          <p className={styles.heroLede}>Safety360 turns concise guidance into practical activities, visible progress and evidence of completion—without losing sight of the real workplace around the learner.</p>
        </div>
        <aside className={styles.heroAside} aria-label="Project purpose">
          <span>Our purpose</span>
          <strong>Make safer judgement easier to practise.</strong>
          <p>A connected training experience for trainees and the people responsible for supporting them.</p>
        </aside>
      </section>

      <div className={styles.content}>
        <section aria-labelledby="method-title">
          <div className={styles.sectionIntro}>
            <div>
              <p className={styles.eyebrow}>The learning model</p>
              <h2 id="method-title">A clear pathway from awareness to evidence.</h2>
            </div>
            <p>Every experience is designed to keep the learner focused on a useful next step—not on navigating a complicated learning system.</p>
          </div>
          <div className={styles.principles}>
            {principles.map((principle) => (
              <article className={styles.principle} key={principle.title}>
                <span>{principle.number}</span>
                <h3>{principle.title}</h3>
                <p>{principle.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.capabilityGrid} aria-label="Safety360 capabilities">
          {capabilities.map(({ icon: Icon, title, copy }) => (
            <article className={styles.capability} key={title}>
              <div className={styles.capabilityIcon}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></div>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </section>

        <section className={styles.statement} aria-labelledby="project-title">
          <div>
            <p className={styles.eyebrow}>The project</p>
            <h2 id="project-title">Created by Ignite Fusion Innovation.</h2>
          </div>
          <div className={styles.statementCopy}>
            <span className={styles.projectTag}>CET257 Enterprise Project · Group 4</span>
            <p>IFI Safety360 is an enterprise project exploring how immersive scenarios, decision-based learning, mini-games and live administration can work together in one coherent safety-training platform.</p>
            <p>The system separates trainee and administrator responsibilities while keeping assignments, progress, results and certificates connected.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/#modules">Explore the modules <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className={styles.secondaryAction} href="/contact">Contact &amp; support</Link>
            </div>
          </div>
        </section>

        <aside className={styles.boundary} aria-label="Important project boundary">
          <span className={styles.boundaryIcon}><CheckCircle2 size={22} aria-hidden="true" /></span>
          <div>
            <strong>Designed as an internal learning prototype</strong>
            <p>Safety360 supports learning and demonstration; it does not replace accredited instruction, competent supervision, emergency reporting or an organisation&apos;s current procedures.</p>
          </div>
          <Link className={styles.secondaryAction} href="/login">Sign in</Link>
        </aside>
      </div>
    </PublicSiteShell>
  );
}
