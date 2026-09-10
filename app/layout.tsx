import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Yatra_One } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${yatraOne.variable} font-sans bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen flex flex-col selection:bg-cyan-500/30 transition-colors duration-300`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <AuthProvider>
            <Navbar />
            <div className="flex-1 flex flex-col">
              {children}
            </div>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
