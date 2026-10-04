'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function TermsAndConditions() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-20 md:pt-6 md:pb-32 flex-1 w-full relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-20"
      >
        <h1 className="text-5xl md:text-6xl font-sans font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Terms & Conditions
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400">
          Last updated: September 2026
        </p>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="space-y-24"
      >
        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            01
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Agreement to Terms
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              By accessing our website and using our services, you agree to be bound by these Terms and Conditions and agree that you are responsible for the agreement with any applicable local laws. If you disagree with any of these terms, you are prohibited from accessing this site.
            </p>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            02
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Use License
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p className="mb-4">
              Permission is granted to temporarily download one copy of the materials on Anveshan&apos;s website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc pl-6 space-y-3 marker:text-cyan-500">
              <li>modify or copy the materials;</li>
              <li>use the materials for any commercial purpose or for any public display;</li>
              <li>attempt to reverse engineer any software contained on Anveshan&apos;s website;</li>
              <li>remove any copyright or other proprietary notations from the materials; or</li>
              <li>transfer the materials to another person or &quot;mirror&quot; the materials on any other server.</li>
            </ul>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            03
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Disclaimer
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              All the materials on Anveshan’s Website are provided &quot;as is&quot;. Anveshan makes no warranties, may it be expressed or implied, therefore negates all other warranties. Furthermore, Anveshan does not make any representations concerning the accuracy or reliability of the use of the materials on its Website or otherwise relating to such materials or any sites linked to this Website.
            </p>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            04
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Limitations
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              Anveshan or its suppliers will not be hold accountable for any damages that will arise with the use or inability to use the materials on Anveshan’s Website, even if Anveshan or an authorize representative of this Website has been notified, orally or written, of the possibility of such damage.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
