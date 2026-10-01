import Link from "next/link";

interface BrandProps {
  href?: string;
  inverse?: boolean;
  compact?: boolean;
}

export function Brand({ href = "/", inverse = false, compact = false }: BrandProps) {
  return (
    <Link className={`brand ${inverse ? "brand-inverse" : ""}`} href={href} aria-label="IFI Safety360 home">
      <span className="brand-ifi">IFI</span>
      {!compact && <span className="brand-name">Safety360</span>}
    </Link>
  );
}
