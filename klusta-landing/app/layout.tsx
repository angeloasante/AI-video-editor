import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klusta — The Figma of AI Video",
  description:
    "The AI video editor that finally solves consistency. Starting frame tags, Scene DNA, and Google Cloud Video Intelligence for visually consistent AI video.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#0f1011] text-white antialiased">{children}</body>
    </html>
  );
}
