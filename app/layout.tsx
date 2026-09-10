import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Yatra_One } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const yatraOne = Yatra_One({
  weight: "400",
  subsets: ["latin", "devanagari"],
  variable: "--font-yatra-one",
});

export const metadata: Metadata = {
  title: "Anveshan",
  description: "Marine Debris Detection System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} ${yatraOne.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
