'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Clock, Loader2, Trash2, X, List } from 'lucide-react';
import { QueueItem, ViewMode } from '@/types';

interface QueueDrawerProps {
  queue: QueueItem[];
  activeViewIndex: number;
  setActiveViewIndex: (idx: number) => void;
  setViewMode: (mode: ViewMode) => void;
  handleRemoveQueueItem: (id: string, e: React.MouseEvent) => void;
  processingStatus: 'idle' | 'processing' | 'done';
  processedCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function QueueDrawer({
  queue,
  activeViewIndex,
  setActiveViewIndex,
  setViewMode,
  handleRemoveQueueItem,
  processingStatus,
  processedCount,
  isOpen,
  setIsOpen
}: QueueDrawerProps) {
  const [filter, setFilter] = useState<'all' | 'done' | 'error'>('all');
  const errorCount = queue.filter(q => q.status === 'error').length;
  
  const filteredQueue = queue.map((q, originalIdx) => ({ ...q, originalIdx })).filter(q => {
    if (filter === 'all') return true;
    return q.status === filter;
  });

  return (
    <>


      {/* The Drawer */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed top-[104px] left-0 h-[calc(100vh-104px)] w-[320px] bg-white dark:bg-slate-900 border-t border-r border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col pt-4 pb-4"
      >
        {/* Attached Toggle Button */}
        {queue.length > 0 && (
          <button
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Close File Queue" : "Open File Queue"}
            className="absolute -top-[1px] -right-[48px] w-[48px] h-[48px] bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 shadow-[4px_4px_12px_rgb(0,0,0,0.05)] dark:shadow-[4px_4px_12px_rgb(0,0,0,0.3)] rounded-r-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer outline-none [clip-path:inset(-50px_-50px_-50px_0)]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isOpen ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-center">
                  <X size={20} />
                </motion.div>
              ) : (
                <motion.div key="list" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }} className="flex items-center justify-center">
                  <List size={20} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        )}

        <div className="px-5 mb-6 shrink-0 mt-2 space-y-3">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-wide">
            File Queue
          </h3>
          <div className="flex items-center gap-2 font-medium text-xs">
            <button 
              onClick={() => setFilter('all')}
              className={`px-2 py-1.5 rounded-lg border shadow-sm flex-1 text-center transition-all ${filter === 'all' ? 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              Total: {queue.length}
            </button>
            <button 
              onClick={() => setFilter(filter === 'done' ? 'all' : 'done')}
              className={`px-2 py-1.5 rounded-lg border shadow-sm flex-1 text-center transition-all ${filter === 'done' ? 'bg-emerald-100 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/50' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'}`}
            >
              Done: {processedCount}
            </button>
            <button 
              onClick={() => setFilter(filter === 'error' ? 'all' : 'error')}
              className={`px-2 py-1.5 rounded-lg border shadow-sm flex-1 text-center transition-all ${filter === 'error' ? 'bg-red-100 dark:bg-red-500/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/50' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20'}`}
            >
              Failed: {errorCount}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-2 px-5 custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {filteredQueue.length === 0 && queue.length > 0 && (
              <motion.div 
                key="empty-filtered"
                layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                className="text-sm text-slate-500 text-center mt-10 border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-xl"
              >
                No files in this state
              </motion.div>
            )}
            {queue.length === 0 && (
              <motion.div 
                key="empty-queue"
                layout
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }}
                className="text-sm text-slate-500 text-center mt-10 border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-xl"
              >
                Queue is empty
              </motion.div>
            )}
            {filteredQueue.map((qItem) => {
              const isSelected = activeViewIndex === qItem.originalIdx;

              return (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.2 }}
                  role="button"
                  key={qItem.id}
                  onClick={() => {
                    setActiveViewIndex(qItem.originalIdx);
                    setViewMode('single');
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all 
                                  ${isSelected ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-500/50 dark:bg-cyan-500/10 shadow-sm' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-white dark:hover:bg-slate-800'}`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 relative border border-slate-200 dark:border-slate-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qItem.previewUrl} alt="thumb" className="w-full h-full object-cover" />
                    {qItem.status === 'processing' && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-white" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">{qItem.file.name}</p>
                  </div>
                  {qItem.status === 'done' && <span title="Processed" className="shrink-0 flex items-center"><CheckCircle size={16} className="text-emerald-500" /></span>}
                  {qItem.status === 'error' && <span title="Failed" className="shrink-0 flex items-center"><XCircle size={16} className="text-red-500" /></span>}
                  {qItem.status === 'pending' && <span title="Pending" className="shrink-0 flex items-center"><Clock size={16} className="text-slate-400" /></span>}
                  {qItem.status === 'processing' && <span title="Processing" className="shrink-0 flex items-center"><Loader2 size={16} className="animate-spin text-cyan-500" /></span>}
                  {processingStatus !== 'processing' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveQueueItem(qItem.id, e);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-colors shrink-0"
                      title="Remove file"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
