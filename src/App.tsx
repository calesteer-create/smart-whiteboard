import { useState } from "react";
import { BookOpen, Download, Grid2X2, HelpCircle, Palette, Pencil, Shapes, Type, Undo2, Redo2, ZoomIn, ZoomOut, Sparkles } from "lucide-react";

export default function App() {
  const [title, setTitle] = useState("مساحة جديدة");
  const [zoom, setZoom] = useState(100);
  const [color, setColor] = useState("#334155");
  const [fontSize, setFontSize] = useState(24);
  const [tool, setTool] = useState("select");
  return <main className="app-shell" dir="rtl">
    <header className="topbar">
      <div className="brand-mark">✦</div><div className="brand-copy"><strong>Smart Whiteboard</strong><span>مساحة أفكارك الذكية</span></div>
      <div className="document-title"><input aria-label="عنوان اللوحة" value={title} onChange={e=>setTitle(e.target.value)} /><span className="saved-dot"/> <small>محلياً</small></div>
      <div className="top-actions"><button className="icon-button" title="تراجع"><Undo2 size={18}/></button><button className="icon-button" title="إعادة"><Redo2 size={18}/></button><button className="secondary-button"><Download size={16}/> تصدير</button><button className="primary-button"><Sparkles size={16}/> مساعد ذكي</button></div>
    </header>
    <section className="workspace">
      <aside className="tool-rail" aria-label="أدوات اللوحة">
        {[[Pencil,"تحديد","select"],[Type,"نص","text"],[Shapes,"أشكال","shapes"],[Grid2X2,"شبكة","grid"],[Palette,"لون","color"],[BookOpen,"معادلة","math"]].map(([Icon,label,id]: any)=><button key={id} className={`tool-button ${tool===id?"active":""}`} title={label} onClick={()=>setTool(id)}><Icon size={19}/><span>{label}</span></button>)}
        <div className="rail-spacer"/><button className="tool-button" title="مساعدة"><HelpCircle size={19}/><span>مساعدة</span></button>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><div className="tool-context"><span className="context-label">الأداة</span><strong>{({select:"تحديد وتحريك",text:"إضافة نص",shapes:"أشكال هندسية",grid:"الشبكة",color:"إعدادات اللون",math:"معادلة علمية"} as any)[tool]}</strong></div><div className="format-controls"><label>اللون <input type="color" value={color} onChange={e=>setColor(e.target.value)}/></label><label>الحجم <input type="number" min="8" max="120" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/></label></div></div>
        <div className="canvas-wrap"><div className="paper"><div className="welcome-card"><div className="welcome-icon"><Sparkles size={24}/></div><h1>كل فكرة تستحق مساحة</h1><p>ابدأ بالكتابة، ارسم مخططاً، أو أضف معادلتك العلمية.</p><div className="starter-actions"><button onClick={()=>setTool("text")}><Type size={16}/> أضف نصاً</button><button onClick={()=>setTool("math")}><BookOpen size={16}/> اكتب معادلة</button><button onClick={()=>setTool("shapes")}><Shapes size={16}/> ارسم شكلاً</button></div><small>هذه واجهة البداية — أدوات اللوحة التفاعلية قادمة على مراحل عبر PRs منفصلة.</small></div></div></div>
        <footer className="statusbar"><span>جاهز للعمل</span><span className="status-right"><button onClick={()=>setZoom(z=>Math.max(25,z-10))}><ZoomOut size={15}/></button><span>{zoom}%</span><button onClick={()=>setZoom(z=>Math.min(200,z+10))}><ZoomIn size={15}/></button><span className="status-divider"/><span>لوحة 1</span></span></footer>
      </section>
    </section>
  </main>;
}
