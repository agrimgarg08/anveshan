'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, MapPin, BarChart, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 selection:bg-cyan-500/30 overflow-x-hidden font-sans transition-colors">
      {/* Hero Section */}
      <main className="relative z-10 pt-20 pb-24 lg:pt-28 lg:pb-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center flex flex-col items-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-tight text-slate-900 dark:text-slate-100"
          >
            Cleaner Oceans with <br />
            <span className="text-cyan-600 dark:text-cyan-400 font-yatra">
              अन्वेषण
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed mb-12"
          >
            An advanced AI-powered Side-Scan Sonar (SSS) analysis platform designed to detect, classify, and geotag marine debris in real-time.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
          >
            <Link href="/dashboard" className="w-full sm:w-auto group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold rounded-full transition-all overflow-hidden">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center justify-center gap-2">
                Start Detection <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
            <a href="#features" className="w-full sm:w-auto px-8 py-4 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium rounded-full border border-slate-300 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all duration-300 text-center backdrop-blur-sm">
              Explore Features
            </a>
          </motion.div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Marine Surveyors</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">Utilitarian design meets cutting-edge machine learning to deliver actionable insights from noisy sonar data.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* Feature 1 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -5 }}
              className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 hover:border-cyan-400/30 dark:hover:border-cyan-500/30 hover:bg-white dark:hover:bg-slate-900 transition-colors group shadow-sm"
            >
              <div className="w-14 h-14 bg-cyan-100 dark:bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-6 border border-cyan-200 dark:border-cyan-500/20 group-hover:scale-110 transition-transform duration-300">
                <ShieldCheck className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">AI Detection</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">Automated YOLO-based inference filters out natural clutter like rocks to highlight man-made debris with high confidence.</p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -5 }}
              className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-400/30 dark:hover:border-blue-500/30 hover:bg-white dark:hover:bg-slate-900 transition-colors group shadow-sm"
            >
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-200 dark:border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                <MapPin className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Geospatial Mapping</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">Instantly map detections from pixel space to real-world coordinates using simulated tow-path metadata.</p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -5 }}
              className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md p-8 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 hover:border-indigo-400/30 dark:hover:border-indigo-500/30 hover:bg-white dark:hover:bg-slate-900 transition-colors group shadow-sm"
            >
              <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-200 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                <BarChart className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">Automated Reports</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">Export clean, structured reports in JSON and CSV formats for immediate analysis and dashboard integration.</p>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  );
}
