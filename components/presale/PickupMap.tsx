"use client";
import { useEffect, useRef, useState } from "react";

// Mapa do local de retirada com a API JavaScript do Google Maps (mesma chave do BORA OS).
// Estilo escuro da página, pino neon pulsando no endereço. Sem chave ou se o Google recusar: mapa incorporado sem chave.

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
// Centro da Lagoa da Pampulha, usado até o endereço ser localizado.
const LAGOA = { lat: -19.8516, lng: -43.9786 };

type GM = {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  LatLng: new (lat: number, lng: number) => unknown;
  OverlayView: new () => Overlay;
  Geocoder?: new () => { geocode: (req: { address: string; region?: string }) => Promise<{ results: { geometry: { location: { lat: () => number; lng: () => number } } }[] }> };
  importLibrary: (name: string) => Promise<Record<string, unknown>>;
};
type GMap = { setCenter: (c: unknown) => void; setZoom: (z: number) => void; panTo: (c: unknown) => void };
type Overlay = {
  setMap: (m: GMap | null) => void;
  getPanes: () => { overlayMouseTarget: HTMLElement } | null;
  getProjection: () => { fromLatLngToDivPixel: (ll: unknown) => { x: number; y: number } | null } | null;
  onAdd?: () => void;
  draw?: () => void;
  onRemove?: () => void;
};
type W = typeof window & { google?: { maps?: GM }; gm_authFailure?: () => void; __boraMapsReady?: () => void };

let loading: Promise<GM> | null = null;
function loadMaps(): Promise<GM> {
  if (loading) return loading;
  const w = window as W;
  loading = new Promise<GM>((resolve, reject) => {
    if (w.google?.maps?.importLibrary) return resolve(w.google.maps);
    const timer = setTimeout(() => reject(new Error("tempo esgotado")), 10000);
    w.gm_authFailure = () => reject(new Error("chave recusada"));
    w.__boraMapsReady = () => { clearTimeout(timer); resolve(w.google!.maps!); };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&loading=async&language=pt-BR&region=BR&callback=__boraMapsReady`;
    s.async = true;
    s.onerror = () => reject(new Error("falha ao carregar"));
    document.head.appendChild(s);
  }).catch((e) => { loading = null; throw e; });
  return loading;
}

// Mapa escuro, só com o essencial: ruas discretas, água em grafite e nomes em cinza.
const DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#111111" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#141a10" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262626" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2e2e2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9a9a9a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1d2412" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#ceff00" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

export default function PickupMap({ address, query, label }: { address: string; query: string; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loading" | "js" | "embed">(KEY ? "loading" : "embed");

  useEffect(() => {
    if (!KEY || !el.current) return;
    let cancelled = false;
    let overlay: Overlay | null = null;
    (async () => {
      try {
        const maps = await loadMaps();
        await maps.importLibrary("maps");
        if (cancelled || !el.current) return;
        const map = new maps.Map(el.current, {
          center: LAGOA, zoom: 14, styles: DARK_STYLE, backgroundColor: "#0f0f0f",
          disableDefaultUI: true, zoomControl: true, fullscreenControl: true, gestureHandling: "cooperative", clickableIcons: false,
        });
        setMode("js");

        // Localiza o endereço (API de geocodificação). Se não der, fica no centro da lagoa sem pino.
        let pos: { lat: number; lng: number } | null = null;
        try {
          const lib = (await maps.importLibrary("geocoding")) as { Geocoder: NonNullable<GM["Geocoder"]> };
          const { results } = await new lib.Geocoder().geocode({ address: query, region: "br" });
          const loc = results[0]?.geometry.location;
          if (loc) pos = { lat: loc.lat(), lng: loc.lng() };
        } catch {}
        if (cancelled || !pos) return;
        const ll = new maps.LatLng(pos.lat, pos.lng);
        map.panTo(ll);
        map.setZoom(16);

        // Pino neon com pulso (HTML sobre o mapa).
        const ov = new maps.OverlayView();
        const pin = document.createElement("div");
        pin.className = "pickup-pin";
        pin.innerHTML = `<span class="pickup-pin__pulse"></span><span class="pickup-pin__dot"></span><span class="pickup-pin__label">${label.replace(/</g, "&lt;")}</span>`;
        ov.onAdd = () => ov.getPanes()?.overlayMouseTarget.appendChild(pin);
        ov.draw = () => {
          const p = ov.getProjection()?.fromLatLngToDivPixel(ll);
          if (p) { pin.style.left = `${p.x}px`; pin.style.top = `${p.y}px`; }
        };
        ov.onRemove = () => pin.remove();
        ov.setMap(map);
        overlay = ov;
      } catch (e) {
        console.warn("[mapa] usando o mapa incorporado:", (e as Error)?.message);
        if (!cancelled) setMode("embed");
      }
    })();
    return () => { cancelled = true; overlay?.setMap(null); };
  }, [query, label]);

  return (
    <div className="absolute inset-0">
      {mode !== "embed" ? <div ref={el} className="absolute inset-0" aria-label={`Mapa: ${address}`} role="img" /> : null}
      {mode === "embed" ? (
        <iframe
          title={`Mapa: ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`}
          className="absolute inset-0 w-full h-full border-0 [filter:invert(.92)_hue-rotate(180deg)_saturate(.6)]"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      ) : null}
      {mode === "loading" ? <div className="absolute inset-0 grid place-items-center text-sm text-white/40">Carregando mapa…</div> : null}
    </div>
  );
}
