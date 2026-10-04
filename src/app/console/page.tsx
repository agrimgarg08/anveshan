'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Layers } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';

import GroupedAnalytics from '@/components/console/GroupedAnalytics';
import SingleView from '@/components/console/SingleView';
import UploadWidget from '@/components/console/UploadWidget';
import QueueDrawer from '@/components/console/QueueDrawer';
import TopControls from '@/components/console/TopControls';

import { useFileProcessing } from '@/hooks/useFileProcessing';
import { ReportEntry } from '@/types';

export default function Dashboard() {
  const router = useRouter();
  const { authenticated, authReady } = useAuth();
  const { resolvedTheme } = useTheme();

  const mapTheme = resolvedTheme === 'dark' ? 'dark_all' : 'light_all';
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${mapTheme}/{z}/{x}/{y}{r}.png${cartoApiKey ? '?key=' + encodeURIComponent(cartoApiKey) : ''}`;

  // State Management
  const { queue, processingStatus, activeViewIndex, setActiveViewIndex, handleFileChange, handleClear, handleRemoveQueueItem, startProcessing, processAddedFiles } = useFileProcessing();
  const [viewMode, setViewMode] = useState<'single' | 'grouped'>('single');
  const [isDragging, setIsDragging] = useState(false);
  const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

  // Map icon fix for leaflet
  const [leafletLib, setLeafletLib] = useState<typeof import('leaflet') | null>(null);

  useEffect(() => {
    import('leaflet').then((leaflet) => {
      // @ts-expect-error - Leaflet private API
      delete (leaflet.Icon.Default.prototype)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeafletLib(leaflet);
    });
  }, []);

  useEffect(() => {
    if (authReady && !authenticated) {
      router.replace('/login');
    }
  }, [authReady, authenticated, router]);


  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!e.dataTransfer) return;

    const items = Array.from(e.dataTransfer.items);
    const files: File[] = [];

    interface WebkitEntry {
      isFile: boolean;
      isDirectory: boolean;
      name: string;
      file: (cb: (file: File) => void) => void;
      createReader: () => { readEntries: (cb: (entries: WebkitEntry[]) => void) => void };
    }

    const traverseFileTree = async (item: WebkitEntry, path: string = '') => {
      return new Promise<void>((resolve) => {
        if (item.isFile) {
          item.file((file: File) => {
            files.push(file);
            resolve();
          });
        } else if (item.isDirectory) {
          const dirReader = item.createReader();
          dirReader.readEntries(async (entries: WebkitEntry[]) => {
            for (const entry of entries) {
              await traverseFileTree(entry, path + item.name + '/');
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    const traversePromises = items.map((item) => {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry() as unknown as WebkitEntry;
        if (entry) {
          return traverseFileTree(entry);
        }
      }
      return Promise.resolve();
    });

    await Promise.all(traversePromises);

    if (files.length > 0) {
      processAddedFiles(files);
      setIsQueueDrawerOpen(true);
    }
  };


  // Global Aggregations
  const globalReport: (ReportEntry & { source_file: string })[] = [];
  queue.forEach(item => {
    if (item.status === 'done' && item.data?.report) {
      item.data.report.forEach((entry: ReportEntry) => {
        globalReport.push({ ...entry, source_file: item.file.name });
      });
    }
  });

  const downloadJson = () => {
    if (globalReport.length === 0) return;
    const blob = new Blob([JSON.stringify(globalReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_batch_report.json';
    a.click();
  };

  const downloadCsv = () => {
    if (globalReport.length === 0) return;
    const headers = Object.keys(globalReport[0]).join(',');
    const rows = globalReport.map((r) =>
      Object.values(r).map(v => {
        if (typeof v === 'object' && v !== null) {
          return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        }
        if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_batch_report.csv';
    a.click();
  };

  if (!authReady || !authenticated) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-transparent text-slate-500 dark:text-slate-400 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </main>
    );
  }

  const activeItem = queue[activeViewIndex];
  const processedCount = queue.filter(q => q.status === 'done').length;
  const errorCount = queue.filter(q => q.status === 'error').length;
  const pendingCount = queue.filter(q => q.status === 'pending').length;

  return (
    <div
      className="flex-1 bg-transparent text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500/30 flex flex-col transition-colors min-h-screen pb-6 relative"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
      }}
    >
      {isDragging && (
        <div
          className="fixed inset-0 z-[100]"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
          }}
          onDrop={(e) => {
            handleDrop(e);
          }}
        />
      )}

      <QueueDrawer
        queue={queue}
        activeViewIndex={activeViewIndex}
        setActiveViewIndex={setActiveViewIndex}
        setViewMode={setViewMode}
        handleRemoveQueueItem={handleRemoveQueueItem}
        processingStatus={processingStatus}
        processedCount={processedCount}
        isOpen={isQueueDrawerOpen}
        setIsOpen={setIsQueueDrawerOpen}
      />


      {/* Main Content Area */}
      <motion.main
        initial={false}
        animate={{
          paddingLeft: isQueueDrawerOpen ? 320 + 24 : 24,
          paddingRight: 24
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex-1 w-full flex flex-col pt-0 pb-20 md:pb-32"
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-[1200px] w-full mx-auto flex flex-col"
        >
          <TopControls
            viewMode={viewMode}
            setViewMode={setViewMode}
            globalReport={globalReport}
            downloadJson={downloadJson}
            downloadCsv={downloadCsv}
            showTabs={queue.length > 0}
          />

          <AnimatePresence mode="wait">
            {queue.length === 0 && (
              <motion.div
                key="empty-queue"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="h-full w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 transition-colors min-h-[500px]"
              >
                <Layers className="w-16 h-16 mb-4 text-slate-300 dark:text-slate-700" />
                <p className="text-lg font-medium text-slate-700 dark:text-slate-300">Upload Data to Begin</p>
                <p className="text-sm mt-2 max-w-sm text-center">Drag and drop a folder of images, multiple selected images, or a ZIP archive into the upload area.</p>
              </motion.div>
            )}

            {queue.length > 0 && viewMode === 'single' && activeItem && (
              <motion.div
                key="single-view"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Viewer */}
                <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors">
                  <div className="flex items-center justify-between mb-4 h-8">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate pr-4">
                      <ImageIcon size={20} className="text-cyan-600 dark:text-cyan-500 shrink-0" />
                      <span className="truncate">{activeItem.file.name}</span>
                    </h2>

                    {/* Pagination Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border border-slate-200 dark:border-slate-700">
                      <button
                        disabled={activeViewIndex === 0}
                        onClick={() => setActiveViewIndex(prev => prev - 1)}
                        className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed"
                        title="Previous Image"
                      ><ChevronLeft size={16} /></button>
                      <span className="text-xs font-medium px-2 min-w-[40px] text-center text-slate-700 dark:text-slate-300" title="Current Image">{activeViewIndex + 1} / {queue.length}</span>
                      <button
                        disabled={activeViewIndex === queue.length - 1}
                        onClick={() => setActiveViewIndex(prev => prev + 1)}
                        className="p-1 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50 shadow-sm transition-transform active:scale-95 disabled:cursor-not-allowed"
                        title="Next Image"
                      ><ChevronRight size={16} /></button>
                    </div>
                  </div>

                  <SingleView
                    activeItem={activeItem}
                    mapTheme={mapTheme}
                    cartoTileUrl={cartoTileUrl}
                    leafletLib={leafletLib}
                  />
                </div>
              </motion.div>
            )}

            {queue.length > 0 && viewMode === 'grouped' && (
              <motion.div
                key="grouped-view"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}
              >
                <GroupedAnalytics
                  processedCount={processedCount}
                  totalQueue={queue.length}
                  globalReport={globalReport}
                  cartoTileUrl={cartoTileUrl}
                  mapTheme={mapTheme}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.main>

      {/* Sticky Bottom Area for Upload Widget */}
      <div className="sticky bottom-6 w-full h-[64px] z-30 pointer-events-none mt-auto flex justify-center">
        <div className="pointer-events-auto relative w-full flex justify-center">
          <div className="absolute bottom-0 flex justify-center">
            <UploadWidget
              queue={queue}
              isDragging={isDragging}
              handleFileChange={(e) => {
                handleFileChange(e);
                if (e.target.files && e.target.files.length > 0) setIsQueueDrawerOpen(true);
              }}
              handleClear={() => {
                handleClear();
                setIsQueueDrawerOpen(false);
              }}
              processingStatus={processingStatus}
              pendingCount={pendingCount}
              processedCount={processedCount}
              errorCount={errorCount}
              startProcessing={startProcessing}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
