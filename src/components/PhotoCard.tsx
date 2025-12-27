
import React from 'react';
import { PhotoMetadata } from '../types';

interface PhotoCardProps {
  photo: PhotoMetadata;
  onFocus?: () => void;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onFocus }) => {
  const hasLocation = photo.latitude !== 0 || photo.longitude !== 0;

  return (
    <div className="group relative bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200">
      <div className="aspect-square w-full overflow-hidden bg-slate-100 relative">
        <img
          src={photo.url}
          alt={photo.name}
          className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${photo.isProcessing ? 'opacity-50 blur-sm' : 'opacity-100'}`}
        />
        
        {/* Quick action: View on map */}
        {!photo.isProcessing && hasLocation && (
          <button 
            onClick={(e) => { e.stopPropagation(); onFocus?.(); }}
            className="absolute top-2 right-2 p-2 bg-white/90 backdrop-blur-md rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white transform translate-y-2 group-hover:translate-y-0"
            title="View on map"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        )}

        {photo.isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 px-2 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest animate-pulse">
                場所を特定中...<br/>FINDING WHERE...
              </span>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">
            {photo.date.replace(/-/g, '/')}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-slate-800 truncate flex items-center gap-1">
          <svg className={`w-3 h-3 shrink-0 ${hasLocation ? 'text-red-500' : 'text-slate-300'}`} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
          <span className="truncate">{photo.locationName}</span>
        </h3>
        <p className="text-[11px] text-slate-500 mt-1 italic truncate">
          {photo.description}
        </p>
      </div>
    </div>
  );
};
