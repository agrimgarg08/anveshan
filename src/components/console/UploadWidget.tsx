'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, FolderArchive, Play, Loader2, Trash2, ChevronUp } from 'lucide-react';
import { QueueItem } from '@/types';

interface UploadWidgetProps {
  queue: QueueItem[];
  isDragging: boolean;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
  processingStatus: 'idle' | 'processing' | 'done';
  pendingCount: number;
  processedCount: number;
  errorCount: number;
  startProcessing: (retryFailed: boolean) => void;
}

export default function UploadWidget({
  queue,
  isDragging,
  handleFileChange,
  handleClear,
  processingStatus,
  pendingCount,
  processedCount,
  errorCount,
  startProcessing,
}: UploadWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExpanded]);

  // Auto expand when dragging files over the window
  useEffect(() => {
    if (isDragging) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsExpanded(true);
    }
  }, [isDragging]);

  const hasFiles = queue.length > 0;
  const canProcess = pendingCount > 0 && processingStatus !== 'processing';
  const canRetry = pendingCount === 0 && errorCount > 0 && processingStatus !== 'processing';
  const isProcessing = processingStatus === 'processing';
  const progressPercent = Math.round(((processedCount + errorCount) / Math.max(queue.length, 1)) * 100);

  return (
    <div className="relative z-50" ref={widgetRef}>
      <motion.div
        style={{ borderRadius: 32 }}
        className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden min-w-[320px] md:min-w-[440px]"
      >


        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="px-3 pt-3 pb-0 relative z-0"
            >
              {/* Drag and drop area */}
              <div
                role="button"
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-[20px] p-8 text-center transition-all duration-200
                  ${isDragging ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-400/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
              >
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept="image/png, image/jpeg, application/zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  id="folder-upload"
                  type="file"
                  // @ts-expect-error webkitdirectory is a non-standard property
                  webkitdirectory="true"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <FolderArchive className="w-10 h-10 text-slate-400 mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">Drag and drop folders, images, or ZIPs here</p>

                <div className="flex gap-3 mb-2">
                  <button
                    onClick={() => document.getElementById('file-upload')?.click()}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm z-10"
                  >
                    Browse Files
                  </button>
                  <button
                    onClick={() => document.getElementById('folder-upload')?.click()}
                    className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm z-10"
                  >
                    Browse Folder
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">Extracts all PNG/JPG files automatically</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed/Control Bar */}
        <div className="flex items-center justify-between p-2 gap-2 h-[64px] relative z-10 bg-transparent">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-3 pl-2 pr-4 h-full rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200 font-semibold text-sm flex-1"
          >
            <div className="bg-cyan-50 dark:bg-cyan-500/10 w-8 h-8 flex items-center justify-center rounded-full shrink-0">
              <UploadCloud size={16} className="text-cyan-600 dark:text-cyan-400" /> 
            </div>
            <span>Upload Data</span>
            <ChevronUp 
              size={16} 
              className={`ml-auto text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
            />
          </button>

          <AnimatePresence mode="wait">
            {hasFiles && !isProcessing && (
              <motion.div 
                key="actions"
                initial={{ opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0 }}
                animate={{ opacity: 1, width: 'auto', paddingLeft: 8, paddingRight: 4 }}
                exit={{ opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-700 h-full py-1 overflow-hidden"
              >
                {canProcess && (
                  <button
                    onClick={() => startProcessing(false)}
                    className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold h-full px-5 rounded-full transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                  >
                    <Play size={16} className="fill-current" /> Process
                  </button>
                )}
                {canRetry && (
                  <button
                    onClick={() => startProcessing(true)}
                    className="bg-orange-500 hover:bg-orange-400 text-white font-semibold h-full px-5 rounded-full transition-all flex items-center justify-center gap-2 shadow-sm text-sm"
                  >
                    <Play size={16} className="fill-current" /> Retry
                  </button>
                )}
                <button
                  onClick={handleClear}
                  className="h-full px-3 bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-full transition-colors flex items-center justify-center"
                  title="Clear All Files"
                >
                  <Trash2 size={16} />
                </button>
              </motion.div>
            )}

            {isProcessing && (
              <motion.div 
                key="processing"
                initial={{ opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0 }}
                animate={{ opacity: 1, width: 'auto', paddingLeft: 12, paddingRight: 16 }}
                exit={{ opacity: 0, width: 0, paddingLeft: 0, paddingRight: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex items-center gap-3 border-l border-slate-200 dark:border-slate-700 h-full min-w-[200px] overflow-hidden"
              >
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] font-bold tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 uppercase">
                    <span className="flex items-center gap-1.5"><Loader2 size={10} className="animate-spin text-cyan-500" /> Processing</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 shadow-inner">
                    <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300 shadow-sm" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}


