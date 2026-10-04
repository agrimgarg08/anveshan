'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileJson, FileSpreadsheet } from 'lucide-react';
import { ViewMode, ReportEntry } from '@/types';

interface TopControlsProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  globalReport: (ReportEntry & { source_file: string })[];
  downloadJson: () => void;
  downloadCsv: () => void;
  showTabs: boolean;
}

export default function TopControls({
  viewMode,
  setViewMode,
  globalReport,
  downloadJson,
  downloadCsv,
  showTabs
}: TopControlsProps) {
  return (
    <div className="w-full mb-6 z-30 relative flex justify-between items-start min-h-[48px]">
      
      <div className="flex-1" />

      {/* Center: View Toggle */}
      <div className="flex-shrink-0 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {showTabs && (
            <motion.div 
              key="tabs"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full p-1 backdrop-blur-md shadow-lg flex items-center h-[48px]"
            >
              <button
                onClick={() => setViewMode('single')}
                className={`relative h-full flex items-center justify-center px-5 rounded-full text-sm font-semibold transition-colors duration-300 ${viewMode === 'single' ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                <span className="relative z-10">Single View</span>
                {viewMode === 'single' && (
                  <motion.div layoutId="viewToggleTop" className="absolute inset-0 bg-white dark:bg-slate-800 shadow-sm rounded-full z-0 border border-slate-200 dark:border-slate-700" />
                )}
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`relative h-full flex items-center justify-center px-5 rounded-full text-sm font-semibold transition-colors duration-300 ${viewMode === 'grouped' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
              >
                <span className="relative z-10">Grouped Analytics</span>
                {viewMode === 'grouped' && (
                  <motion.div layoutId="viewToggleTop" className="absolute inset-0 bg-white dark:bg-slate-800 shadow-sm rounded-full z-0 border border-slate-200 dark:border-slate-700" />
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Export Buttons */}
      <div className="flex-1 flex justify-end pointer-events-auto">
        <AnimatePresence mode="wait">
          {globalReport.length > 0 && (
            <motion.div 
              key="export"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-full p-1 backdrop-blur-md shadow-lg flex items-center gap-1 h-[48px]"
            >
              <button
                onClick={downloadJson}
                className="flex items-center justify-center h-full gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs px-4 rounded-full transition font-medium text-slate-700 dark:text-slate-200"
                title="Download JSON Report"
              >
                <FileJson size={16} className="text-slate-500" /> JSON
              </button>
              <button
                onClick={downloadCsv}
                className="flex items-center justify-center h-full gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs px-4 rounded-full transition font-medium text-slate-700 dark:text-slate-200"
                title="Download CSV Report"
              >
                <FileSpreadsheet size={16} className="text-slate-500" /> CSV
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
