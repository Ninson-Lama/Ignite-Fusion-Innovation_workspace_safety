import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, FileCheck2, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireTrainee } from "@/lib/auth";
import { getTrainingCertificates } from "@/lib/queries";

export const metadata: Metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const viewer = await requireTrainee();
  const certificates = await getTrainingCertificates(viewer.id);

  return (
    <>
      <header className="page-heading certificate-heading">
        <div><p className="section-kicker">Verified completion</p><h1>Your certificates</h1><p>Completion records are created only after the full learning pathway, practical activity and protected knowledge check have been completed.</p></div>
        <div className="certificate-count"><BadgeCheck /><strong>{certificates.length}</strong><span>issued</span></div>
      </header>

      <section className="certificate-assurance"><ShieldCheck /><div><strong>Evidence-backed records</strong><p>Each certificate is tied to persisted completion and a passed assessment on your Safety360 account.</p></div></section>

      {certificates.length ? (
        <section className="certificate-grid" aria-label="Earned certificates">
          {certificates.map((certificate) => (
            <article className="certificate-card" key={certificate.moduleId}>
              <div className="certificate-card-mark"><FileCheck2 /></div>
              <p>{certificate.category}</p>
              <h2>{certificate.moduleTitle}</h2>
              <dl><div><dt>Completed</dt><dd><time dateTime={certificate.completedAt}>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(certificate.completedAt))}</time></dd></div><div><dt>Reference</dt><dd>{certificate.certificateReference}</dd></div></dl>
              <Link href={`/certificates/${certificate.moduleId}`}>View certificate <ArrowRight size={17} /></Link>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="No certificates issued yet" description="Complete a module's learning, activity and knowledge check. Your certificate will appear here automatically after you pass." />
      )}

      <p className="training-disclaimer">Safety360 certificates are internal records of completion. They are not externally accredited qualifications and do not replace task-specific competence assessment.</p>
    </>
  );
}
