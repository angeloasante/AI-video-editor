import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Stats from "@/components/Stats";
import Features from "@/components/Features";
import Experience from "@/components/Experience";
import Testimonial from "@/components/Testimonial";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      {/* Hero Section (Dark) */}
      <section className="relative min-h-[120vh] overflow-hidden flex flex-col items-center pt-8 pb-32">
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-500/20 to-transparent blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-grid pointer-events-none" />

        <Header />

        <div className="relative z-10 flex flex-col items-center text-center mt-24 px-4 w-full max-w-5xl">
          <Hero />
          <Stats />
        </div>
      </section>

      {/* Features Section (White) */}
      <section className="bg-white text-gray-900 rounded-t-[3rem] -mt-20 relative z-20 pt-24 pb-32">
        <Features />
        <Testimonial />
        <Experience />

        <div className="text-center pb-20">
          <button className="bg-blue-50 text-blue-700 px-8 py-2.5 rounded-full font-medium text-sm hover:bg-blue-100 transition-colors">
            See All
          </button>
        </div>

        <CTA />
      </section>

      <Footer />
    </>
  );
}
