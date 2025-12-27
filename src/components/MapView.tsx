
import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import L from 'leaflet';
import { PhotoMetadata } from '../types';

interface MapViewProps {
  photos: PhotoMetadata[];
  focusedPhoto?: PhotoMetadata | null;
  isVisible: boolean;
  onMarkerClick: (locationName: string, photoIds: string[]) => void;
  onUpdatePhotoLocation: (id: string, lat: number, lng: number) => void;
  onDeletePhoto?: (id: string) => void;
}

/**
 * 写真マーカーコンポーネントのHTML構造を生成する
 */
const createPhotoMarkerHtml = (thumbnailUrl: string, count: number) => {
  const borderColor = '#FF69B4'; // ネオンピンク
  
  return `
    <div class="relative group cursor-pointer transition-transform duration-300 hover:scale-110 flex items-center justify-center">
      <!-- 波紋エフェクト (Ripple Effect) -->
      <div class="absolute w-12 h-12 rounded-full bg-[${borderColor}] animate-ripple opacity-60"></div>
      
      <!-- メインの丸型フォトマーカー -->
      <div class="w-14 h-14 bg-white p-0.5 rounded-full shadow-2xl border-2 border-[${borderColor}] overflow-hidden relative z-10">
        <img src="${thumbnailUrl}" class="w-full h-full object-cover rounded-full" />
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full"></div>
      </div>

      <!-- 枚数バッジ (複数枚ある場合) -->
      ${count > 1 ? `
        <div class="absolute -top-1 -right-1 bg-[#FF69B4] text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-white shadow-lg z-20">
          ${count}
        </div>
      ` : ''}

      <!-- ピンのしっぽ部分 -->
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rotate-45 border-r border-b border-slate-200 -z-0"></div>
    </div>
  `;
};

/**
 * React.memo を外して常に最新のステート/関数（onDeletePhoto）が反映されるようにします
 */
