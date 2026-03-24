import React, { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';

export default function TickerOverlay() {
  const [announcements, setAnnouncements] = useState<string[]>([]);

  const fetchNotice = async () => {
    try {
      const response = await fetch('/api/announcement');
      if (response.ok) {
        const data = await response.json();
        const items = data.text.split(/\||\n/).map((s: string) => s.trim()).filter((s: string) => s.length > 0);
        setAnnouncements(items);
      }
    } catch (error) {
      console.error("Ticker fetch error:", error);
    }
  };

  useEffect(() => {
    fetchNotice();
    const interval = setInterval(fetchNotice, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-[45px] w-full bg-black/70 backdrop-blur-md border-b border-yellow-500/30 flex items-center px-4 overflow-hidden drag-none">
      <div className="text-yellow-500 mr-4 shrink-0 animate-pulse">
        <Megaphone className="w-5 h-5" />
      </div>
      
      <div className="flex-1 overflow-hidden whitespace-nowrap relative flex items-center">
        <div className="inline-flex gap-8 pl-[100%] animate-marquee-fast">
          {announcements.length === 0 ? (
            <span className="text-slate-400 text-lg">RadPortal 影像醫學部工作站 - 守護您的健康</span>
          ) : (
            announcements.map((item, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                <span className="text-xl font-bold text-white tracking-wide">{item}</span>
              </div>
            ))
          )}
          {/* Duplicate for seamless loop */}
          {announcements.map((item, index) => (
            <div key={`dup-${index}`} className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-xl font-bold text-white tracking-wide">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
