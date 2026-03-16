import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-white rounded-t-[3rem] pt-24 pb-12 px-6 md:px-12 relative overflow-hidden -mt-10 z-30">
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-white/5 to-transparent blur-[80px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-24">
          <div>
            <h4 className="text-sm font-semibold text-white mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-gray-500 font-medium">
              <li>
                <Link href="#features" className="hover:text-white transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Changelog
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Roadmap
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-6">
              Resources
            </h4>
            <ul className="space-y-4 text-sm text-gray-500 font-medium">
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  API Reference
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Tutorials
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-gray-500 font-medium">
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-white transition-colors">
                  Legal
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 md:col-span-2 grid grid-cols-2 gap-8">
            <div>
              <h4 className="text-sm font-semibold text-white mb-6">Social</h4>
              <ul className="space-y-4 text-sm text-gray-500 font-medium">
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors flex items-center justify-between w-24"
                  >
                    Twitter{" "}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors flex items-center justify-between w-24"
                  >
                    YouTube{" "}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors flex items-center justify-between w-24"
                  >
                    Discord{" "}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-white transition-colors flex items-center justify-between w-24"
                  >
                    GitHub{" "}
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-6">
                Creators
              </h4>
              <p className="text-sm text-gray-500 font-medium leading-relaxed">
                Made, engineered, and developed by{" "}
                <a
                  href="https://angeloasante.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white hover:text-blue-400 transition-colors"
                >
                  Travis Moore (Angelo Asante)
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-16 flex flex-col items-start">
          <span className="inline-block text-xs font-medium text-gray-400 border border-white/20 rounded-full px-4 py-1.5 mb-8">
            Ready to Create Consistent AI Video?
          </span>
          <div className="flex items-center justify-between w-full group cursor-pointer">
            <a
              href="https://studio.klusta.com"
              className="text-6xl md:text-8xl lg:text-[10rem] font-semibold tracking-tighter text-gray-600 transition-colors duration-500 group-hover:text-white leading-none"
            >
              GET STARTED
            </a>
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full border border-gray-600 group-hover:border-white transition-colors flex items-center justify-center ml-4 shrink-0">
              <ArrowUpRight className="w-8 h-8 md:w-12 md:h-12 text-gray-600 group-hover:text-white transition-colors" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-16 pt-8 border-t border-white/5">
          <div className="flex items-center space-x-2">
            <Image src="/logo.png" alt="Klusta" width={20} height={20} />
            <span className="text-sm text-gray-500 font-medium">
              Klusta &copy; {new Date().getFullYear()}
            </span>
          </div>
          <p className="text-xs text-gray-600">
            Consistent AI video. Finally.
          </p>
        </div>
      </div>
    </footer>
  );
}
