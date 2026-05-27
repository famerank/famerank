import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import CategoryCards from "@/components/sections/CategoryCards";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <CategoryCards />
      </main>
      <Footer />
    </div>
  );
}
