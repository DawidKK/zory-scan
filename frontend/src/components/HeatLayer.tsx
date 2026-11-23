import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

type HeatPoint = [number, number, number];
type HeatLayerInstance = L.Layer & { setLatLngs(points: HeatPoint[]): void };
type HeatLayerFactory = (points: HeatPoint[], options: Record<string, unknown>) => HeatLayerInstance;

// leaflet.heat to stary plugin, który oczekuje globalnego `L`. Ładujemy go dynamicznie po ustawieniu window.L.
let loader: Promise<HeatLayerFactory> | null = null;
function loadHeat(): Promise<HeatLayerFactory> {
  loader ??= (async () => {
    (window as unknown as { L: typeof L }).L = L;
    await import('leaflet.heat');
    return (L as unknown as { heatLayer: HeatLayerFactory }).heatLayer;
  })();
  return loader;
}

// Gradient w kolorach brandu: turkus → pomarańcz → czerwień
const GRADIENT = { 0.2: '#85C8CC', 0.55: '#EDAD42', 0.85: '#D83C32', 1: '#9E2A22' };

/** Heatmapa: [lat, lng, waga 0..1]. */
export function HeatLayer({ points }: { points: HeatPoint[] }) {
  const map = useMap();

  useEffect(() => {
    let layer: HeatLayerInstance | null = null;
    let cancelled = false;
    loadHeat().then((heatLayer) => {
      if (cancelled) return;
      layer = heatLayer(points, { radius: 35, blur: 25, maxZoom: 17, minOpacity: 0.35, gradient: GRADIENT });
      layer.addTo(map);
    });
    return () => {
      cancelled = true;
      if (layer) map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}
