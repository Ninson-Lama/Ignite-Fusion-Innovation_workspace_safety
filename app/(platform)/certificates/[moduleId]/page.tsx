import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck } from "lucide-react";
import { PrintCertificateButton } from "@/components/certificates/PrintCertificateButton";
import { requireTrainee } from "@/lib/auth";
import { getTrainingCertificates } from "@/lib/queries";

export const metadata: Metadata = { title: "Certificate of completion" };

export default async function CertificatePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const viewer = await requireTrainee();
  const certificates = await getTrainingCertificates(viewer.id);
  const certificate = certificates.find((item) => item.moduleId === moduleId);
  if (!certificate) notFound();

  const completedDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(certificate.completedAt));

  return (
    <article className="certificate-detail-page">
      <div className="certificate-page-actions"><Link className="back-link" href="/certificates"><ArrowLeft size={17} /> Certificates</Link><PrintCertificateButton recipientName={viewer.fullName} moduleTitle={certificate.moduleTitle} completedDate={completedDate} certificateReference={certificate.certificateReference} /></div>
      <section className="certificate-sheet" aria-label={`Certificate for ${certificate.moduleTitle}`}>
        <div className="certificate-sheet-frame">
          <header><span className="certificate-seal"><BadgeCheck /></span><div><strong>IFI</strong><small>Safety360</small></div><p>Certificate of completion</p></header>
          <div className="certificate-sheet-copy">
            <p>This internal record confirms that</p>
            <h1>{viewer.fullName}</h1>
            <p>completed the IFI Safety360 learning pathway</p>
            <h2>{certificate.moduleTitle}</h2>
            <p className="certificate-completion-date">on <time dateTime={certificate.completedAt}>{completedDate}</time></p>
          </div>
          <footer><div><span>Certificate reference</span><strong>{certificate.certificateReference}</strong></div><div><ShieldCheck /><span>Verified Safety360 completion</span></div></footer>
        </div>
      </section>
      <p className="certificate-legal-note">This certificate records completion within IFI Safety360. It is not an externally accredited qualification or proof of occupational competence.</p>
    </article>
  );
}
