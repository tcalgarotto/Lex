import { LandingBody } from "@/components/marketing/landing-body";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingHero } from "@/components/marketing/landing-hero";

export default function MarketingHomePage() {
  return (
    <>
      <LandingHeader />
      <main>
        <LandingHero />
        <LandingBody />
      </main>
      <LandingFooter />
    </>
  );
}
