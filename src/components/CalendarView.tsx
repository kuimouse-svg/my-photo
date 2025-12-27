
import React, { useMemo } from 'react';
import { PhotoMetadata } from '../types';

interface CalendarViewProps {
  photos: PhotoMetadata[];
  onDateSelect: (date: string) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ photos, onDateSelect, currentMonth, onMonthChange }) => {
  // 保存形式が YYYY-MM-DD なのでそのままカウント
  const photoCountsByDate = useMemo(() => {
    return photos.reduce((acc, p) => {
      const date = p.date;
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [photos]);

  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= lastDate; d++) days.push(new Date(year, month, d));
    return days;
  }, [currentMonth]);

  const changeMonth = (offset: number) => {
    onMonthChange(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const handleYearChange = (year: number) => {
    onMonthChange(new Date(year, currentMonth.getMonth(), 1));
  };

  const handleMonthChange = (month: number) => {
    onMonthChange(new Date(currentMonth.getFullYear(), month, 1));
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const res = [];
    for (let y = 2000; y <= currentYear + 1; y++) {
      res.push(y);
    }
    return res;
  }, []);

  const months = [
    { label: '1月', value: 0 }, { label: '2月', value: 1 }, { label: '3月', value: 2 },
    { label: '4月', value: 3 }, { label: '5月', value: 4 }, { label: '6月', value: 5 },
    { label: '7月', value: 6 }, { label: '8月', value: 7 }, { label: '9月', value: 8 },
    { label: '10月', value: 9 }, { label: '11月', value: 10 }, { label: '12月', value: 11 }
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 w-full animate-in fade-in duration-500">
      <div className="bg-white rounded-[3rem] shadow-2xl p-10 border border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <select 
                value={currentMonth.getFullYear()} 
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 font-black text-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer pr-12"
              >
                {years.map(y => <option key={y} value={y}>{y}年</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="relative">
              <select 
                value={currentMonth.getMonth()} 
                onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-6 py-3 font-black text-xl text-slate-900 focus:ring-4 focus:ring-indigo-500/10 outline-none cursor-pointer pr-12"
              >
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => changeMonth(-1)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 shadow-sm" title="Previous Month">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={() => onMonthChange(new Date())} 
              className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm"
              title="Today"
            >
              Today
            </button>
            <button onClick={() => changeMonth(1)} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 shadow-sm" title="Next Month">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
            <div key={day} className="text-center text-[10px] font-black text-slate-400 py-2 tracking-widest">{day}</div>
          ))}
          {daysInMonth.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="aspect-square" />;
            
            // YYYY-MM-DD 形式でキーを生成
            const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const count = photoCountsByDate[dateStr] || 0;
            
            return (
              <button
                key={dateStr}
                onClick={() => count > 0 && onDateSelect(dateStr)}
                className={`aspect-square rounded-3xl p-2 flex flex-col items-center justify-center transition-all border-2 group ${
                  count > 0 
                  ? 'bg-indigo-50 border-indigo-100 hover:border-indigo-500 hover:scale-105 active:scale-95 shadow-sm hover:shadow-md' 
                  : 'bg-slate-50 border-transparent opacity-40'
                }`}
              >
                <span className={`text-lg font-black ${count > 0 ? 'text-indigo-900' : 'text-slate-400'}`}>{day.getDate()}</span>
                {count > 0 && (
                  <span className="text-[10px] font-black text-indigo-500 mt-1 bg-white px-2 py-0.5 rounded-full shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-colors">{count}枚</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
