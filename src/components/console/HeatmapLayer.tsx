'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function HeatmapLayer({ points, theme = 'light_all' }: { points: [number, number, number][], theme?: string }) {
  const map = useMap();
  const pointsString = JSON.stringify(points);

  useEffect(() => {
    let isMounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let heatLayer: any = null;

    if (typeof window !== 'undefined' && map) {
      (window as typeof window & { L: typeof L }).L = L;

      import('leaflet.heat').then(() => {
        if (!isMounted) return;

        const parsedPoints = JSON.parse(pointsString);
        if (!parsedPoints || parsedPoints.length === 0) return;

        const isDark = theme === 'dark_all';
        const gradient: { [key: number]: string } = isDark
          ? { 0.2: '#312e81', 0.4: '#3b82f6', 0.6: '#10b981', 0.8: '#f59e0b', 1.0: '#ef4444' }
          : { 0.1: 'blue', 0.3: 'cyan', 0.5: 'lime', 0.7: 'yellow', 1.0: 'red' };

        const dynamicMax = Math.max(1.2, Math.min(8.0, parsedPoints.length / 4));

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          heatLayer = (L as any).heatLayer(parsedPoints, {
            radius: 24,
            blur: 18,
            maxZoom: 4,
            max: dynamicMax,
            gradient
          }).addTo(map);
        } catch (e) {
          console.warn('Map was likely destroyed before heatmap could be added', e);
        }
      });
    }

    return () => {
      isMounted = false;
      if (heatLayer && map) {
        try {
          map.removeLayer(heatLayer);
        } catch (e) {
          // Ignore cleanup errors on unmounted maps
        }
      }
    };
  }, [map, theme, pointsString]);

  return null;
}
