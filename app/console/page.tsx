/* eslint-disable */
'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, Download, FileJson, FileSpreadsheet, Map as MapIcon, Image as ImageIcon, CheckCircle, AlertTriangle, Loader2, BarChart } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';

// Dynamically import map components because they require window object
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function Dashboard() {
  const router = useRouter();
  const { authenticated, authReady } = useAuth();
  const { resolvedTheme } = useTheme();

  const mapTheme = resolvedTheme === 'dark' ? 'dark_all' : 'light_all';
  const cartoApiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  const cartoTileUrl = `https://{s}.basemaps.cartocdn.com/rastertiles/${mapTheme}/{z}/{x}/{y}{r}.png${cartoApiKey ? `?key=${encodeURIComponent(cartoApiKey)}` : ''
    }`;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [result, setResult] = useState<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (authReady && !authenticated) {
      router.replace('/login');
    }
  }, [authReady, authenticated, router]);

  const handleFile = (selectedFile: File) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Invalid file type. Please upload a JPEG or PNG image.');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
    setApiError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };



  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setApiError(null);

    const formData = new FormData();
    formData.append('file', file);

    const promise = fetch('/api/process', {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || 'The processing API returned an error.');
      }
      return res.json();
    });

    toast.promise(promise, {
      loading: 'Analyzing Sonar Image...',
      success: (data) => {
        setResult(data);
        return `Analysis complete! Found ${data.report?.length || 0} detections.`;
      },
      error: (err) => {
        setApiError(err.message);
        return err.message;
      }
    });

    promise.catch(() => { }).finally(() => setLoading(false));
  };

  // Draw bounding boxes on canvas
  useEffect(() => {
    if (result && result.cleaned_image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        if (result.detections) {
          result.detections.forEach((d: any) => {
            const [x, y, w, h] = d.bbox;
            const flagged = d.flagged_for_review;

            // Neon-like colors
            ctx.strokeStyle = flagged ? '#f97316' : '#10b981'; // orange-500 : emerald-500
            ctx.lineWidth = 3;

            if (flagged) {
              ctx.setLineDash([8, 6]);
            } else {
              ctx.setLineDash([]);
            }

            ctx.strokeRect(x, y, w, h);

            ctx.setLineDash([]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = 'bold 13px Inter, sans-serif';
            const label = `${d.class} ${d.final_confidence.toFixed(0)}%`;
            const textMetrics = ctx.measureText(label);
            ctx.fillRect(x, Math.max(0, y - 24), textMetrics.width + 12, 24);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(label, x + 6, Math.max(16, y - 8));
          });
        }
      };
      img.src = `data:image/png;base64,${result.cleaned_image}`;
    }
  }, [result]);

  const downloadJson = () => {
    if (!result || !result.report) return;
    const blob = new Blob([JSON.stringify(result.report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_report.json';
    a.click();
  };

  const downloadCsv = () => {
    if (!result || !result.report || result.report.length === 0) return;
    const headers = Object.keys(result.report[0]).join(',');
    const rows = result.report.map((r: any) =>
      Object.values(r).map(v => {
        if (typeof v === 'object' && v !== null) {
          return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
        }
        if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\\n'))) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      }).join(',')
    );
    const csv = [headers, ...rows].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anveshan_report.csv';
    a.click();
  };

  const [leafletLib, setLeafletLib] = useState<any>(null);

  // Map icon fix for leaflet
  useEffect(() => {
    import('leaflet').then((leaflet) => {
      delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
      leaflet.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeafletLib(leaflet);
    });
  }, []);

  if (!authReady || !authenticated) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-transparent text-slate-500 dark:text-slate-400 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </main>
    );
  }

  return (
    <div
      className="flex-1 bg-transparent text-slate-900 dark:text-slate-200 font-sans selection:bg-cyan-500/30 flex flex-col transition-colors"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        setIsDragging(true);
      }}
    >
      {/* Invisible full-screen drag overlay to handle drops anywhere and prevent child flicker */}
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
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFile(e.dataTransfer.files[0]);
            }
          }}
        />
      )}

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

          {/* Left Column: Upload & Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="xl:col-span-4 space-y-6"
          >
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm min-h-[400px] flex flex-col shadow-sm dark:shadow-none transition-colors">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                <UploadCloud size={20} className="text-cyan-600 dark:text-cyan-400" /> Upload Sonar Data
              </h2>

              {/* Drag and drop area */}
              <div
                tabIndex={0}
                onClick={() => document.getElementById('file-upload')?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('file-upload')?.click();
                  }
                }}
                className={`relative flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900
                  ${isDragging ? 'border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-400/5' : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}
                  ${file ? 'border-solid border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900' : ''}`}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {file ? (
                  <div className="flex flex-col items-center w-full max-w-[240px] overflow-hidden">
                    <ImageIcon className="w-10 h-10 text-cyan-600 dark:text-cyan-500 mb-3 shrink-0" />
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-200 truncate w-full">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreviewUrl(null); setResult(null); }}
                      className="mt-4 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 text-xs font-medium transition-colors duration-300"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 transition-colors">
                      <UploadCloud className="w-6 h-6 text-slate-500 dark:text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload or drag and drop</p>
                    <p className="text-xs text-slate-500 mt-2">PNG or JPG (max. 10MB)</p>
                  </div>
                )}
              </div>

              {previewUrl && (
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className="mt-6 w-full bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> Analyzing Sonar Image...</>
                  ) : (
                    <><MapIcon size={18} /> Run Pipeline Detection</>
                  )}
                </button>
              )}

            </div>

            {/* Reports Card */}
            {result && result.report && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm shadow-sm dark:shadow-none transition-colors"
              >
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <Download size={20} className="text-indigo-600 dark:text-indigo-400" /> Export Reports
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={downloadJson}
                    className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 transition"
                  >
                    <FileJson size={18} className="text-slate-500 dark:text-slate-400" /> JSON
                  </button>
                  <button
                    onClick={downloadCsv}
                    className="flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 transition"
                  >
                    <FileSpreadsheet size={18} className="text-slate-500 dark:text-slate-400" /> CSV
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Right Column: Visualization */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="xl:col-span-8 space-y-6"
          >

            {/* Image Preview & Results */}
            <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm min-h-[400px] flex flex-col shadow-sm dark:shadow-none transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ImageIcon size={20} className="text-blue-600 dark:text-blue-400" /> Sonar Analysis View
                </h2>
                {result && (
                  <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5">
                    <CheckCircle size={14} /> Processing Complete
                  </span>
                )}
              </div>

              {!previewUrl && !loading && !result && (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/30 text-slate-500 transition-colors">
                  <p>Upload a sonar image to begin analysis</p>
                </div>
              )}

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="w-full space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div>
                        <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800/20 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800/50"></div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800/50 rounded animate-pulse"></div>
                        <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800/20 rounded-xl animate-pulse border border-slate-200 dark:border-slate-800/50"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewUrl && !result && !loading && (
                <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black flex items-center justify-center transition-colors">
                  <img src={previewUrl} alt="Upload Preview" className="max-w-full max-h-[600px] object-contain" />
                </div>
              )}

              {result && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Raw Input</h3>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center transition-colors">
                      <img src={previewUrl!} alt="Original Input" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Detections (Preprocessed)</h3>
                    </div>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-100 dark:bg-black aspect-square flex items-center justify-center relative transition-colors">
                      <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Map and Detection List (Only if result exists) */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Map View */}
                <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col shadow-sm dark:shadow-none transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <MapIcon size={20} className="text-emerald-600 dark:text-emerald-400" /> Geolocation
                    </h2>
                  </div>
                  {result.is_real_location ? (
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-200/80 text-xs px-3 py-2 rounded-lg mb-4 flex gap-2 items-start transition-colors">
                      <CheckCircle size={14} className="shrink-0 mt-0.5" />
                      <p>Real GPS Coordinates extracted from image EXIF metadata.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-200/80 text-xs px-3 py-2 rounded-lg mb-4 flex gap-2 items-start transition-colors">
                      <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                      <p>No EXIF GPS data found. Coordinates are simulated for this prototype.</p>
                    </div>
                  )}

                  <div className="flex-1 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 min-h-[300px] z-0 relative transition-colors">
                    {result.report && result.report.length > 0 ? (
                      <MapContainer
                        center={[result.report[0].latitude, result.report[0].longitude]}
                        zoom={4}
                        style={{ height: '100%', width: '100%' }}
                        className="z-0"
                      >
                        <TileLayer
                          key={mapTheme}
                          url={cartoTileUrl}
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        />
                        {result.report.map((entry: any) => {
                          const iconHtml = entry.flagged_for_review
                            ? '<div style="background-color:#f97316; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>'
                            : '<div style="background-color:#10b981; width:16px; height:16px; border-radius:50%; border:2px solid white; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>';
                          const customIcon = leafletLib ? leafletLib.divIcon({
                            html: iconHtml,
                            className: '',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8],
                          }) : undefined;
                          return (
                            <Marker key={entry.detection_id} position={[entry.latitude, entry.longitude]} icon={customIcon}>
                              <Popup className="text-slate-900 font-sans">
                                <div className="font-semibold capitalize">{entry.image_class.replace(/_/g, ' ')}</div>
                                <div className="text-sm text-slate-600">Confidence: {entry.confidence.toFixed(1)}%</div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-500 text-sm transition-colors">
                        No geographic data available for mapping.
                      </div>
                    )}
                  </div>
                </div>

                {/* Detection Ledger */}
                <div className="bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col shadow-sm dark:shadow-none transition-colors">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <BarChart size={20} className="text-purple-600 dark:text-purple-400" /> Detection Ledger
                  </h2>
                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {result.report && result.report.length > 0 ? (
                      <div className="space-y-3">
                        {result.report.map((entry: any) => (
                          <div
                            key={entry.detection_id}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${entry.flagged_for_review
                              ? 'bg-orange-50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/20'
                              : 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20'
                              }`}
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-slate-200 capitalize">{entry.image_class.replace(/_/g, ' ')}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{entry.detection_id}</span>
                                {entry.flagged_for_review && (
                                  <span className="bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded transition-colors">
                                    Needs Review
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xl font-mono text-slate-800 dark:text-slate-100">{entry.confidence.toFixed(1)}<span className="text-sm text-slate-500">%</span></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-900/30 transition-colors">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 transition-colors">
                          <CheckCircle size={32} className="text-emerald-500/50" />
                        </div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">All Clear</p>
                        <p className="mt-1">No targets detected matching the anomaly threshold.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

          </motion.div>
        </div>
      </main>
    </div>
  );
}

