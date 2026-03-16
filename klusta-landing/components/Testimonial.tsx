import { Quote, ArrowLeft, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function Testimonial() {
  return (
    <div className="max-w-6xl mx-auto px-6 mt-32">
      <div className="bg-blue-50 rounded-[2.5rem] p-10 md:p-16 relative overflow-hidden">
        <Quote className="w-12 h-12 text-blue-900 mb-8 fill-blue-900" />

        <h2 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-blue-900 leading-tight mb-16 max-w-4xl">
          &ldquo; I used to spend 20 generations getting one consistent clip.
          With Klusta&apos;s starting frame tags and Scene DNA, I get it in 2-3.
          It just works. &rdquo;
        </h2>

        <div className="flex flex-col md:flex-row items-center justify-between relative z-10">
          <div className="flex items-center space-x-4 mb-8 md:mb-0">
            <Image
              src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=100&h=100"
              alt="Creator"
              className="w-12 h-12 rounded-full border-2 border-white"
              width={48}
              height={48}
            />
            <div>
              <div className="font-semibold text-gray-900">Alex Rivera</div>
              <div className="text-sm text-gray-600 font-medium">
                AI Video Creator
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-6">
            <button className="w-10 h-10 rounded-full border border-black/10 flex items-center justify-center hover:bg-black/5 transition-colors">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <span className="text-sm font-medium text-gray-600">01/03</span>
            <button className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center hover:bg-blue-300 transition-colors">
              <ArrowRight className="w-4 h-4 text-gray-900" />
            </button>
          </div>
        </div>

        {/* Floating image */}
        <div className="absolute bottom-0 right-10 w-48 h-56 bg-gray-200 rounded-t-2xl overflow-hidden hidden lg:block border-4 border-white/50 shadow-xl">
          <Image
            src="https://images.unsplash.com/photo-1556157382-97eda2d62296?auto=format&fit=crop&w=400"
            alt="Creator"
            className="w-full h-full object-cover"
            width={400}
            height={560}
          />
        </div>
      </div>
    </div>
  );
}
