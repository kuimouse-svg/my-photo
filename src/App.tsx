
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { analyzeImage, identifyLocation } from './services/geminiService';
import { PhotoMetadata } from './types';
import { PhotoCard } from './components/PhotoCard';
import { MapView } from './components/MapView';
import { CalendarView } from './components/CalendarView';
import { TimelineView } from './components/TimelineView';
import * as db from './services/dbService';

type ViewMode = 'landing' | 'config' | 'folders' | 'map' | 'all' | 'calendar' | 'timeline';

/**
 * 日付を YYYY-MM-DD 形式の文字列に変換する
 */
const formatToISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * ファイル名から YYYYMMDD 形式の8桁の数字を抽出する
 */
const extractDateFromFilename = (filename: string): string | null => {
  const match = filename.match(/(\d{4})(\d{2})(\d{2})/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const d = parseInt(match[3], 10);
    if (y > 1980 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return iso;
    }
  }
  return null;
};

/**
 * 日付解析のスマートロジック
 */
const parseSmartDate = (filename: string, aiDateStr: string, fileDate: Date): string => {
  const filenameDate = extractDateFromFilename(filename);
  if (filenameDate) return filenameDate;

  if (aiDateStr && !aiDateStr.includes('..') && aiDateStr !== "Unknown") {
    const standardized = aiDateStr.replace(/[:/]/g, '-').split(' ')[0];
    const parsed = new Date(standardized);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1980) {
      return formatToISO(parsed);
    }
  }
  return formatToISO(fileDate);
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const App: React.FC = () => {
  const [photos, setPhotos] = useState<PhotoMetadata[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [focusedPhoto, setFocusedPhoto] = useState<PhotoMetadata | null>(null);
  const [selectedPhotoForModal, setSelectedPhotoForModal] = useState<PhotoMetadata | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState(new Date());
  const [diaryNotes, setDiaryNotes] = useState<Record<string, string>>({});

  const [dateRange, setDateRange] = useState({
    start: '2000-01-01',
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const savedPhotos = await db.getAllPhotos();
        const savedNotes = await db.getAllNotes();
        setPhotos(savedPhotos);
        setDiaryNotes(savedNotes);
      } catch (e) {
        console.error("[VisionSort] Init Error:", e);
      } finally {
        setIsInitializing(false);
      }
    };
    loadData();
  }, []);

  const addOrUpdatePhoto = useCallback(async (photo: PhotoMetadata) => {
    setPhotos(prev => {
      const existingIndex = prev.findIndex(p => p.id === photo.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = { ...prev[existingIndex], ...photo };
        return next;
      }
      return [...prev, photo];
    });
    await db.savePhoto(photo);
  }, []);

  /**
   * 写真の完全削除処理
   */
  const handleDeletePhoto = useCallback(async (photoId: string) => {
    if (!window.confirm("この写真を完全に削除してもよろしいですか？この操作は取り消せません。")) {
      return;
    }
    
    try {
      // 1. IndexedDBから削除
      await db.deletePhoto(photoId);
      
      // 2. Reactステートから削除
      setPhotos(prev => prev.filter(p => p.id !== photoId));
      setDiaryNotes(prev => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      
      // 3. モーダルとフォーカスのクリア
      setSelectedPhotoForModal(null);
      setFocusedPhoto(prev => (prev?.id === photoId ? null : prev));

      console.log(`[VisionSort] Photo deleted successfully: ${photoId}`);
    } catch (err) {
      console.error("[VisionSort] Delete Error:", err);
      alert("削除中にエラーが発生しました。DBがロックされている可能性があります。");
    }
  }, []);

  const processFile = async (file: File) => {
    const id = `photo-${file.name}-${file.size}-${file.lastModified}`;
    const fileDate = new Date(file.lastModified);
    const url = URL.createObjectURL(file);
    const initialDate = extractDateFromFilename(file.name) || formatToISO(fileDate);

    const newPhoto: PhotoMetadata = {
      id, url, name: file.name, locationName: "特定中...", latitude: 0, longitude: 0,
      date: initialDate, 
      description: "Gemini AIが解析しています", isProcessing: true, manuallyPlaced: false,
      fileBlob: file
    };
    await addOrUpdatePhoto(newPhoto);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result?.toString().split(',')[1];
      if (base64Data) {
        try {
          const result = await analyzeImage(base64Data, file.type);
          const finalDate = parseSmartDate(file.name, result.date, fileDate);
          
          const updated: PhotoMetadata = {
            id, url, name: file.name, fileBlob: file,
            locationName: result.locationName,
            country: result.country,
            latitude: result.latitude,
            longitude: result.longitude,
            date: finalDate,
            description: result.description,
            isProcessing: false,
            manuallyPlaced: false
          };
          await addOrUpdatePhoto(updated);
        } catch (err) {
          console.error(`[VisionSort] Analysis Error:`, err);
          setPhotos(prev => prev.map(p => p.id === id ? { ...p, isProcessing: false, locationName: "特定失敗", description: "Error" } : p));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (viewMode === 'landing') setViewMode('all');
    (Array.from(files) as File[]).forEach(file => processFile(file));
  };

  const filteredPhotosByDate = useMemo(() => {
    return photos.filter(p => p.date >= dateRange.start && p.date <= dateRange.end);
  }, [photos, dateRange]);

  const handleFocusPhoto = (photo: PhotoMetadata) => {
    if (photo.latitude === 0 && photo.longitude === 0) return;
    setFocusedPhoto(photo);
    setViewMode('map');
  };

  const updatePhotoLocation = useCallback(async (id: string, lat: number, lng: number) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (!photo) return prev;
      
      const updated = { 
        ...photo, 
        latitude: lat, 
        longitude: lng, 
        locationName: "地点名を特定中...", 
        isProcessing: true,
        manuallyPlaced: true 
      };
      
      (async () => {
        try {
          if (photo.fileBlob) {
            const base64 = await blobToBase64(photo.fileBlob);
            const aiLocationName = await identifyLocation(lat, lng, base64, photo.fileBlob.type);
            
            const finalUpdate = { ...updated, locationName: aiLocationName, isProcessing: false };
            setPhotos(current => current.map(p => p.id === id ? finalUpdate : p));
            await db.savePhoto(finalUpdate);
          }
        } catch (err) {
          console.error("Manual move AI analysis failed:", err);
          const errorUpdate = { ...updated, locationName: "特定できませんでした", isProcessing: false };
          setPhotos(current => current.map(p => p.id === id ? errorUpdate : p));
        }
      })();

      return prev.map(p => p.id === id ? updated : p);
    });
  }, []);

  const handleUpdateNote = useCallback(async (photoId: string, note: string) => {
    setDiaryNotes(prev => ({ ...prev, [photoId]: note }));
    await db.saveNote(photoId, note);
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-bold text-slate-400">
        Loading VisionSort...
      </div>
    );
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 text-slate-900 font-inter overflow-hidden">
      <header className="shrink-0 h-16 z-50 bg-white/90 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setViewMode('landing')}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">VS</div>
              <h1 className="text-xl font-black hidden sm:block">VisionSort AI</h1>
            </div>
            {photos.length > 0 && (
              <div className="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                <span className="text-xs font-bold text-slate-500">PHOTOS: {filteredPhotosByDate.length}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {viewMode !== 'landing' && (
              <nav className="flex bg-slate-100 p-1 rounded-2xl">
                <button onClick={() => setViewMode('config')} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${viewMode === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Settings</button>
                <button onClick={() => setViewMode('calendar')} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${viewMode === 'calendar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Calendar</button>
                <button onClick={() => setViewMode('map')} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${viewMode === 'map' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Map</button>
                <button onClick={() => setViewMode('all')} className={`px-4 py-1.5 rounded-xl text-xs font-bold ${viewMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>List</button>
              </nav>
            )}
            <label className="cursor-pointer bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              <span>Upload</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden">
        <div className={`absolute inset-0 transition-opacity duration-300 ${viewMode === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <MapView 
            photos={filteredPhotosByDate} 
            focusedPhoto={focusedPhoto}
            onMarkerClick={(name, ids) => {
              const photo = photos.find(p => p.id === ids[0]);
              if (photo) setSelectedPhotoForModal(photo);
            }} 
            onUpdatePhotoLocation={updatePhotoLocation}
            onDeletePhoto={handleDeletePhoto}
            isVisible={viewMode === 'map'}
          />
        </div>

        <div className={`relative z-20 h-full overflow-auto custom-scrollbar ${viewMode === 'map' ? 'pointer-events-none' : 'bg-slate-50/50'}`}>
          {viewMode === 'landing' && (
            <div className="flex flex-col items-center justify-center min-h-full py-20 px-6 text-center">
               <h1 className="text-6xl font-black mb-8 tracking-tight">AI Memory Organizer</h1>
               <p className="text-xl text-slate-500 mb-12 max-w-2xl">写真をアップロードするだけで、撮影日と場所を自動で特定。あなたの想い出を美しく整理します。</p>
               
               <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6">
                 <label className="cursor-pointer bg-indigo-600 text-white px-10 py-6 rounded-3xl text-2xl font-black shadow-2xl transition-all hover:scale-[1.05] active:scale-95 flex items-center gap-3">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                   <span>Upload Photos</span>
                   <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} />
                 </label>
                 
                 <button onClick={() => setViewMode('calendar')} className="bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 px-10 py-6 rounded-3xl text-2xl font-black shadow-xl transition-all hover:scale-[1.05] active:scale-95 flex items-center gap-3">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                   <span>Show Calendar</span>
                 </button>

                 <button onClick={() => setViewMode('map')} className="bg-white border-2 border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 px-10 py-6 rounded-3xl text-2xl font-black shadow-xl transition-all hover:scale-[1.05] active:scale-95 flex items-center gap-3">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                   <span>Show Map</span>
                 </button>
               </div>
            </div>
          )}

          {viewMode === 'config' && (
            <div className="max-w-2xl mx-auto py-20 px-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 p-10 space-y-12">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">Date Range Filter</h2>
                  </div>
                  <p className="text-slate-500 font-medium">指定した期間の写真のみをマップおよびリストに表示します。</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">From / 開始日</label>
                      <input 
                        type="date" 
                        value={dateRange.start} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">To / 終了日</label>
                      <input 
                        type="date" 
                        value={dateRange.end} 
                        onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                        className="bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => setViewMode('all')}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black text-lg shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                    Apply Filter / フィルターを適用
                  </button>
                </section>
              </div>
            </div>
          )}

          {viewMode === 'calendar' && (
            <CalendarView 
              photos={photos} 
              onDateSelect={(date) => { setSelectedDate(date); setViewMode('timeline'); }} 
              currentMonth={currentCalendarMonth}
              onMonthChange={setCurrentCalendarMonth}
            />
          )}

          {viewMode === 'timeline' && selectedDate && (
            <TimelineView 
              date={selectedDate} 
              photos={photos} 
              notes={diaryNotes} 
              onUpdateNote={handleUpdateNote}
              onBack={() => setViewMode('calendar')}
            />
          )}

  {viewMode === 'all' && (
            <div className="max-w-[1400px] mx-auto p-10">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-20">
                {filteredPhotosByDate?.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => setSelectedPhotoForModal(p)} 
                    className="cursor-pointer transition-transform hover:scale-[1.02]"
                  >
                    <PhotoCard photo={p} onFocus={() => handleFocusPhoto(p)} />
                  </div>
                ))}

                {(!filteredPhotosByDate || filteredPhotosByDate.length === 0) && (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-400">
                    <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="font-bold text-lg">写真がありません</p>
                    <p className="text-sm">上のUploadボタンから写真を追加してください</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {selectedPhotoForModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6" onClick={() => setSelectedPhotoForModal(null)}>
          <div className="bg-white rounded-[2.5rem] overflow-hidden w-full max-w-4xl flex flex-col md:flex-row max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="flex-1 bg-black flex items-center justify-center relative">
              <img src={selectedPhotoForModal.url} className="w-full h-full object-contain" />
            </div>
            <div className="w-full md:w-80 p-8 flex flex-col justify-between">
              <div className="space-y-6">
                <p className="text-xs font-black text-indigo-500 uppercase">{selectedPhotoForModal.date}</p>
                <h3 className="text-2xl font-black">{selectedPhotoForModal.locationName}</h3>
                <p className="text-slate-500 italic mb-4">{selectedPhotoForModal.description}</p>
                
                <div className="pt-6 border-t border-slate-100">
                  <button 
                    onPointerDown={(e) => { e.stopPropagation(); }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleDeletePhoto(selectedPhotoForModal.id); 
                    }}
                    className="relative z-[1000] w-full flex items-center justify-center gap-2 text-red-600 font-black hover:bg-red-50 p-5 rounded-2xl transition-all border-2 border-dashed border-red-100 active:scale-95 shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>この写真を完全に削除</span>
                  </button>
                </div>
              </div>
              <button onClick={() => setSelectedPhotoForModal(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold mt-4 active:scale-95 transition-transform">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
