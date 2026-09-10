'use client';

import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';

// Dynamically import map components because they require window object
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

export default function Home() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [result, setResult] = useState<any>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setAuthenticated(window.sessionStorage.getItem('anveshan-authenticated') === 'true');
    setAuthReady(true);
  }, []);

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Demo-only gate for the submission prototype. Replace with a real auth provider before production use.
    if (username === 'admin' && password === 'anveshan2026') {
      window.sessionStorage.setItem('anveshan-authenticated', 'true');
      setAuthenticated(true);
      setAuthError(null);
    } else {
      setAuthError('Invalid credentials.');
    }
  };

  const handleLogout = () => {
    window.sessionStorage.removeItem('anveshan-authenticated');
    setAuthenticated(false);
    setPassword('');
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setPreviewUrl(URL.createObjectURL(selected));
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setLoading(true);
    setResult(null);
    setApiError(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch('/api/process', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.detail || 'The processing API returned an error.');
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setApiError(err instanceof Error ? err.message : 'Error processing image');
    } finally {
      setLoading(false);
    }
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
        
        // Draw detections
        if (result.detections) {
          result.detections.forEach((d: any) => {
            const [x, y, w, h] = d.bbox;
            const flagged = d.flagged_for_review;
            
            ctx.strokeStyle = flagged ? 'rgba(255, 165, 0, 0.8)' : 'rgba(0, 128, 0, 0.8)';
            ctx.lineWidth = 3;
            
            if (flagged) {
               ctx.setLineDash([5, 5]);
            } else {
               ctx.setLineDash([]);
            }
            
            ctx.strokeRect(x, y, w, h);
            
            // Draw label background
            ctx.setLineDash([]);
            ctx.fillStyle = ctx.strokeStyle;
            ctx.font = '14px sans-serif';
            const label = `${d.class} ${d.final_confidence.toFixed(0)}%`;
            const textMetrics = ctx.measureText(label);
            ctx.fillRect(x, Math.max(0, y - 20), textMetrics.width + 10, 20);
            
            // Draw label text
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x + 5, Math.max(15, y - 5));
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
        if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))) {
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

  // Map icon fix for leaflet
  useEffect(() => {
    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    });
  }, []);

  if (!authReady) {
    return <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">Loading Anveshan…</main>;
  }

  if (!authenticated) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950 px-6 text-gray-100">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-900/30 shadow-[0_0_120px_rgba(34,211,238,0.08)]" />
        <div className="relative w-full max-w-md rounded-xl border border-gray-800 bg-gray-900/95 p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">अन्वेषण</p>
            <h1 className="text-4xl font-yatra font-bold">अन्वेषण</h1>
            <p className="mt-3 text-sm text-gray-400">Sign in to access the sonar analysis console.</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <label className="block text-sm text-gray-300">
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="mt-2 w-full rounded border border-gray-700 bg-gray-950 px-3 py-3 text-gray-100 outline-none transition focus:border-cyan-400" />
            </label>
            <label className="block text-sm text-gray-300">
              Password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="mt-2 w-full rounded border border-gray-700 bg-gray-950 px-3 py-3 text-gray-100 outline-none transition focus:border-cyan-400" />
            </label>
            {authError && <p className="border-l-2 border-red-400 bg-red-950/40 px-3 py-2 text-sm text-red-200">{authError}</p>}
            <button type="submit" className="w-full rounded border border-cyan-400 bg-cyan-400/10 px-4 py-3 font-semibold text-cyan-300 transition hover:-translate-y-0.5 hover:bg-cyan-400/20 focus:outline-none focus:ring-2 focus:ring-cyan-400/50">Enter console</button>
          </form>
          <p className="mt-6 text-center text-xs text-gray-500">Authorized personnel only · prototype access gate</p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-8 pt-24">
      {/* Pill-like navbar with glass blur */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800/60 backdrop-blur-md border border-gray-700/50 px-6 py-3 rounded-full z-50 flex items-center justify-between shadow-lg min-w-[300px]">
        <div className="flex items-center space-x-2">
          <span className="font-yatra text-2xl tracking-wide text-blue-400">अन्वेषण</span>
        </div>
        <div className="text-sm font-medium text-gray-300">
          Sonar console
        </div>
        <button onClick={handleLogout} className="ml-4 text-xs text-gray-400 transition hover:text-cyan-300">Log out</button>
      </nav>

      <header className="mb-8 text-center mt-4">
        <h1 className="text-5xl font-yatra font-bold mb-2">अन्वेषण</h1>
        <p className="text-gray-400">Marine Debris Detection System</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Upload Sonar Image</h2>
            <input 
              type="file" 
              accept="image/png, image/jpeg" 
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-300
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700"
            />
            {previewUrl && (
              <button 
                onClick={handleUpload}
                disabled={loading}
                className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Run Detection'}
              </button>
            )}
            {apiError && (
              <p className="mt-4 rounded border border-red-700 bg-red-950/40 p-3 text-sm text-red-200">
                {apiError}
              </p>
            )}
          </div>
          
          {result && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Report Downloads</h2>
              <div className="flex space-x-4">
                <button onClick={downloadJson} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">JSON</button>
                <button onClick={downloadCsv} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">CSV</button>
              </div>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-2 space-y-8">
          {previewUrl && !result && !loading && (
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Preview</h2>
              <img src={previewUrl} alt="Preview" className="max-w-full h-auto rounded" />
            </div>
          )}
          
          {loading && (
            <div className="bg-gray-800 p-6 rounded-lg flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
          
          {result && (
            <>
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Detections</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg text-gray-400 mb-2">Original</h3>
                    <img src={previewUrl!} alt="Original" className="w-full rounded" />
                  </div>
                  <div>
                    <h3 className="text-lg text-gray-400 mb-2">Processed & Detected</h3>
                    <canvas ref={canvasRef} className="w-full rounded bg-black" />
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Map View</h2>
                <p className="text-sm text-yellow-500 mb-4">Coordinates simulated for this prototype — real deployment would use sonar navigation metadata.</p>
                <div className="h-96 rounded overflow-hidden">
                  {result.report && result.report.length > 0 ? (
                    <MapContainer center={[result.report[0].latitude, result.report[0].longitude]} zoom={15} style={{ height: '100%', width: '100%' }}>
                      <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      />
                      {result.report.map((entry: any) => (
                         <Marker key={entry.detection_id} position={[entry.latitude, entry.longitude]}>
                           <Popup>
                             {entry.image_class} ({entry.confidence.toFixed(0)}%)
                           </Popup>
                         </Marker>
                      ))}
                    </MapContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-700">
                      No detections to map.
                    </div>
                  )}
                </div>
                
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">Detection List</h3>
                  {result.report && result.report.length > 0 ? (
                    <ul className="space-y-2">
                      {result.report.map((entry: any) => (
                        <li key={entry.detection_id} className={`p-2 rounded flex justify-between ${entry.flagged_for_review ? 'bg-orange-900/50 border border-orange-700' : 'bg-green-900/50 border border-green-700'}`}>
                          <span>{entry.image_class} {entry.flagged_for_review && <span className="text-orange-400 text-sm ml-2">· needs review</span>}</span>
                          <span className="font-mono">{entry.confidence.toFixed(1)}%</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No detections found.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
