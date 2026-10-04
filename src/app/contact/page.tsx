'use client';

import React from 'react';
import { Mail, Phone, ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Contact() {
  return (
    <div className="max-w-7xl mx-auto px-6 pt-6 pb-20 md:pt-6 md:pb-32 flex-1 w-full flex flex-col md:flex-row gap-16 md:gap-24 relative z-10">
      {/* Left Column - Big Typography */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="md:w-5/12 md:sticky md:top-32 h-fit"
      >
        <h1 className="text-5xl md:text-7xl font-sans font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Let&apos;s talk.
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-md">
          Reach out to the team behind Anveshan. We&apos;re always open to discussing new opportunities.
        </p>
      </motion.div>

      {/* Right Column - Minimalist Contact List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="md:w-7/12 flex flex-col"
      >
        {/* Contact 1 */}
        <div className="group border-b border-slate-200 dark:border-slate-800 py-10 transition-colors hover:border-cyan-500/50">
          <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase mb-2">Lead Developer</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">First Person</h2>

          <div className="flex flex-col gap-6">
            <a href="mailto:contact@example.com" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Mail size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                first@example.com
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
              <ArrowUpRight size={16} className="opacity-0 -translate-x-2 translate-y-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 group-hover/link:translate-y-0 transition-all duration-300 text-cyan-500" />
            </a>

            <a href="tel:+911234567890" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Phone size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                +91 12345 67890
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
            </a>
          </div>
        </div>

        {/* Contact 2 */}
        <div className="group border-b border-slate-200 dark:border-slate-800 py-10 transition-colors hover:border-cyan-500/50">
          <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase mb-2">Co-Founder</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Second Person</h2>

          <div className="flex flex-col gap-6">
            <a href="mailto:second@example.com" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Mail size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                second@example.com
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
              <ArrowUpRight size={16} className="opacity-0 -translate-x-2 translate-y-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 group-hover/link:translate-y-0 transition-all duration-300 text-cyan-500" />
            </a>

            <a href="tel:+910987654321" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Phone size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                +91 09876 54321
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
            </a>
          </div>
        </div>

        {/* Contact 3 */}
        <div className="group border-b border-slate-200 dark:border-slate-800 py-10 transition-colors hover:border-cyan-500/50 border-b-transparent">
          <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400 tracking-wider uppercase mb-2">Operations</p>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">Third Person</h2>

          <div className="flex flex-col gap-6">
            <a href="mailto:third@example.com" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Mail size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                third@example.com
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
              <ArrowUpRight size={16} className="opacity-0 -translate-x-2 translate-y-2 group-hover/link:opacity-100 group-hover/link:translate-x-0 group-hover/link:translate-y-0 transition-all duration-300 text-cyan-500" />
            </a>

            <a href="tel:+911122334455" className="inline-flex items-center gap-4 text-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all w-fit group/link">
              <Phone size={20} className="text-slate-400 group-hover/link:text-cyan-500 transition-colors" />
              <span className="relative overflow-hidden">
                +91 11223 34455
                <span className="absolute bottom-0 left-0 w-full h-[1px] bg-cyan-500 transform origin-left scale-x-0 transition-transform duration-300 group-hover/link:scale-x-100"></span>
              </span>
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
