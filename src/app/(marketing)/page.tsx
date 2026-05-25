import { LandingBetaSection } from "@/components/marketing/landing-beta-section";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHero } from "@/components/marketing/landing-hero";
import { LandingMobileCta } from "@/components/marketing/landing-mobile-cta";
import { LandingPillars } from "@/components/marketing/landing-pillars";
import dynamic from "next/dynamic";
import { LandingCommitment } from "@/components/marketing/landing-commitment";
import { LandingScrollProgress } from "@/components/marketing/landing-scroll-progress";

const LandingBody = dynamic(
  () => import("@/components/marketing/landing-body").then((m) => m.LandingBody),
  { ssr: true },
);
const LandingFaq = dynamic(
  () => import("@/components/marketing/landing-faq").then((m) => m.LandingFaq),
  { ssr: true },
);

export default function MarketingHomePage() {
  return (
    <>
      <LandingScrollProgress />
      <LandingHeader />
      <main className="pb-20 md:pb-0">
        <LandingHero />
        <LandingPillars />
        <LandingBetaSection />
        <LandingBody />
        <LandingCommitment />
        <LandingFaq />
      </main>
      <LandingMobileCta />
      <LandingFooter />
    </>
  );
}
