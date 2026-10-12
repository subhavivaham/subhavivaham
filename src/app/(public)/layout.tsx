import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TopBanner } from "@/components/home/top-banner";
import { fetchSiteConfig } from "@/lib/data/queries";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const config = await fetchSiteConfig();
  return (
    <>
      <TopBanner message={config.bannerText} enabled={config.bannerEnabled} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer officeAddress={config.officeAddress} />
    </>
  );
}