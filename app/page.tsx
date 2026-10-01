import Image from "next/image";
import Link from "next/link";
import {
  Award,
  ArrowRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  LockKeyhole,
  RotateCcw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";
import styles from "./home.module.css";

const modules = [
  {
    number: "01",
    title: "Hazard perception",
    description: "Inspect an immersive 360° warehouse scene and identify seven operational risks.",
    format: "Immersive 360°",
    focus: "Visual risk scanning",
    icon: ScanLine,
  },
  {
    number: "02",
    title: "Manual handling",
    description: "Practise safer decisions for lifting, carrying and moving loads in live operations.",
    format: "5 practical decisions",
    focus: "Load and movement control",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Working at height",
    description: "Recognise access, equipment and fall-prevention controls before work begins.",
    format: "5 practical decisions",
    focus: "Access and fall prevention",
    icon: BarChart3,
  },
  {
    number: "04",
    title: "Cyber awareness",
    description: "Spot suspicious messages, protect workplace accounts and respond safely to common digital threats.",
    format: "5 practical decisions",
    focus: "Secure everyday behaviour",
    icon: LockKeyhole,
  },
];

const learningDetails = [
  {
    title: "Resume without losing progress",
    description: "Return to the lesson or decision you last reached, even when a session is interrupted.",
    icon: RotateCcw,
  },
  {
    title: "Stay aware of new assignments",
    description: "Trainees receive a clear notification as soon as new learning is assigned.",
    icon: BellRing,
  },
  {
    title: "Finish with verified evidence",
    description: "Passed training updates the learner record and makes the completion certificate available.",
    icon: Award,
  },
];

export default function Home() {
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="IFI Safety360 home">
          <Image
            className={styles.brandMark}
            src="/ifi-flame.jpeg"
            alt=""
            width={100}
            height={72}
          />
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandName}>
            <strong>IFI</strong>
            <small>Ignite Fusion Innovation</small>
          </span>
        </Link>
        <nav className={styles.navigation} aria-label="Primary navigation">
          <a className={styles.sectionNav} href="#overview">Overview</a>
          <a className={styles.sectionNav} href="#modules">Modules</a>
          <a className={styles.sectionNav} href="#process">Process</a>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <Link className={styles.signIn} href="/login">
            Sign in <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-title">
        <Image
          className={styles.heroImage}
          src="/warehouse-panorama.png"
          alt="Automotive warehouse operation with racking, marked walkways and material-handling activity"
          fill
          loading="eager"
          sizes="100vw"
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroGrid} aria-hidden="true" />

        <div className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span /> Interactive safety training</p>
            <h1 id="hero-title">
              Sharper awareness.<br />
              <em>Safer operations.</em>
            </h1>
            <p className={styles.lede}>
              Practical, immersive training built for the pace and precision of automotive warehousing and logistics.
            </p>
            <div className={styles.actions}>
              <a className={styles.primaryAction} href="#modules">
                Explore modules <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a className={styles.secondaryAction} href="#process">How the pathway works</a>
            </div>
          </div>

        </div>

        <dl className={styles.proofBar} aria-label="Platform highlights">
          <div><dt>04</dt><dd>Core training modules</dd></div>
          <div><dt>360°</dt><dd>Immersive hazard scene</dd></div>
          <div><dt>Live</dt><dd>Progress and feedback</dd></div>
          <div className={styles.proofContext}><dt><CheckCircle2 size={19} aria-hidden="true" /></dt><dd>Built for automotive warehouse operations</dd></div>
        </dl>
      </section>

      <section className={styles.platform} id="overview" aria-labelledby="platform-title">
        <div className={styles.sectionLead}>
          <div>
            <p className={styles.sectionKicker}>Safety360 training system</p>
            <h2 id="platform-title">Training shaped around decisions made on the warehouse floor.</h2>
          </div>
          <p>
            Build practical awareness through concise learning, scenario-based activities and protected knowledge checks—then keep every result visible in one training pathway.
          </p>
        </div>

        <div className={styles.moduleHeader} id="modules">
          <p><span>02</span> Training modules</p>
          <small>Four focused experiences · one connected pathway</small>
        </div>

        <div className={styles.moduleList}>
          {modules.map(({ number, title, description, format, focus, icon: Icon }) => (
            <article className={styles.moduleItem} key={title}>
              <span className={styles.moduleNumber}>{number}</span>
              <Icon className={styles.moduleIcon} size={28} strokeWidth={1.6} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
              <div className={styles.moduleMeta}>
                <strong>{format}</strong>
                <small>{focus}</small>
              </div>
            </article>
          ))}
        </div>

        <section className={styles.continuity} aria-labelledby="continuity-title">
          <div className={styles.continuityIntro}>
            <p className={styles.sectionKicker}>Built into every module</p>
            <h2 id="continuity-title">Learning that keeps moving with the trainee.</h2>
            <p>Each session stays connected from assignment to completion, so learners know what comes next and administrators can see the result.</p>
          </div>
          <div className={styles.continuityGrid}>
            {learningDetails.map(({ title, description, icon: Icon }, index) => (
              <article className={styles.continuityItem} key={title}>
                <div className={styles.continuityIcon}>
                  <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                </div>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <div className={styles.pathway} id="process">
          <div className={styles.pathwayVisual}>
            <Image
              src="/warehouse-panorama.png"
              alt="Warehouse floor with forklift activity, racking and pedestrian routes"
              fill
              sizes="(max-width: 900px) 100vw, 58vw"
            />
            <span>OPERATIONAL VIEW / ZONE 04</span>
          </div>
          <div className={styles.pathwayCopy}>
            <p className={styles.sectionKicker}>From observation to evidence</p>
            <h2>One connected safety pathway.</h2>
            <ol>
              <li><span>01</span><div><strong>Learn</strong><small>Review the control and why it matters.</small></div></li>
              <li><span>02</span><div><strong>Apply</strong><small>Respond to realistic warehouse decisions.</small></div></li>
              <li><span>03</span><div><strong>Verify</strong><small>Complete the knowledge check and record progress.</small></div></li>
            </ol>
            <p className={styles.pathwayNote}><CheckCircle2 size={18} aria-hidden="true" /> Progress, results and achievements stay connected to the learner&apos;s secure profile.</p>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link className={styles.footerBrand} href="/" aria-label="IFI Safety360 home">
          <Image src="/ifi-flame.jpeg" alt="" width={50} height={41} />
          <span><strong>IFI Safety360</strong><small>Ignite Fusion Innovation</small></span>
        </Link>
        <p>Interactive safety training for IFI · Logistics and automotive warehousing</p>
        <nav className={styles.footerLinks} aria-label="Footer navigation">
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a href="#main-content">Back to top <span aria-hidden="true">↑</span></a>
        </nav>
      </footer>
    </main>
  );
}
