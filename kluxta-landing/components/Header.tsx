"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
  return (
    <nav className="relative z-50 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border border-white/10 rounded-full bg-white/[0.02] backdrop-blur-md">
      <Link href="/" className="flex items-center space-x-2 text-white">
        <Image src="/logo.png" alt="Kluxta" width={28} height={28} />
        <span className="font-semibold tracking-tight text-xl">Kluxta</span>
      </Link>

      <div className="hidden md:flex items-center space-x-8 text-sm text-gray-400 font-medium">
        <Link href="#" className="text-white">
          Home
        </Link>
        <Link href="#features" className="hover:text-white transition-colors">
          Features
        </Link>
        <Link href="#experience" className="hover:text-white transition-colors">
          How It Works
        </Link>
        <Link href="#pricing" className="hover:text-white transition-colors">
          Pricing
        </Link>
      </div>

      <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
        <a
          href="https://studio.kluxta.com"
          className="text-gray-400 hover:text-white transition-colors"
        >
          Sign In
        </a>
        <a
          href="https://studio.kluxta.com"
          className="px-5 py-2.5 rounded-full border border-white/20 text-gray-300 hover:bg-white/10 transition-colors"
        >
          Start Free
        </a>
      </div>

      <button className="md:hidden text-gray-400">
        <Menu />
      </button>
    </nav>
  );
}
