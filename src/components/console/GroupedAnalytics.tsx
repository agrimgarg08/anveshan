'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Map as MapIcon, Target, Navigation, Maximize, X, Layers, AlertTriangle, Activity } from 'lucide-react';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const HeatmapLayer = dynamic(() => import('@/components/console/HeatmapLayer'), { ssr: false });

import { ReportEntry } from '@/types';
import type { Map as LeafletMap } from 'leaflet';

interface GroupedAnalyticsProps {
  processedCount: number;
  totalQueue: number;
  globalReport: (ReportEntry & { source_file: string })[];
  cartoTileUrl: string;
  mapTheme: string;
}

export default function GroupedAnalytics({ processedCount, totalQueue, globalReport, cartoTileUrl, mapTheme }: GroupedAnalyticsProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [isMapMaximized, setIsMapMaximized] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const controls = useAnimation();

  const displayedReport = selectedCategories.length > 0
    ? globalReport.filter(r => selectedCategories.includes(r.image_class.replace(/_/g, ' ')))
    : globalReport;

  const handleToggleMaximize = async () => {
    // 1. Fade out and slide up (like exit transition)
    await controls.start({ opacity: 0, y: -10, transition: { duration: 0.2 } });

    // 2. Snap the layout change behind the scenes
    setIsMapMaximized(!isMapMaximized);

    // 3. Immediately snap position to bottom so it can slide up to 0, matching view changes
    controls.set({ y: 10 });

    // Wait for React to render the new classes and Leaflet to catch up
    setTimeout(async () => {
      if (map) {
        map.invalidateSize();
        map.fire('moveend');
      }
      // 4. Fade in and slide to final position (like enter transition)
      await controls.start({ opacity: 1, y: 0, transition: { duration: 0.2 } });
    }, 10);
  };

  useEffect(() => {
    if (isMapMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMapMaximized]);

  useEffect(() => {
    if (!map) return;
    map.scrollWheelZoom.disable();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) map.scrollWheelZoom.enable();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) map.scrollWheelZoom.disable();
    };
    const handleBlur = () => {
      map.scrollWheelZoom.disable();
    };
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (!map.scrollWheelZoom.enabled()) map.scrollWheelZoom.enable();
      } else {
        if (map.scrollWheelZoom.enabled()) map.scrollWheelZoom.disable();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('wheel', handleWheel, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [map]);

  const toggleCategory = (className: string) => {
    setSelectedCategories(prev =>
      prev.includes(className)
        ? prev.filter(c => c !== className)
        : [...prev, className]
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Queue Status (Bento small left) */}
        <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Layers size={20} className="text-cyan-600 dark:text-cyan-500" />
            File Queue
          </h2>
          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">{processedCount}</p>
              <p className="text-base sm:text-lg font-medium text-slate-400">/ {totalQueue}</p>
            </div>
            <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Processed Items</p>
          </div>
        </div>

        {/* Card 2: Detections (Bento wide right) */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm flex flex-col">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Activity size={20} className="text-emerald-500" />
            Detection Insights
          </h2>

          <div className="grid grid-cols-3 gap-4 divide-x divide-slate-200/60 dark:divide-slate-800/60">
            <div className="flex flex-col gap-1 pr-2 sm:pr-4">
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">{globalReport.length}</p>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Total Found</p>
            </div>

            <div className="flex flex-col gap-1 px-2 sm:px-4">
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
                {globalReport.filter(r => r.flagged_for_review).length}
              </p>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Flagged</p>
            </div>

            <div className="flex flex-col gap-1 pl-2 sm:pl-4">
              <p className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">
                {globalReport.some(r => r.confidence != null) ? `${(globalReport.reduce((acc, curr) => acc + (curr.confidence ?? 0), 0) / globalReport.filter(r => r.confidence != null).length).toFixed(1)}%` : 'N/A'}
              </p>
              <p className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">Avg Confidence</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Global Map Backdrop */}
        <AnimatePresence>
          {isMapMaximized && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[41]"
              onClick={handleToggleMaximize}
            />
          )}
        </AnimatePresence>

        {/* Global Map Wrapper */}
        <div className="lg:col-span-2 h-[500px]">
          <motion.div
            animate={controls}
            className={
              isMapMaximized
                ? "fixed top-[104px] bottom-4 left-4 right-4 md:left-10 md:right-10 md:bottom-10 z-[42] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-2xl"
                : "w-full h-full bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col shadow-sm backdrop-blur-sm"
            }
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <MapIcon size={20} className="text-emerald-500" /> Global Heatmap
                <span className="text-xs font-normal text-slate-400 ml-2 hidden sm:inline">(Ctrl + Scroll to zoom)</span>
              </h2>
              <div className="flex items-center gap-2">
                {displayedReport && displayedReport.length > 0 && (
                  <button
                    onClick={() => {
                      if (map && displayedReport.length > 0) {
                        const lats = displayedReport.map((r) => r.latitude);
                        const lons = displayedReport.map((r) => r.longitude);
                        map.fitBounds([
                          [Math.min(...lats), Math.min(...lons)],
                          [Math.max(...lats), Math.max(...lons)]
                        ], { padding: [50, 50], maxZoom: 4 });
                      }
                    }}
                    className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                    title="Recenter Map"
                  >
                    <Navigation size={16} className="-ml-[1px] mt-[1px]" />
                  </button>
                )}
                <button
                  onClick={handleToggleMaximize}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                  title={isMapMaximized ? "Minimize Map" : "Maximize Map"}
                >
                  {isMapMaximized ? <X size={16} /> : <Maximize size={16} />}
                </button>
              </div>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0 relative bg-slate-100 dark:bg-slate-900">
              {displayedReport.length > 0 ? (
                <MapContainer
                  ref={setMap}
                  key={`global-map-${globalReport.length}`}
                  bounds={[
                    [Math.min(...displayedReport.map((r) => r.latitude)), Math.min(...displayedReport.map((r) => r.longitude))],
                    [Math.max(...displayedReport.map((r) => r.latitude)), Math.max(...displayedReport.map((r) => r.longitude))]
                  ]}
                  boundsOptions={{ padding: [50, 50], maxZoom: 4 }}
                  style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }}
                  className="z-0"
                  scrollWheelZoom={false}
                >
                  <TileLayer key={mapTheme} url={cartoTileUrl} attribution='&copy; OpenStreetMap' />
                  <HeatmapLayer key={`${mapTheme}-${isMapMaximized}-${selectedCategories.join('-')}`} theme={mapTheme} points={displayedReport.map((entry) => [entry.latitude, entry.longitude, (entry.confidence ?? 50) / 100])} />
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm">No geographic data for this selection.</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Global Ledger */}
        <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-[500px] flex flex-col shadow-sm backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4 h-8">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Target size={20} className="text-cyan-600 dark:text-cyan-500" /> Detections by Category
            </h2>
            <AnimatePresence>
              {selectedCategories.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedCategories([])}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded transition-colors whitespace-nowrap"
                >
                  Show All
                </motion.button>
              )}
            </AnimatePresence>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {globalReport.length > 0 ? (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {Object.entries(
                    globalReport.reduce((acc: Record<string, { count: number, flagged: number }>, curr) => {
                      const cls = curr.image_class.replace(/_/g, ' ');
                      if (!acc[cls]) acc[cls] = { count: 0, flagged: 0 };
                      acc[cls].count++;
                      if (curr.flagged_for_review) acc[cls].flagged++;
                      return acc;
                    }, {})
                  ).sort((a, b) => b[1].count - a[1].count).map(([className, stats]) => {
                    const isSelected = selectedCategories.includes(className);
                    const isOtherSelected = selectedCategories.length > 0 && !isSelected;
                    return (
                      <motion.div
                        key={className}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isOtherSelected ? 0.4 : 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => toggleCategory(className)}
                        className={`flex justify-between items-center pl-4 pr-2 py-3 rounded-xl border cursor-pointer transition-all ${isSelected
                          ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-500/50 dark:bg-cyan-500/10 shadow-sm'
                          : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-white dark:hover:bg-slate-800'
                          }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className={`font-semibold text-sm capitalize transition-colors ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-900 dark:text-slate-200'}`}>{className}</p>
                            {stats.flagged > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${isSelected
                                ? 'bg-orange-500 text-white dark:bg-orange-500'
                                : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                                }`}>
                                {stats.flagged} Flagged
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={`text-xl font-semibold transition-colors ${isSelected ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-800 dark:text-slate-100'}`}>{stats.count}</div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/30">
                No detections yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
