import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HazardScene } from "@/components/panorama/HazardScene";
import { getPublishedModuleMetadata } from "@/lib/queries";

export const metadata: Metadata = { title: "360° Hazard Scene", description: "Interactive 360 degree automotive warehouse hazard-perception exercise." };
export default async function HazardScenePage() {
  const publishedModule = await getPublishedModuleMetadata("hazard-perception");
  if (!publishedModule) notFound();
  return <HazardScene moduleId={publishedModule.id} />;
}
