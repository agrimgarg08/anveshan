'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-6 pb-20 md:pt-6 md:pb-32 flex-1 w-full relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mb-20"
      >
        <h1 className="text-5xl md:text-6xl font-sans font-extrabold tracking-tight text-slate-900 dark:text-white mb-6">
          Privacy Policy
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
            Introduction
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              Welcome to Anveshan. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
            </p>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            02
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            The Data We Collect
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p className="mb-4">
              We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:
            </p>
            <ul className="list-disc pl-6 space-y-3 marker:text-cyan-500">
              <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
              <li><strong>Contact Data</strong> includes email address and telephone numbers.</li>
              <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
            </ul>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            03
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            How We Use Your Data
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p className="mb-4">
              We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-3 marker:text-cyan-500">
              <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
              <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
              <li>Where we need to comply with a legal obligation.</li>
            </ul>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            04
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Data Security
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.
            </p>
          </div>
        </section>

        <section className="relative">
          <div className="absolute -top-12 -left-6 md:-left-16 text-8xl md:text-9xl font-extrabold text-cyan-600/15 dark:text-cyan-500/20 -z-10 select-none">
            05
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-6">
            Your Legal Rights
          </h2>
          <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
            <p>
              Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data and (where the lawful ground of processing is consent) to withdraw consent.
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
