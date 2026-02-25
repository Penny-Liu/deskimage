import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import {
  Megaphone,
  Loader,
  Menu,
  ClipboardEdit,
  Disc3,
  PackageSearch,
  Stethoscope,
  ExternalLink,
  Sparkles,
  ArrowRight,
  FileText,
  AlertTriangle,
  CalendarCheck2,
  Bot,
  X,
  Loader2,
  Zap,
  Copy,
  Check,
  BrainCircuit,
  User,
  Send
} from 'lucide-react';

// Initialize Gemini API
// Note: In a real app, ensure process.env.GEMINI_API_KEY is set
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export default function App() {
  // --- State ---
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  
  // Modal States
  const [activeModal, setActiveModal] = useState<string | null>(null);
  

  // Device Modal State
  const [activeDevice, setActiveDevice] = useState<string | null>(null);
  const [deviceTab, setDeviceTab] = useState<'ai' | 'guide'>('ai');
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null);

  // Mock Data for Guides (In a real app, this could be in DB)
  const deviceGuides: Record<string, { title: string, items: { name: string, content: string }[] }> = {
    'MR': {
      title: '磁振造影 (MRI)',
      items: [
        { name: 'Brain Stroke Protocol', content: '1. 定位：OM line\n2. 序列：DWI, ADC, FLAIR, T2, T1\n3. 注意事項：確認有無金屬植入物，DWI 為最優先序列。' },
        { name: 'L-Spine (腰椎)', content: '1. 線圈：Spine Coil\n2. 定位：以 Sagittal T2 為主，定位 Axial 切面平行於椎間盤。\n3. 範圍：T12 至 S1。' },
        { name: 'Shoulder (肩關節)', content: '1. 線圈：Shoulder Coil\n2. 擺位：手掌朝上 (Supine, arm neutral/external rotation)。\n3. 序列：Axial, Coronal Oblique, Sagittal Oblique。' }
      ]
    },
    'CT': {
      title: '電腦斷層 (CT)',
      items: [
        { name: 'Brain (Head)', content: '1. 基準線：OM Line 或 RB Line。\n2. 範圍：Foramen Magnum 至 Vertex。\n3. 條件：Bone window & Brain window。' },
        { name: 'Chest (胸部)', content: '1. 擺位：雙手舉高 (Arms up)。\n2. 呼吸：吸氣閉氣 (Inspiration breath-hold)。\n3. 範圍：Lung apex 至 Adrenal glands。' },
        { name: 'Abdomen (腹部)', content: '1. 擺位：雙手舉高。\n2. 顯影劑：依體重計算流速 (2.5-3.0 ml/s)。\n3. Phase：Arterial (30s), Portal Venous (70s)。' }
      ]
    },
    'X-Ray': {
      title: '一般攝影 (X-Ray)',
      items: [
        { name: 'CXR (胸部)', content: '1. 距離：180cm (SID)。\n2. 呼吸：深吸氣閉氣。\n3. 擺位：下巴抬高，肩膀貼緊板子，雙手叉腰手肘向前。' },
        { name: 'KUB (腹部)', content: '1. 距離：100cm (SID)。\n2. 呼吸：吐氣閉氣 (Expiration)。\n3. 中心點：Iliac crest。' },
        { name: 'Wrist (手腕)', content: '1. 視圖：PA, Lateral, Oblique。\n2. 重點：Scaphoid view 若懷疑骨折。' }
      ]
    },
    'US': {
      title: '超音波 (Ultrasound)',
      items: [
        { name: 'Abdomen (腹部)', content: '1. 準備：空腹 6-8 小時。\n2. 掃描順序：Liver -> GB -> Pancreas -> Spleen -> Kidneys。\n3. 技巧：深吸氣可讓肝臟下移。' },
        { name: 'Thyroid (甲狀腺)', content: '1. 探頭：高頻 Linear probe。\n2. 擺位：頸部伸展 (Neck extension)，墊枕頭於肩下。' }
      ]
    },
    'MG': {
      title: '乳房攝影 (Mammography)',
      items: [
        { name: 'CC View', content: '1. 擺位：C-arm 垂直 (0度)。\n2. 壓迫：適度壓迫至皮膚張力足夠。\n3. 範圍：包含內側乳房組織。' },
        { name: 'MLO View', content: '1. 角度：依體型調整 (30-60度)。\n2. 重點：必須包含 Pectoralis muscle (胸大肌) 至乳頭高度。' }
      ]
    },
    'BMD': {
      title: '骨質密度 (DXA)',
      items: [
        { name: 'L-Spine', content: '1. 擺位：仰躺，小腿墊高使腰椎平貼。\n2. 範圍：L1-L4。\n3. 排除：有骨刺或壓迫性骨折之椎體。' },
        { name: 'Hip (髖關節)', content: '1. 擺位：腳尖內旋 15-25 度 (固定器輔助)。\n2. 測量：Femoral neck, Ward\'s triangle, Trochanter。' }
      ]
    }
  };

  const openDeviceModal = (deviceKey: string) => {
    setActiveDevice(deviceKey);
    setDeviceTab('ai'); // Default to AI tab
    setSelectedGuide(null);
    setActiveModal('device');
    
    // Auto-trigger AI greeting
    const deviceName = deviceGuides[deviceKey]?.title || deviceKey;
    setQaHistory([{ role: 'ai', content: `您好！我是${deviceName}的專屬 AI 助理。請告訴我您想查詢的檢查項目或操作問題。` }]);
  };
  const [maintenanceTab, setMaintenanceTab] = useState<'routine' | 'fault'>('routine');
  const [selectedDevice, setSelectedDevice] = useState('3T MR');
  const [maintenanceContent, setMaintenanceContent] = useState('');
  const [faultStatus, setFaultStatus] = useState('normal');
  const [reporterName, setReporterName] = useState('');
  const [maintenanceHistory, setMaintenanceHistory] = useState<any[]>([]);
  
  // Guidelines State
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [selectedGuideline, setSelectedGuideline] = useState<any | null>(null);
  const [guidelineSearch, setGuidelineSearch] = useState('');
  const [isEditingGuideline, setIsEditingGuideline] = useState(false);
  const [editGuidelineData, setEditGuidelineData] = useState({ category: '', title: '', content: '', keywords: '' });

  const devices = ['3T MR', '1.5T MR', 'CT', 'US1', 'US2', 'US3', 'US4', 'MG', 'BMD', 'DX'];

  // Derived state for device status (Green/Red/Yellow)
  const getDeviceStatus = (device: string) => {
    const activeFaults = maintenanceHistory.filter((m: any) => m.device === device && m.type === 'fault' && m.status !== 'resolved');
    if (activeFaults.some((m: any) => m.status === 'critical')) return 'critical';
    if (activeFaults.some((m: any) => m.status === 'urgent')) return 'urgent';
    if (activeFaults.length > 0) return 'warning';
    return 'normal';
  };

  const resolveFault = async (id: number) => {
    if (!confirm("確定此故障已排除？")) return;
    const reporter = prompt("請輸入修復確認人姓名：");
    try {
      const res = await fetch(`/api/maintenance/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reporter })
      });
      if (!res.ok) throw new Error("API Error");
      fetchMaintenanceLogs();
    } catch (e) { alert("更新失敗"); }
  };

  const fetchGuidelines = async () => {
    try {
      const res = await fetch('/api/guidelines');
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setGuidelines(data);
      } else {
        console.warn("API returned non-JSON response:", res.status, await res.text());
      }
    } catch (e) { console.error(e); }
  };

  const saveGuideline = async () => {
    if (!editGuidelineData.title || !editGuidelineData.content) {
      alert("標題與內容為必填");
      return;
    }
    try {
      const formData = new FormData();
      if ((editGuidelineData as any).id) formData.append('id', (editGuidelineData as any).id);
      formData.append('category', editGuidelineData.category);
      formData.append('title', editGuidelineData.title);
      formData.append('content', editGuidelineData.content);
      formData.append('keywords', editGuidelineData.keywords);
      formData.append('reference_cases', (editGuidelineData as any).reference_cases || '');
      
      if ((editGuidelineData as any).image) {
        formData.append('image', (editGuidelineData as any).image);
      }

      const res = await fetch('/api/guidelines', {
        method: 'POST',
        body: formData // Content-Type is set automatically
      });
      if (!res.ok) throw new Error("API Error");
      alert("儲存成功");
      setIsEditingGuideline(false);
      fetchGuidelines();
      // If we were editing, update the selected view
      if ((editGuidelineData as any).id) {
        // We need to re-fetch or update local state properly. 
        // For simplicity, we'll let fetchGuidelines update the list, 
        // but we might lose the selected view if we don't handle it.
        // Let's just close the edit mode and let user re-select or find it.
        // Actually, let's try to keep it selected if possible, but we need the new image URL.
        // So fetching guidelines is best.
        setSelectedGuideline(null); 
      }
    } catch (e) { alert("儲存失敗"); }
  };

  const fetchMaintenanceLogs = async () => {
    try {
      const res = await fetch('/api/maintenance');
      const contentType = res.headers.get("content-type");
      if (res.ok && contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setMaintenanceHistory(data);
      }
    } catch (e) { console.error(e); }
  };

  const submitMaintenance = async () => {
    if (!maintenanceContent || !reporterName) {
      alert("請填寫內容與回報人");
      return;
    }
    
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: maintenanceTab,
          device: selectedDevice,
          content: maintenanceContent,
          status: maintenanceTab === 'routine' ? 'done' : faultStatus,
          reporter: reporterName
        })
      });
      if (!res.ok) throw new Error("API Error");
      alert("登記完成");
      setMaintenanceContent('');
      fetchMaintenanceLogs();
    } catch (e) {
      alert("登記失敗");
    }
  };

  useEffect(() => {
    if (activeModal === 'maintenance') {
      fetchMaintenanceLogs();
    }
  }, [activeModal]);



  // Q&A State
  const [qaInput, setQaInput] = useState('');
  const [qaHistory, setQaHistory] = useState<{role: 'user' | 'ai', content: string}[]>([
    { role: 'ai', content: '您好！我是影像醫學部的 AI 助理。您可以詢問我關於健檢常見疾病的影像特徵，或是各項檢查儀器的標準操作流程（SOP）。有什麼我可以幫忙的嗎？' }
  ]);
  const [isQaLoading, setIsQaLoading] = useState(false);
  const qaHistoryRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Announcements
  useEffect(() => {
    const fetchNotice = async () => {
      try {
        const response = await fetch('/api/announcement');
        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
          const data = await response.json();
          parseAnnouncements(data.text);
        } else {
          // Fallback
          parseAnnouncements("⚠️ [注意] 系統連線異常，請檢查網路。");
        }
      } catch (error) {
        // Fallback
        parseAnnouncements("⚠️ [注意] 系統連線異常，請檢查網路。");
      } finally {
        setIsLoadingAnnouncements(false);
      }
    };

    fetchNotice();
    const interval = setInterval(fetchNotice, 60000); // Refresh every 1 min
    return () => clearInterval(interval);
  }, []);

  const updateAnnouncement = async (text: string) => {
    try {
      await fetch('/api/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      // Refresh immediately
      parseAnnouncements(text);
      setActiveModal(null);
    } catch (error) {
      alert("更新失敗");
    }
  };

  const [activeSection, setActiveSection] = useState('top-header');

  // Scroll Spy
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;

    const handleScroll = () => {
      const sections = ['top-header', 'card-wl', 'card-db', 'card-sp', 'knowledge', 'card-mt', 'card-sc'];
      let current = '';
      
      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          // 100px offset for header/padding
          if (main.scrollTop >= (element.offsetTop - 150)) {
            current = sectionId;
          }
        }
      }
      
      if (current && current !== activeSection) {
        setActiveSection(current);
      }
    };

    main.addEventListener('scroll', handleScroll);
    return () => main.removeEventListener('scroll', handleScroll);
  }, [activeSection]);

  // --- Helpers ---

  const parseAnnouncements = (text: string) => {
    if (!text.trim()) {
      setAnnouncements([]);
      return;
    }
    const items = text.split(/\||\n/).map(s => s.trim()).filter(s => s.length > 0);
    setAnnouncements(items);
  };

  const formatTime = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[date.getDay()];
    return `${year}/${month}/${day} ${weekday}`;
  };



  // --- Gemini API Calls ---



  const askQA = async (question: string) => {
    if (!question.trim()) return;
    
    setQaHistory(prev => [...prev, { role: 'user', content: question }]);
    setQaInput('');
    setIsQaLoading(true);

    const instruction = `你是一位醫學影像科（放射科）的資深主治醫師。請針對放射師或護理師的提問，提供關於健檢常見疾病的影像學特徵，或是醫學影像檢查（CT, MRI, X-ray, 超音波等）的注意事項與SOP。
要求：
1. 回答必須專業、準確、簡明扼要。使用列點方式說明。
2. 若提及被檢查的人，必須一律使用「受檢者」或「客戶」稱呼，絕對不可使用「病患」或「病人」。
3. 結語加上一句溫馨的提醒。
4. 語言：繁體中文。`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [{ parts: [{ text: question }] }],
        config: {
          systemInstruction: instruction,
        }
      });
      setQaHistory(prev => [...prev, { role: 'ai', content: response.text || "無法生成內容。" }]);
    } catch (error) {
      console.error("Gemini API Error:", error);
      setQaHistory(prev => [...prev, { role: 'ai', content: "⚠️ 發生錯誤：伺服器目前繁忙，請稍後再試。" }]);
    } finally {
      setIsQaLoading(false);
    }
  };

  const askSOP = (device: string) => {
    setActiveModal('knowledge');
    const question = `請提供「${device}」儀器的標準操作流程 (SOP) 以及針對受檢者的注意事項？`;
    // Small delay to allow modal to open before "asking"
    setTimeout(() => {
        askQA(question);
    }, 100);
  };

  // --- Render ---

  return (
    <div className="bg-slate-900 text-slate-200 h-screen w-full flex flex-col items-end p-4 md:p-6 lg:p-8 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed relative">
      
      {/* Main Container */}
      <div className="w-full lg:w-[70%] xl:w-[65%] max-w-7xl h-full flex flex-col gap-4">
        
        {/* Top Bar: Marquee + Clock */}
        <div className="w-full h-14 bg-slate-950/80 backdrop-blur-xl border border-yellow-500/30 rounded-xl flex items-center px-4 md:px-6 shadow-xl shrink-0 z-40">
          <div className="text-yellow-500 mr-4 shrink-0 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          
          <div className="marquee-container flex-1 h-full border-r border-slate-700/50 pr-4 md:pr-6 mr-4 md:mr-6">
            <div className="marquee-content items-center h-full">
              {isLoadingAnnouncements ? (
                <div className="text-slate-500 text-sm flex items-center">
                  <Loader className="w-4 h-4 mr-2 animate-spin" /> 載入中...
                </div>
              ) : announcements.length === 0 ? (
                <span className="text-slate-500 text-sm">目前無最新公告。</span>
              ) : (
                announcements.map((item, index) => {
                  const isUrgent = item.includes('注意') || item.includes('警告') || item.includes('今日');
                  return isUrgent ? (
                    <div key={index} className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-3 py-1.5 rounded-full shrink-0">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                      <span className="text-xs font-bold text-yellow-500 tracking-wider">NEW</span>
                      <span className="text-sm font-bold text-white">{item}</span>
                    </div>
                  ) : (
                    <div key={index} className="flex items-center gap-2 px-3 py-1.5 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                      <span className="text-sm text-slate-300">{item}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div 
            className="text-right shrink-0 flex flex-col justify-center min-w-[100px] cursor-pointer select-none"
            onClick={(e) => {
              if (e.detail === 3) setActiveModal('admin');
            }}
          >
            <div className="text-lg md:text-xl font-mono font-bold text-white leading-none tracking-tight">
              {formatTime(currentTime)}
            </div>
            <div className="text-slate-400 text-[10px] mt-1 font-medium text-right">
              {formatDate(currentTime)}
            </div>
          </div>
        </div>

        {/* App Body */}
        <div className="w-full flex-1 rounded-2xl shadow-2xl flex border border-slate-700/50 overflow-hidden relative bg-app-main min-h-0">
          
          {/* Sidebar */}
          <aside 
            className={`bg-app-dark flex flex-col border-r border-slate-800 z-30 shrink-0 hidden sm:flex relative sidebar-transition ${isSidebarExpanded ? 'w-64' : 'w-20'}`}
          >
            <div className={`h-20 flex items-center px-6 border-b border-slate-800 relative transition-all duration-300 ${!isSidebarExpanded ? 'justify-center px-0' : ''}`}>
              <button 
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ${isSidebarExpanded ? 'mr-3' : 'mr-0'}`}
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className={`flex-1 transition-opacity duration-200 ${!isSidebarExpanded ? 'opacity-0 hidden' : 'opacity-100'}`}>
                <h1 className="text-white font-bold text-lg tracking-wide">RadPortal</h1>
                <p className="text-[10px] text-slate-500">影像醫學部工作站</p>
              </div>
            </div>
            
            <nav className="flex-1 py-6 px-4 flex flex-col gap-2 overflow-x-hidden">
              <SidebarItem icon="DS" label="工作儀表板" target="top-header" expanded={isSidebarExpanded} active={activeSection === 'top-header'} />
              <SidebarItem icon="WL" label="工作日誌" target="card-wl" expanded={isSidebarExpanded} active={activeSection === 'card-wl'} />
              <SidebarItem icon="DB" label="光碟燒錄" target="card-db" expanded={isSidebarExpanded} active={activeSection === 'card-db'} />
              <SidebarItem icon="SP" label="衛耗材" target="card-sp" expanded={isSidebarExpanded} active={activeSection === 'card-sp'} />
              
              <div className="my-2 border-t border-slate-800 mx-2"></div>
              
              <SidebarItem icon="KB" label="專業知識" target="knowledge" expanded={isSidebarExpanded} active={activeSection === 'knowledge'} />
              <SidebarItem icon="MT" label="儀器保養" target="card-mt" expanded={isSidebarExpanded} active={activeSection === 'card-mt'} />
              <SidebarItem icon="SC" label="排班系統" target="card-sc" expanded={isSidebarExpanded} active={activeSection === 'card-sc'} />
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative scroll-smooth p-4 md:p-5 pb-4 flex flex-col gap-3 md:gap-4 pt-4 md:pt-5">
            
            {/* Section: Daily Operations */}
            <section className="shrink-0" id="top-header">
              <div className="flex items-baseline gap-3 mb-2">
                <h3 className="text-lg font-bold text-white">Daily Operations</h3>
                <p className="text-slate-400 text-xs hidden sm:block">標準作業流程與日常紀錄工具。</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <a 
                  href="https://docs.google.com/spreadsheets/d/1XVPu-el_sXaHqwjXdlSD1ESfZtXogE5yCm5yUKzStZ8/edit?gid=1469824280#gid=1469824280"
                  target="_blank"
                  rel="noreferrer"
                  id="card-wl" 
                  className="bg-app-card hover:bg-app-card-hover rounded-xl p-2.5 flex items-center gap-3 transition-all border border-transparent hover:border-blue-500/50 group text-left w-full relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform relative z-10">
                    <ClipboardEdit className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white relative z-10">工作日誌</h4>
                </a>
                
                <a href="https://drive.google.com/drive/folders/1jvhBzhLEmrlerGmTlCSohnrSl5t8hwW9" target="_blank" rel="noreferrer" id="card-db" className="bg-app-card hover:bg-app-card-hover rounded-xl p-2.5 flex items-center gap-3 transition-all border border-transparent hover:border-slate-600 group">
                  <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Disc3 className="w-4 h-4 text-yellow-400" />
                  </div>
                  <h4 className="text-sm font-bold text-white">光碟燒錄</h4>
                </a>
                
                <div className="bg-app-card rounded-xl p-2.5 flex flex-col gap-2 border border-transparent hover:border-slate-600 transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-lg bg-slate-800/50 flex items-center justify-center shrink-0">
                      <PackageSearch className="w-3 h-3 text-yellow-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white">衛耗材管理</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <a href="https://docs.google.com/spreadsheets/d/1mvx3lRO0D29lO8a-h_dtiwc-zteG7gka/edit?gid=1799172952#gid=1799172952" target="_blank" rel="noreferrer" className="bg-slate-800/50 hover:bg-blue-600/30 text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded text-center transition-colors border border-slate-700/50 hover:border-blue-500/50">
                      CT
                    </a>
                    <a href="https://docs.google.com/spreadsheets/d/1JPkMM8a6HWCxtfNeeOE5pfanqvuLy012/edit?gid=641085245#gid=641085245" target="_blank" rel="noreferrer" className="bg-slate-800/50 hover:bg-blue-600/30 text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded text-center transition-colors border border-slate-700/50 hover:border-blue-500/50">
                      1.5T
                    </a>
                    <a href="https://docs.google.com/spreadsheets/d/1tq0UfMyE5LrMAO2sy-BVnRfdyF7ULXkc/edit?gid=127464242#gid=127464242" target="_blank" rel="noreferrer" className="bg-slate-800/50 hover:bg-blue-600/30 text-xs text-slate-300 hover:text-white py-1.5 px-2 rounded text-center transition-colors border border-slate-700/50 hover:border-blue-500/50">
                      3T
                    </a>
                    <a href="https://form.jotform.com/201820038653045" target="_blank" rel="noreferrer" className="bg-slate-800/50 hover:bg-amber-600/30 text-xs text-amber-200/80 hover:text-amber-100 py-1.5 px-2 rounded text-center transition-colors border border-slate-700/50 hover:border-amber-500/50">
                      庫房
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Bottom Section: Split Columns */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 pb-4">
              
              {/* Left: Professional Knowledge */}
              <section id="knowledge" className="xl:col-span-7 bg-app-card rounded-xl p-4 border border-slate-800 flex flex-col relative">
                <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                </div>

                <div className="flex items-baseline gap-3 mb-3 shrink-0 relative z-10">
                  <h3 className="text-base font-bold text-white">Professional Knowledge</h3>
                  <p className="text-slate-400 text-[11px] hidden sm:block">檢查指引與儀器操作手冊。</p>
                </div>
                
                <div className="flex flex-col gap-2 mb-3 shrink-0 relative z-10">
                  <a 
                    onClick={() => {
                      setActiveModal('guidelines');
                      fetchGuidelines();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-blue-900/30 rounded-md text-blue-400">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-bold text-white">健檢常見疾病指引</span>
                      </div>
                    </div>
                    <ExternalLink className="text-slate-500 w-4 h-4 group-hover:text-blue-400 transition-all" />
                  </a>

                  <button onClick={() => setActiveModal('knowledge')} className="w-full flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-slate-800/80 to-slate-800/40 hover:from-amber-900/40 hover:to-slate-800/40 border border-slate-700 hover:border-amber-500/50 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-amber-500/20 rounded-md text-amber-400">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="block text-sm font-bold text-amber-50">✨ 健檢常見疾病 AI 指引</span>
                      </div>
                    </div>
                    <ArrowRight className="text-slate-500 w-4 h-4 group-hover:translate-x-1 group-hover:text-amber-400 transition-all" />
                  </button>
                </div>

                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-2 relative z-10 flex items-center gap-1.5">
                  <FileText className="w-3 h-3" /> Equipment Manuals (SOP)
                </h4>
                
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 shrink-0 relative z-10">
                  <SopButton label="MR" subLabel="磁振造影" onClick={() => openDeviceModal('MR')} />
                  <SopButton label="US" subLabel="超音波" onClick={() => openDeviceModal('US')} />
                  <SopButton label="CT" subLabel="電腦斷層" onClick={() => openDeviceModal('CT')} />
                  <SopButton label="X光" subLabel="一般攝影" onClick={() => openDeviceModal('X-Ray')} />
                  <SopButton label="骨密" subLabel="DXA" onClick={() => openDeviceModal('BMD')} />
                  <SopButton label="乳房" subLabel="攝影" onClick={() => openDeviceModal('MG')} />
                </div>
              </section>

              {/* Right: Status */}
              <section className="xl:col-span-5 bg-app-card rounded-xl p-4 border border-slate-800 shadow-lg flex flex-col">
                <h3 className="text-base font-bold text-white mb-3 shrink-0">System & Status</h3>
                
                <button 
                  onClick={() => setActiveModal('maintenance')}
                  id="card-mt" 
                  className="block w-full text-left bg-[#1a1e29] rounded-lg border border-red-900/50 mb-2 overflow-hidden group hover:border-red-500/50 transition-colors shrink-0"
                >
                  <div className="bg-red-900/20 px-2.5 py-1 border-b border-red-900/50 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-red-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> FAULT / REPAIR
                    </span>
                    <span className="text-[9px] bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">Action</span>
                  </div>
                  <div className="p-2.5">
                    <h4 className="text-sm font-bold text-white mb-0.5">儀器保養登記</h4>
                    <p className="text-[11px] text-slate-400">目前有 {maintenanceHistory.filter((m: any) => m.type === 'fault' && m.status !== 'resolved').length} 項設備待修追蹤</p>
                  </div>
                </button>

                <a href="https://penny-liu.github.io/schedule/" target="_blank" rel="noreferrer" id="card-sc" className="block bg-[#1a1e29] rounded-lg border border-slate-700 hover:border-slate-500 transition-colors shrink-0 mt-auto">
                  <div className="p-2.5 flex items-center gap-3">
                    <div className="p-2 bg-slate-800 rounded-md text-slate-300">
                      <CalendarCheck2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-0.5">排班系統</h4>
                      <p className="text-[11px] text-slate-400">班表查看與休假申請</p>
                    </div>
                  </div>
                </a>
              </section>
            </div>

          </main>
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Modal 1: Work Log - REMOVED */}


      {/* Modal 2: Knowledge QA */}
      <div className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${activeModal === 'knowledge' ? 'active' : ''}`}>
        <div className="modal-content bg-app-card border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-full overflow-hidden h-[600px]">
          <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-[#1a1e29]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-amber-500/20 rounded-md text-amber-400">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">✨ 醫學影像知識 AI 助理</h3>
            </div>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 flex flex-col gap-4 overflow-y-auto h-full">
            
            <div className="flex-1 flex flex-col overflow-hidden">
              <div ref={qaHistoryRef} className="bg-[#0f1219] border border-slate-700 rounded-xl p-4 flex-1 overflow-y-auto flex flex-col gap-4 relative">
                {qaHistory.map((msg, idx) => (
                  <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20' : 'bg-amber-500/20'}`}>
                      {msg.role === 'user' ? <User className="w-4 h-4 text-blue-400" /> : <Bot className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className={`rounded-2xl p-3 text-sm leading-relaxed border max-w-[85%] ${
                      msg.role === 'user' 
                        ? 'bg-blue-900/40 rounded-tr-sm text-blue-100 border-blue-800/50' 
                        : 'bg-slate-800 rounded-tl-sm text-slate-200 border-slate-700/50'
                    }`}>
                      {msg.content.split('\n').map((line, i) => (
                        <span key={i}>
                          {line}
                          <br />
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                
                {isQaLoading && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="bg-slate-800 rounded-2xl rounded-tl-sm p-3 text-sm text-slate-400 flex items-center gap-2 border border-slate-700/50">
                      <Loader2 className="w-4 h-4 animate-spin" /> 正在搜尋文獻與整理答案...
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <input 
                type="text" 
                value={qaInput}
                onChange={(e) => setQaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && askQA(qaInput)}
                className="flex-1 bg-[#0f1219] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors placeholder-slate-600" 
                placeholder="例如：有心律調節器的受檢者做 MRI 的注意事項？" 
              />
              <button 
                onClick={() => askQA(qaInput)}
                disabled={isQaLoading || !qaInput.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-5 rounded-xl flex items-center gap-2 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" /> 詢問
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 3: Admin Announcement Edit */}
      <div className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${activeModal === 'admin' ? 'active' : ''}`}>
        <div className="modal-content bg-app-card border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col">
          <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-[#1a1e29]">
            <h3 className="text-lg font-bold text-white">📢 更新跑馬燈公告</h3>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <textarea 
              id="admin-announce-input"
              rows={5} 
              className="w-full bg-[#0f1219] border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none" 
              placeholder="輸入公告內容，多則公告請用 | 分隔..."
              defaultValue={announcements.join(' | ')}
            ></textarea>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
              <button 
                onClick={() => {
                  const val = (document.getElementById('admin-announce-input') as HTMLTextAreaElement).value;
                  updateAnnouncement(val);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg"
              >
                更新並同步
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 4: Maintenance */}
      <div className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${activeModal === 'maintenance' ? 'active' : ''}`}>
        <div className="modal-content bg-app-card border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-[#1a1e29]">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-500/20 rounded-md text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">儀器保養與故障登記</h3>
            </div>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Device Status Dashboard */}
          <div className="bg-[#0f1219] p-4 border-b border-slate-800 grid grid-cols-5 sm:grid-cols-10 gap-2">
            {devices.map(d => {
              const status = getDeviceStatus(d);
              return (
                <div key={d} className={`flex flex-col items-center justify-center p-2 rounded-lg border ${
                  status === 'critical' ? 'bg-red-900/20 border-red-500/50' :
                  status === 'urgent' ? 'bg-orange-900/20 border-orange-500/50' :
                  status === 'warning' ? 'bg-yellow-900/20 border-yellow-500/50' :
                  'bg-slate-800/30 border-slate-700/30'
                }`}>
                  <div className={`w-2.5 h-2.5 rounded-full mb-1.5 ${
                    status === 'critical' ? 'bg-red-500 animate-pulse' :
                    status === 'urgent' ? 'bg-orange-500 animate-pulse' :
                    status === 'warning' ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}></div>
                  <span className={`text-[10px] font-bold ${status === 'normal' ? 'text-slate-400' : 'text-white'}`}>{d}</span>
                </div>
              );
            })}
          </div>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Form */}
            <div className="w-1/3 border-r border-slate-700/50 p-5 flex flex-col gap-4 overflow-y-auto bg-[#161a23]">
              
              {/* Tabs */}
              <div className="flex bg-slate-800/50 p-1 rounded-lg">
                <button 
                  onClick={() => setMaintenanceTab('routine')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${maintenanceTab === 'routine' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  例行保養
                </button>
                <button 
                  onClick={() => setMaintenanceTab('fault')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${maintenanceTab === 'fault' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  故障登記
                </button>
              </div>

              {/* Device Select */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">選擇儀器</label>
                <div className="grid grid-cols-2 gap-2">
                  {devices.map(d => (
                    <button
                      key={d}
                      onClick={() => setSelectedDevice(d)}
                      className={`py-2 px-1 text-xs rounded border transition-colors ${selectedDevice === d ? 'bg-slate-700 border-blue-500 text-white' : 'bg-slate-800/50 border-transparent text-slate-400 hover:bg-slate-700'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Input */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  {maintenanceTab === 'routine' ? '保養項目 / 備註' : '故障情形描述'}
                </label>
                <textarea 
                  value={maintenanceContent}
                  onChange={(e) => setMaintenanceContent(e.target.value)}
                  rows={4}
                  className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none placeholder-slate-600"
                  placeholder={maintenanceTab === 'routine' ? "例：開機測試正常、探頭清潔完成..." : "例：無法開機、影像出現假影..."}
                ></textarea>
              </div>

              {/* Fault Specifics */}
              {maintenanceTab === 'fault' && (
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">緊急程度</label>
                  <div className="flex gap-2">
                    {['normal', 'urgent', 'critical'].map(s => (
                      <button
                        key={s}
                        onClick={() => setFaultStatus(s)}
                        className={`flex-1 py-1.5 text-xs rounded border capitalize transition-colors ${
                          faultStatus === s 
                            ? (s === 'critical' ? 'bg-red-900/50 border-red-500 text-red-200' : s === 'urgent' ? 'bg-orange-900/50 border-orange-500 text-orange-200' : 'bg-blue-900/50 border-blue-500 text-blue-200')
                            : 'bg-slate-800/50 border-transparent text-slate-400'
                        }`}
                      >
                        {s === 'critical' ? '停機' : s === 'urgent' ? '緊急' : '一般'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reporter */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">登記人</label>
                <input 
                  type="text" 
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  placeholder="請輸入姓名"
                />
              </div>

              <button 
                onClick={submitMaintenance}
                className={`mt-auto w-full py-2.5 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 ${maintenanceTab === 'routine' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                <Check className="w-4 h-4" /> 提交登記
              </button>

            </div>

            {/* Right: History */}
            <div className="flex-1 p-5 bg-[#0f1219] overflow-y-auto">
              <h4 className="text-sm font-bold text-slate-300 mb-4 flex items-center gap-2 sticky top-0 bg-[#0f1219] pb-2 border-b border-slate-800 z-10">
                <FileText className="w-4 h-4 text-slate-500" /> 近期紀錄 ({selectedDevice})
              </h4>
              
              <div className="space-y-3">
                {maintenanceHistory.filter((m: any) => m.device === selectedDevice).length === 0 ? (
                  <div className="text-center text-slate-500 py-10 text-sm">尚無紀錄</div>
                ) : (
                  maintenanceHistory
                    .filter((m: any) => m.device === selectedDevice)
                    .map((log: any) => (
                    <div key={log.id} className={`rounded-lg p-3 border text-sm relative ${log.type === 'fault' && log.status !== 'resolved' ? 'bg-red-900/10 border-red-900/30' : 'bg-slate-800/30 border-slate-700/30'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${log.type === 'fault' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                            {log.type === 'fault' ? '故障' : '保養'}
                          </span>
                          {log.type === 'fault' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              log.status === 'resolved' ? 'bg-green-600 text-white' :
                              log.status === 'critical' ? 'bg-red-600 text-white' : 
                              log.status === 'urgent' ? 'bg-orange-500 text-white' : 'bg-slate-600 text-slate-200'
                            }`}>
                              {log.status === 'resolved' ? '已修復' : log.status === 'critical' ? '停機' : log.status === 'urgent' ? '緊急' : '一般'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 mb-2 whitespace-pre-wrap">{log.content}</p>
                      <div className="flex justify-between items-center text-[11px] text-slate-500 border-t border-slate-700/30 pt-2">
                        <span>登記人: {log.reporter}</span>
                        {log.type === 'fault' && log.status !== 'resolved' && (
                          <button 
                            onClick={() => resolveFault(log.id)}
                            className="text-green-400 hover:text-green-300 flex items-center gap-1 font-bold bg-green-900/20 px-2 py-0.5 rounded border border-green-900/50 hover:bg-green-900/40"
                          >
                            <Check className="w-3 h-3" /> 標示為已修復
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 5: Device Specific Portal */}
      <div className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${activeModal === 'device' && activeDevice ? 'active' : ''}`}>
        <div className="modal-content bg-app-card border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-[#1a1e29]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{activeDevice && deviceGuides[activeDevice]?.title}</h3>
                <p className="text-xs text-slate-400">標準作業流程與技術教學</p>
              </div>
            </div>
            <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-[#161a23] border-r border-slate-700/50 flex flex-col">
              <div className="p-3 gap-2 flex flex-col">
                <button 
                  onClick={() => setDeviceTab('ai')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${deviceTab === 'ai' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <Bot className="w-5 h-5" />
                  <span className="font-bold">AI 智能助理</span>
                </button>
                <button 
                  onClick={() => setDeviceTab('guide')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${deviceTab === 'guide' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="font-bold">技術教學手冊</span>
                </button>
              </div>
              
              {deviceTab === 'guide' && (
                <div className="flex-1 overflow-y-auto px-3 pb-3">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Protocols</div>
                  <div className="flex flex-col gap-1">
                    {activeDevice && deviceGuides[activeDevice]?.items.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedGuide(item.name)}
                        className={`text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${selectedGuide === item.name ? 'bg-slate-800 text-white border-l-2 border-indigo-500' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 bg-[#0f1219] relative flex flex-col">
              
              {/* Tab 1: AI Assistant */}
              {deviceTab === 'ai' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-5 space-y-4" ref={qaHistoryRef}>
                    {qaHistory.map((msg, idx) => (
                      <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-500/20' : 'bg-indigo-500/20'}`}>
                          {msg.role === 'user' ? <User className="w-4 h-4 text-blue-400" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <div className={`rounded-2xl p-4 text-sm leading-relaxed border max-w-[85%] shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-blue-900/40 rounded-tr-sm text-blue-100 border-blue-800/50' 
                            : 'bg-slate-800 rounded-tl-sm text-slate-200 border-slate-700/50'
                        }`}>
                          {msg.content.split('\n').map((line, i) => (
                            <span key={i}>{line}<br /></span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {isQaLoading && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        </div>
                        <div className="bg-slate-800 rounded-2xl rounded-tl-sm p-4 text-sm text-slate-400 border border-slate-700/50">
                          AI 正在查詢 {activeDevice && deviceGuides[activeDevice]?.title} 的相關資料...
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="p-4 border-t border-slate-800 bg-[#161a23]">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={qaInput}
                        onChange={(e) => setQaInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && askQA(qaInput)}
                        className="flex-1 bg-[#0f1219] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder-slate-600" 
                        placeholder={`詢問關於 ${activeDevice && deviceGuides[activeDevice]?.title} 的問題...`} 
                      />
                      <button 
                        onClick={() => askQA(qaInput)}
                        disabled={isQaLoading || !qaInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-6 rounded-xl flex items-center gap-2 transition-colors shrink-0 shadow-lg shadow-indigo-900/20"
                      >
                        <Send className="w-4 h-4" /> 發送
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Technical Guide */}
              {deviceTab === 'guide' && (
                <div className="h-full flex flex-col">
                  {selectedGuide ? (
                    <div className="flex-1 overflow-y-auto p-8">
                      <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3 pb-4 border-b border-slate-800">
                          <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                          {selectedGuide} Protocol
                        </h2>
                        
                        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                          <div className="prose prose-invert max-w-none">
                            <div className="whitespace-pre-wrap text-slate-300 leading-loose text-lg">
                              {activeDevice && deviceGuides[activeDevice]?.items.find(i => i.name === selectedGuide)?.content}
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 flex gap-4">
                          <div className="flex-1 bg-blue-900/20 border border-blue-900/50 rounded-xl p-4">
                            <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" /> 注意事項
                            </h4>
                            <p className="text-sm text-blue-200/80">
                              請務必確認受檢者身分，並在檢查前再次核對檢查部位與左右側。若有顯影劑注射，請確認 GFR 數值。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                      <FileText className="w-16 h-16 mb-4 opacity-20" />
                      <p className="text-lg">請從左側選單選擇一個檢查項目</p>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* Modal 6: Disease Guidelines */}
      <div className={`modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ${activeModal === 'guidelines' ? 'active' : ''}`}>
        <div className="modal-content bg-app-card border border-slate-700 w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col h-[90vh] overflow-hidden">
          <div className="p-4 border-b border-slate-700/80 flex justify-between items-center bg-[#1a1e29]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">健檢常見疾病指引知識庫</h3>
                <p className="text-xs text-slate-400">影像特徵、鑑別診斷與建議處置</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setIsEditingGuideline(true);
                  setEditGuidelineData({ category: '', title: '', content: '', keywords: '' });
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <ClipboardEdit className="w-3.5 h-3.5" /> 新增指引
              </button>
              <button onClick={() => setActiveModal(null)} className="text-slate-400 hover:text-white transition-colors ml-2">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Search & List */}
            <div className="w-80 bg-[#161a23] border-r border-slate-700/50 flex flex-col">
              <div className="p-4 border-b border-slate-800">
                <input 
                  type="text" 
                  value={guidelineSearch}
                  onChange={(e) => setGuidelineSearch(e.target.value)}
                  className="w-full bg-[#0f1219] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder-slate-600"
                  placeholder="搜尋疾病名稱或關鍵字..."
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {guidelines
                  .filter(g => 
                    g.title.toLowerCase().includes(guidelineSearch.toLowerCase()) || 
                    g.keywords.toLowerCase().includes(guidelineSearch.toLowerCase()) ||
                    g.category.includes(guidelineSearch)
                  )
                  .map(g => (
                    <button
                      key={g.id}
                      onClick={() => {
                        setSelectedGuideline(g);
                        setIsEditingGuideline(false);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors border ${
                        selectedGuideline?.id === g.id 
                          ? 'bg-blue-900/20 border-blue-500/50 text-white' 
                          : 'bg-transparent border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs text-blue-400 font-bold mb-0.5">{g.category}</div>
                      <div className="font-bold text-sm truncate">{g.title}</div>
                    </button>
                  ))}
              </div>
            </div>

            {/* Right: Content or Editor */}
            <div className="flex-1 bg-[#0f1219] flex flex-col overflow-hidden relative">
              {isEditingGuideline ? (
                <div className="flex-1 p-8 overflow-y-auto">
                  <div className="max-w-3xl mx-auto bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                    <h3 className="text-lg font-bold text-white mb-4">
                      {editGuidelineData.title ? '編輯指引' : '新增指引'}
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1.5">分類 (Category)</label>
                          <input 
                            type="text" 
                            value={editGuidelineData.category}
                            onChange={(e) => setEditGuidelineData({...editGuidelineData, category: e.target.value})}
                            className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                            placeholder="例如：肝膽系統"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 mb-1.5">疾病名稱 (Title)</label>
                          <input 
                            type="text" 
                            value={editGuidelineData.title}
                            onChange={(e) => setEditGuidelineData({...editGuidelineData, title: e.target.value})}
                            className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                            placeholder="例如：脂肪肝 (Fatty Liver)"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">關鍵字 (Keywords)</label>
                        <input 
                          type="text" 
                          value={editGuidelineData.keywords}
                          onChange={(e) => setEditGuidelineData({...editGuidelineData, keywords: e.target.value})}
                          className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                          placeholder="用逗號分隔，例如：liver, fatty, 肝臟"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">院內病歷號 (Reference Cases)</label>
                        <textarea 
                          value={(editGuidelineData as any).reference_cases || ''}
                          onChange={(e) => setEditGuidelineData({...editGuidelineData, reference_cases: e.target.value} as any)}
                          className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 h-20 resize-none"
                          placeholder="例如：12345678 (典型脂肪肝), 87654321 (非典型表現)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">上傳圖片 (Image)</label>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setEditGuidelineData({...editGuidelineData, image: e.target.files[0]} as any);
                            }
                          }}
                          className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-2.5 text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                        />
                        {(editGuidelineData as any).image_url && !(editGuidelineData as any).image && (
                          <div className="mt-2 text-xs text-slate-500">
                            目前已有圖片: <a href={(editGuidelineData as any).image_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">查看圖片</a>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1.5">內容 (Content)</label>
                        <textarea 
                          value={editGuidelineData.content}
                          onChange={(e) => setEditGuidelineData({...editGuidelineData, content: e.target.value})}
                          rows={15}
                          className="w-full bg-[#0f1219] border border-slate-700 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono leading-relaxed"
                          placeholder="請輸入影像特徵、鑑別診斷與建議..."
                        ></textarea>
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button 
                          onClick={() => setIsEditingGuideline(false)}
                          className="px-4 py-2 text-slate-400 hover:text-white text-sm"
                        >
                          取消
                        </button>
                        <button 
                          onClick={saveGuideline}
                          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg text-sm"
                        >
                          儲存內容
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : selectedGuideline ? (
                <div className="flex-1 p-8 overflow-y-auto">
                  <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-800">
                      <div>
                        <div className="text-sm font-bold text-blue-400 mb-1">{selectedGuideline.category}</div>
                        <h2 className="text-3xl font-bold text-white">{selectedGuideline.title}</h2>
                      </div>
                      <button 
                        onClick={() => {
                          setEditGuidelineData(selectedGuideline);
                          setIsEditingGuideline(true);
                        }}
                        className="text-slate-500 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        title="編輯此指引"
                      >
                        <ClipboardEdit className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="bg-slate-800/30 rounded-2xl p-8 border border-slate-700/30 shadow-xl">
                      {(selectedGuideline as any).image_url && (
                        <div className="mb-6">
                          <img 
                            src={(selectedGuideline as any).image_url} 
                            alt={selectedGuideline.title} 
                            className="w-full max-h-[400px] object-contain rounded-xl border border-slate-700/50 bg-black/20"
                          />
                        </div>
                      )}
                      
                      {(selectedGuideline as any).reference_cases && (
                        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-900/50 rounded-xl">
                          <h4 className="text-blue-400 font-bold mb-2 text-sm flex items-center gap-2">
                            <FileText className="w-4 h-4" /> 院內參考病歷
                          </h4>
                          <p className="text-slate-300 text-sm whitespace-pre-wrap">
                            {(selectedGuideline as any).reference_cases}
                          </p>
                        </div>
                      )}

                      <div className="prose prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-slate-300 leading-loose text-lg">
                          {selectedGuideline.content}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 text-xs text-slate-500 font-mono">
                      最後更新：{new Date(selectedGuideline.updated_at).toLocaleString()} | 關鍵字：{selectedGuideline.keywords}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <Stethoscope className="w-20 h-20 mb-6 opacity-20" />
                  <p className="text-xl font-bold mb-2">請從左側選擇疾病指引</p>
                  <p className="text-sm opacity-60">或點擊右上角「新增指引」建立新條目</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// --- Components ---

function SidebarItem({ icon, label, target, expanded, active }: { icon: string, label: string, target: string, expanded: boolean, active?: boolean }) {
  return (
    <a 
      href={`#${target}`} 
      className={`flex items-center px-4 py-3 rounded-lg transition-colors group relative ${
        active ? 'bg-app-card text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${!expanded ? 'justify-center px-0' : ''}`}
      title={!expanded ? label : ''}
    >
      <div className={`w-8 shrink-0 flex justify-center text-xs font-bold transition-colors ${expanded ? 'mr-3' : 'mr-0'}`}>
        {icon}
      </div>
      <span className={`font-medium whitespace-nowrap transition-opacity duration-200 ${!expanded ? 'opacity-0 hidden' : 'opacity-100'}`}>
        {label}
      </span>
    </a>
  );
}

function SopButton({ label, subLabel, onClick }: { label: string, subLabel: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick} 
      className="flex flex-col items-center justify-center bg-slate-800/80 hover:bg-amber-900/40 border border-slate-700/80 hover:border-amber-500/50 rounded-lg py-2 transition-colors w-full shadow-sm"
    >
      <span className="font-mono text-sm font-bold text-slate-100">{label}</span>
      {subLabel !== label && <span className="text-[10px] font-bold text-slate-100 text-center leading-tight">{subLabel}</span>}
    </button>
  );
}
