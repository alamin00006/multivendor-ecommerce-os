import { BottomNav } from '@/components/layout/bottom-nav';
import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] pb-6">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}