export const MapView: React.FC<MapViewProps> = ({ photos, focusedPhoto, isVisible, onMarkerClick, onUpdatePhotoLocation, onDeletePhoto }) => {
  const [showUnknownTray, setShowUnknownTray] = useState(false);
  const [selectedCountryFolder, setSelectedCountryFolder] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const initialFitRef = useRef(false);
  const isInternalDragging = useRef(false);

  const mappedPhotos = useMemo<PhotoMetadata[]>(() => 
    photos.filter(p => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);
    }),
    [photos]
  );
  
  const unknownPhotos = useMemo<PhotoMetadata[]>(() => 
    photos.filter(p => {
      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      return isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0);
    }),
    [photos]
  );

  const unknownFolders = useMemo<Record<string, PhotoMetadata[]>>(() => {
    return unknownPhotos.reduce((acc, photo) => {
      let countryLabel = photo.isProcessing ? "Analyzing..." : (photo.country || "Unmapped");
      if (!acc[countryLabel]) acc[countryLabel] = [];
      acc[countryLabel].push(photo);
      return acc;
    }, {} as Record<string, PhotoMetadata[]>);
  }, [unknownPhotos]);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;
    const map = L.map(mapContainerRef.current, { center: [20, 0], zoom: 2, zoomControl: false, attributionControl: false });
    L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 21 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = L.layerGroup().addTo(map);
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isVisible && mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
    }
  }, [isVisible]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || isInternalDragging.current) return;
    markersLayerRef.current.clearLayers();
    const map = mapInstanceRef.current;
    if (mappedPhotos.length === 0) return;

    interface ClusterItem { 
      name: string; 
      count: number; 
      lat: number; 
      lng: number; 
      photoIds: string[]; 
      thumbnailUrl: string; 
    }
    
    const clusters = mappedPhotos.reduce<Record<string, ClusterItem>>((acc, photo) => {
      const key = `${Number(photo.latitude).toFixed(6)}-${Number(photo.longitude).toFixed(6)}`;
      if (!acc[key]) {
        acc[key] = { 
          name: photo.locationName, 
          count: 0, 
          lat: Number(photo.latitude), 
          lng: Number(photo.longitude), 
          photoIds: [], 
          thumbnailUrl: photo.url 
        };
      }
      acc[key].count++;
      acc[key].photoIds.push(photo.id);
      return acc;
    }, {});

    const bounds = L.latLngBounds([]);
    (Object.values(clusters) as ClusterItem[]).forEach(cluster => {
      const customIcon = L.divIcon({
        className: 'custom-photo-marker',
        html: createPhotoMarkerHtml(cluster.thumbnailUrl, cluster.count),
        iconSize: [56, 56],
        iconAnchor: [28, 56]
      });

      L.marker([cluster.lat, cluster.lng], { icon: customIcon, draggable: true })
        .addTo(markersLayerRef.current!)
        .on('click', () => onMarkerClick(cluster.name, cluster.photoIds))
        .on('dragstart', () => { isInternalDragging.current = true; })
        .on('dragend', (e: L.LeafletEvent) => {
          const pos = (e.target as L.Marker).getLatLng();
          cluster.photoIds.forEach(id => onUpdatePhotoLocation(id, pos.lat, pos.lng));
          setTimeout(() => { isInternalDragging.current = false; }, 100);
        })
        .bindTooltip(cluster.name, { 
          direction: 'top', 
          offset: [0, -60],
          className: 'bg-white border-none shadow-xl rounded-lg font-black p-2 text-slate-800' 
        });
      bounds.extend([cluster.lat, cluster.lng]);
    });

    if (!initialFitRef.current && mappedPhotos.length > 0) {
      map.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
      initialFitRef.current = true;
    }
  }, [mappedPhotos, onMarkerClick, onUpdatePhotoLocation]);

  useEffect(() => {
    if (!mapInstanceRef.current || !focusedPhoto || !isVisible) return;
    const lat = Number(focusedPhoto.latitude);
    const lng = Number(focusedPhoto.longitude);
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.5 });
    }
  }, [focusedPhoto, isVisible]);

  const handleDragStartTray = useCallback((e: React.DragEvent, photoId: string) => {
    e.dataTransfer.setData('photoId', photoId);
    isInternalDragging.current = true;
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    isInternalDragging.current = false;
    if (!mapInstanceRef.current || !mapContainerRef.current) return;
    const photoId = e.dataTransfer.getData('photoId');
    const rect = mapContainerRef.current.getBoundingClientRect();
    const latlng = mapInstanceRef.current.containerPointToLatLng(L.point(e.clientX - rect.left, e.clientY - rect.top));
    onUpdatePhotoLocation(photoId, latlng.lat, latlng.lng);
  }, [onUpdatePhotoLocation]);

  const trayDisplayPhotos = useMemo(() => {
    if (selectedCountryFolder === "all") return unknownPhotos;
    if (selectedCountryFolder) return unknownFolders[selectedCountryFolder] || [];
    return [];
  }, [selectedCountryFolder, unknownPhotos, unknownFolders]);

  return (
    <div className="flex-1 relative w-full h-full bg-slate-100 overflow-hidden">
      <div ref={mapContainerRef} onDragOver={(e) => { e.preventDefault(); if (!isDraggingOver) setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={handleDrop} className="w-full h-full z-10" />
      {isDraggingOver && (
        <div className="absolute inset-0 bg-indigo-500/10 border-4 border-indigo-500 border-dashed z-[1001] flex items-center justify-center pointer-events-none animate-in fade-in">
           <div className="bg-white px-10 py-6 rounded-3xl shadow-2xl animate-bounce text-2xl font-black text-indigo-600">Drop Here</div>
        </div>
      )}
      <div className="absolute top-6 right-6 z-30 pointer-events-auto">
         <button onClick={() => setShowUnknownTray(!showUnknownTray)} className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${showUnknownTray ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 hover:text-indigo-600'}`}>
           <div className="relative">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
             {unknownPhotos.length > 0 && !showUnknownTray && (
               <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">{unknownPhotos.length}</span>
             )}
           </div>
         </button>
      </div>
      <div className={`absolute right-6 top-24 bottom-6 w-80 bg-white/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl transition-all duration-500 z-40 flex flex-col pointer-events-auto ${showUnknownTray ? 'translate-x-0 opacity-100' : 'translate-x-[calc(100%+48px)] opacity-0 pointer-events-none'}`}>
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedCountryFolder && <button onClick={() => setSelectedCountryFolder(null)} className="p-1 hover:bg-slate-100 rounded text-indigo-600 font-black">←</button>}
            <h3 className="font-black truncate w-40">{selectedCountryFolder === "all" ? "すべて" : (selectedCountryFolder || "未配置の整理")}</h3>
          </div>
          <button onClick={() => setShowUnknownTray(false)} className="text-slate-400 font-black text-xl">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {!selectedCountryFolder ? (
            <div className="space-y-3">
               <button onClick={() => setSelectedCountryFolder("all")} className="w-full text-left p-5 bg-indigo-50 hover:bg-indigo-100 rounded-3xl transition-colors font-black flex justify-between items-center group">
                 <span className="text-indigo-900">すべての未配置</span>
                 <span className="bg-white text-indigo-600 px-3 py-1 rounded-full text-xs shadow-sm">{unknownPhotos.length}</span>
               </button>
               {(Object.entries(unknownFolders) as [string, PhotoMetadata[]][]).map(([country, items]) => (
                 <button key={country} onClick={() => setSelectedCountryFolder(country)} className="w-full text-left p-5 bg-slate-50 hover:bg-slate-100 rounded-3xl transition-colors font-black flex justify-between items-center group">
                   <span className="text-slate-700">{country}</span>
                   <span className="bg-white text-slate-400 group-hover:text-indigo-600 px-3 py-1 rounded-full text-xs shadow-sm">{items.length}</span>
                 </button>
               ))}
            </div>
          ) : (
            <div className="space-y-3">
              {trayDisplayPhotos.map(photo => (
                <div key={photo.id} className="flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all group relative">
                  <div 
                    draggable 
                    onDragStart={(e) => handleDragStartTray(e, photo.id)} 
                    className="w-12 h-12 rounded-xl overflow-hidden cursor-move shrink-0 shadow-sm border border-white"
                  >
                    <img src={photo.url} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-slate-700 truncate" title={photo.name}>{photo.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">{photo.date.replace(/-/g, '/')}</p>
                  </div>
                  
                  {/* 最前面(z-index)に配置し、onPointerDown で即座に削除関数を呼び出します */}
                  <button 
                    onPointerDown={(e) => { 
                      e.preventDefault();
                      e.stopPropagation(); 
                      console.log(`[VisionSort] Sidebar delete capture for: ${photo.id}`);
                      if (onDeletePhoto) {
                        onDeletePhoto(photo.id);
                      }
                    }}
                    className="relative z-[10000] p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all shrink-0 active:scale-90"
                    title="この写真を完全に削除"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
