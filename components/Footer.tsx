'use client';

export default function Footer() {
  return (
    <footer className="relative z-10 py-12 border-t border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 text-center transition-colors">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between">
        <div className="flex items-center mb-4 md:mb-0">
          <span className="font-yatra text-2xl text-slate-700 dark:text-slate-300">अन्वेषण</span>
        </div>
        <p className="text-sm text-slate-500 font-sans">
          &copy; 2026 Anveshan. Marine Debris Detection System.
        </p>
      </div>
    </footer>
  );
}
