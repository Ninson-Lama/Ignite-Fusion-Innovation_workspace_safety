import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import styles from "./PublicSiteShell.module.css";

type PublicSiteShellProps = {
  active: "about" | "contact";
  children: React.ReactNode;
};

export function PublicSiteShell({ active, children }: PublicSiteShellProps) {
  return (
    <div className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="IFI Safety360 home">
          <Image className={styles.brandMark} src="/ifi-flame.jpeg" alt="" width={100} height={72} />
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandName}>
            <strong>IFI</strong>
            <small>Ignite Fusion Innovation</small>
          </span>
        </Link>

        <nav className={styles.navigation} aria-label="Public navigation">
          <Link href="/">Home</Link>
          <Link href="/about" aria-current={active === "about" ? "page" : undefined}>About</Link>
          <Link href="/contact" aria-current={active === "contact" ? "page" : undefined}>Contact</Link>
          <Link className={styles.signIn} href="/login">
            Sign in <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main>{children}</main>

      <footer className={styles.footer}>
        <Link className={styles.footerBrand} href="/" aria-label="IFI Safety360 home">
          <Image src="/ifi-flame.jpeg" alt="" width={50} height={41} />
          <span><strong>IFI Safety360</strong><small>Ignite Fusion Innovation</small></span>
        </Link>
        <p>Practical learning for safer decisions in automotive warehousing and logistics.</p>
        <nav className={styles.footerLinks} aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
          <a href="#main-content">Top ↑</a>
        </nav>
      </footer>
    </div>
  );
}
