
import React from 'react';
import { PhotoMetadata } from '../types';

interface TimelineViewProps {
  date: string;
  photos: PhotoMetadata[];
  notes: Record<string, string>;
  onUpdateNote: (photoId: string, note: string) => void;
  onBack: () => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ date, photos, notes, onUpdateNote, onBack }) => {
  // すべての保存形式が YYYY-MM-DD なので単純比較
  const dayPhotos = photos.filter(p => p.date === date);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 w-full animate-in slide-in-from-bottom-8 duration-500">
      <div className="flex items-center gap-6 mb-12">
        <button onClick={onBack} className="p-3 bg-white hover:bg-slate-50 rounded-2xl transition-all border border-slate-200 shadow-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h2 className="text-4xl font-black text-slate-900 leading-none mb-1">{date.replace(/-/g, '/')}</h2>
          <p className="text-sm font-bold text-indigo-500 uppercase tracking-widest">TIMELINE DIARY</p>
        </div>
      </div>

      <div className="space-y-12 relative">
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-200 -translate-x-1/2 -z-10"></div>
        
        {dayPhotos.map((photo, idx) => (
          <div key={photo.id} className="space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 p-8 flex flex-col md:flex-row gap-8 hover:shadow-2xl transition-shadow">
              <div className="w-full md:w-64 aspect-square rounded-3xl overflow-hidden shrink-0 bg-slate-100">
                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" /></svg>
                  </div>
                  <span className="text-xl font-black text-slate-900">{photo.locationName}</span>
                </div>
                <p className="text-slate-500 italic leading-relaxed text-sm mb-4">"{photo.description}"</p>
              </div>
            </div>

            <div className="px-4">
              <div className="relative">
                <div className="absolute left-1/2 -top-6 -bottom-6 w-8 h-8 bg-indigo-600 rounded-full border-4 border-white shadow-lg -translate-x-1/2 z-10 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </div>
                <textarea
                  value={notes[photo.id] || ''}
                  onChange={(e) => onUpdateNote(photo.id, e.target.value)}
                  placeholder="旅のメモ（移動手段、費用、感想など）を入力..."
                  className="w-full min-h-[120px] bg-white border border-slate-200 rounded-[2rem] p-8 text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none shadow-sm"
                />
              </div>
            </div>
          </div>
        ))}

        {dayPhotos.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-400 font-bold">この日の写真はありません</p>
          </div>
        )}
      </div>
    </div>
  );
};
