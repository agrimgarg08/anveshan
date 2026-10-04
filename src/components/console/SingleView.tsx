'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertTriangle, MapIcon, Target, CheckCircle, Navigation, Image as ImageIcon } from 'lucide-react';
import { QueueItem, ReportEntry } from '@/types';
import type { Map as LeafletMap } from 'leaflet';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

interface SingleViewProps {
  activeItem: QueueItem | undefined;
  mapTheme: string;
  cartoTileUrl: string;
  leafletLib: typeof import('leaflet') | null;
}

export default function SingleView({ activeItem, mapTheme, cartoTileUrl, leafletLib }: SingleViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [map, setMap] = useState<LeafletMap | null>(null);

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

  useEffect(() => {
    if (activeItem && canvasRef.current) {
      if (activeItem.status !== 'done' || !activeItem.data || !activeItem.data.cleaned_image) {
        // Clear canvas if not done
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        return;
      }

      const activeData = activeItem.data;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (activeData.report) {
          activeData.report.forEach((d: ReportEntry) => {
            const bbox = d.bbox || d.bbox_px;
            if (!bbox) return; // safety check
            const [x, y, w, h] = bbox;
            const flagged = d.flagged_for_review;

            ctx.strokeStyle = flagged ? '#f97316' : '#10b981';
            ctx.lineWidth = 3;
            if (flagged) {
              ctx.setLineDash([8, 6]);
            } else {
              ctx.setLineDash([]);
            }

            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
            const confidence = d.confidence == null ? `${d.confidence_label ?? 'unrated'} (qualitative)` : `${d.confidence.toFixed(0)}%`;
            const label = `${d.image_class?.replace(/_/g, ' ') || 'Unknown'} ${confidence}`;
            const textMetrics = ctx.measureText(label);
            ctx.fillRect(x, Math.max(0, y - 24), textMetrics.width + 12, 24);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x + 6, Math.max(16, y - 8));
          });
        }
      };
      img.src = `data:image/png;base64,${activeData.cleaned_image}`;
    }
  }, [activeItem]);

  if (!activeItem) {
    return (
      <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center p-8">
        <div className="text-slate-600 dark:text-slate-400 font-medium text-lg">No Selection</div>
        <p className="text-xs text-slate-500">Click &quot;Process&quot; in the upload menu to begin.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm">
        {activeItem.status === 'pending' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 text-center p-8">
            <div className="text-slate-600 dark:text-slate-400 font-medium text-lg">Ready to Analyze</div>
            <p className="text-xs text-slate-500">Click &quot;Process&quot; in the upload menu to begin.</p>
          </div>
        )}

        {activeItem.status === 'processing' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-3" />
            <div className="text-slate-600 dark:text-slate-300 font-medium">Analyzing Image...</div>
          </div>
        )}

        {activeItem.status === 'error' && (
          <div className="aspect-[21/9] flex flex-col items-center justify-center bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-3" />
            <div className="text-red-700 dark:text-red-400 font-medium mb-1">Analysis Failed</div>
            <p className="text-xs text-red-600/80 dark:text-red-400/80 max-w-md text-center">{activeItem.error}</p>
          </div>
        )}

        {activeItem.status === 'done' && activeItem.data && (
          <div>
            <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
              Detected via: {activeItem.data.source === 'gemini' ? 'Gemini' : activeItem.data.source === 'local_yolo' ? 'local YOLO' : 'demo data'}
              {activeItem.data.fallback_reason && ` (fallback: ${activeItem.data.fallback_reason})`}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Raw Input</h3>
              </div>
              <motion.div
                key={`raw-${activeItem.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeItem.previewUrl} alt="Raw" className="max-w-full max-h-full object-contain" />
              </motion.div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-700 dark:text-slate-300 uppercase tracking-wider">Detections</h3>
              </div>
              <motion.div
                key={`det-${activeItem.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center relative"
              >
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
              </motion.div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Meta Info (Map + Ledger) */}
      {activeItem.status === 'done' && activeItem.data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map View */}
          <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                <MapIcon size={20} className="text-emerald-500" /> Geolocation
                <span className="text-xs font-normal text-slate-400 ml-2 hidden sm:inline">(Ctrl + Scroll to zoom)</span>
              </h2>
              {activeItem.data.report && activeItem.data.report.length > 0 && (
                <button
                  onClick={() => {
                    const report = activeItem.data?.report;
                    if (map && report && report.length > 0) {
                      map.setView([report[0].latitude, report[0].longitude], 4);
                    }
                  }}
                  className="p-1.5 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
                  title="Recenter Map"
                >
                  <Navigation size={16} className="-ml-[1px] mt-[1px]" />
                </button>
              )}
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 z-0 relative bg-slate-100 dark:bg-slate-900">
              {activeItem.data.report && activeItem.data.report.length > 0 ? (
                <MapContainer ref={setMap} key={`map-${activeItem.id}`} center={[activeItem.data.report[0].latitude, activeItem.data.report[0].longitude]} zoom={4} style={{ height: '100%', minHeight: '300px', width: '100%', backgroundColor: 'transparent' }} className="z-0" scrollWheelZoom={false}>
                  <TileLayer key={mapTheme} url={cartoTileUrl} attribution='&copy; OpenStreetMap' />
                  {activeItem.data.report.map((entry: ReportEntry) => {
                    const iconHtml = entry.flagged_for_review
                      ? '<div style="background-color:#f97316; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
                      : '<div style="background-color:#10b981; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>';
                    const customIcon = leafletLib ? leafletLib.divIcon({ html: iconHtml, className: '', iconSize: [16, 16], iconAnchor: [8, 8] }) : undefined;
                    return (
                      <Marker key={entry.detection_id} position={[entry.latitude, entry.longitude]} icon={customIcon}>
                        <Popup><div className="font-semibold capitalize text-slate-900">{entry.image_class.replace(/_/g, ' ')}</div><div className="text-slate-600">{entry.confidence == null ? `Qualitative: ${entry.confidence_label ?? 'unrated'}` : `${entry.confidence.toFixed(1)}%`}</div></Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm">No geographic data.</div>
              )}
            </div>
          </div>

          {/* Ledger */}
          <div className="lg:col-span-1 bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col h-[400px]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-900 dark:text-slate-100"><Target size={20} className="text-cyan-600 dark:text-cyan-500" /> Detection Ledger</h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {activeItem.data.report && activeItem.data.report.length > 0 ? (
                <div className="space-y-2">
                  {activeItem.data.report.map((entry: ReportEntry, idx: number) => (
                    <motion.div
                      key={`${activeItem.id}-${entry.detection_id}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                      className={`flex justify-between items-center px-4 py-2.5 rounded-lg border ${entry.flagged_for_review ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-500/20' : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-500/20'}`}
                    >
                      <div className="flex flex-col justify-center gap-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-200 capitalize leading-none">{entry.image_class.replace(/_/g, ' ')}</p>
                        <span className="text-[10px] font-mono text-slate-500 leading-none">{entry.detection_id}</span>
                      </div>
                      <div className="text-xl font-semibold text-slate-800 dark:text-slate-100">{entry.confidence == null ? entry.confidence_label ?? 'unrated' : <>{entry.confidence.toFixed(0)}<span className="text-sm text-slate-500 font-medium ml-0.5">%</span></>}</div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div
                  key={`empty-${activeItem.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 bg-slate-50 dark:bg-slate-900/30"
                >
                  <CheckCircle size={32} className="text-emerald-500/50 mb-3" />
                  <p className="font-medium text-slate-700 dark:text-slate-300">All Clear</p>
                  <p className="mt-1 text-center">No targets detected matching the anomaly threshold.</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
