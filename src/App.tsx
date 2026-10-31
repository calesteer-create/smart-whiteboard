import { useEffect, useRef, useState } from "react";
import { BookOpen, Download, Grid2X2, HelpCircle, Palette, Pencil, Shapes, Type, Undo2, Redo2, ZoomIn, ZoomOut, Sparkles } from "lucide-react";
import Board from "./Board";
import { DEFAULT_BOARD_TITLE, isBoardTitleStorageEvent, loadBoardTitle, saveBoardTitle } from "./titleStorage";

type TitleStatus = "unsaved" | "saving" | "saved" | "read-error" | "save-error" | "changed-elsewhere";

type TitleState = {
  value: string;
  status: TitleStatus;
};

const titleStatusLabels: Record<TitleStatus, string> = {
  unsaved: "العنوان غير محفوظ",
  saving: "جارٍ حفظ العنوان",
  saved: "العنوان محفوظ محليًا",
  "read-error": "تعذّر قراءة العنوان",
  "save-error": "تعذّر حفظ العنوان",
  "changed-elsewhere": "عنوانك غير محفوظ",
};

// R2: controls whose behaviour is not implemented yet are disabled and explain why.
function unavailableTitle(label: string): string {
  return `${label} — غير متاح حاليًا`;
}

function initialTitleState(): TitleState {
  const stored = loadBoardTitle();
  if (stored.status === "found") return { value: stored.title, status: "saved" };
  if (stored.status === "missing") return { value: DEFAULT_BOARD_TITLE, status: "unsaved" };
  return { value: DEFAULT_BOARD_TITLE, status: "read-error" };
}

export default function App() {
  const [{ value: title, status: titleStatus }, setTitleState] = useState(initialTitleState);
  const currentTitle = useRef(title);
  const saveTimer = useRef<number | null>(null);
  // Zoom is shown but not applied to the canvas yet (R2: the control is disabled).
  const [zoom] = useState(100);
  const [textTool, setTextTool] = useState(false);
  const [color, setColor] = useState("#334155");
  const [fontSize, setFontSize] = useState(24);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (!isBoardTitleStorageEvent(event)) return;

      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const stored = loadBoardTitle();
      let status: TitleStatus;
      if (stored.status === "found" && stored.title === currentTitle.current) {
        status = "saved";
      } else if (stored.status === "invalid" || stored.status === "unavailable") {
        status = "read-error";
      } else {
        status = "changed-elsewhere";
      }
      setTitleState((state) => ({ ...state, status }));
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  function handleTitleChange(nextTitle: string) {
    if (nextTitle === currentTitle.current) return;
    currentTitle.current = nextTitle;

    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    setTitleState({ value: nextTitle, status: "saving" });
    // Persist synchronously so a reload immediately after editing does not lose the title.
    const saved = saveBoardTitle(nextTitle);
    saveTimer.current = window.setTimeout(() => {
      saveTimer.current = null;
      setTitleState((state) => state.value === nextTitle
        ? { ...state, status: saved ? "saved" : "save-error" }
        : state);
    }, 0);
  }

  return <main className="app-shell" dir="rtl">
    <header className="topbar">
      <div className="brand-mark">✦</div><div className="brand-copy"><strong>Smart Whiteboard</strong><span>مساحة أفكارك الذكية</span></div>
      <div className="document-title">
        <input aria-label="عنوان اللوحة" value={title} onChange={e=>handleTitleChange(e.target.value)} />
        <span className="title-save-status" data-save-status={titleStatus} role="status" aria-live="polite" aria-atomic="true" title={titleStatus === "changed-elsewhere" ? "تغيّر العنوان في تبويب آخر" : undefined}>
          <span className="saved-dot" aria-hidden="true" />
          <small>{titleStatusLabels[titleStatus]}</small>
        </span>
      </div>
      <div className="top-actions"><button className="icon-button" title={unavailableTitle("تراجع")} disabled><Undo2 size={18}/></button><button className="icon-button" title={unavailableTitle("إعادة")} disabled><Redo2 size={18}/></button><button className="secondary-button" title={unavailableTitle("تصدير")} disabled><Download size={16}/> تصدير</button><button className="primary-button" title={unavailableTitle("المساعد الذكي")} disabled><Sparkles size={16}/> مساعد ذكي</button></div>
    </header>
    <section className="workspace">
      <aside className="tool-rail" aria-label="أدوات اللوحة">
        {[[Pencil,"تحديد","select"],[Type,"نص","text"],[Shapes,"أشكال","shapes"],[Grid2X2,"شبكة","grid"],[Palette,"لون","color"],[BookOpen,"معادلة","math"]].map(([Icon,label,id]: any)=><button key={id} className={`tool-button${id === "text" && textTool ? " active" : ""}`} title={id === "text" ? "نص" : unavailableTitle(label)} disabled={id !== "text"} aria-pressed={id === "text" ? textTool : undefined} onClick={id === "text" ? () => setTextTool(value => !value) : undefined}><Icon size={19}/><span>{label}</span></button>)}
        <div className="rail-spacer"/><button className="tool-button" title={unavailableTitle("مساعدة")} disabled><HelpCircle size={19}/><span>مساعدة</span></button>
      </aside>
      <section className="canvas-area">
        <div className="canvas-toolbar"><div className="tool-context"><span className="context-label">الأداة</span><strong>{textTool ? "النص: انقر على مساحة فارغة للإضافة" : "اختر أداة النص للإضافة"}</strong></div><div className="format-controls"><label>اللون <input type="color" value={color} onChange={e=>setColor(e.target.value)} disabled title={unavailableTitle("اللون")}/></label><label>الحجم <input type="number" min="8" max="120" value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} disabled title={unavailableTitle("الحجم")}/></label></div></div>
        <Board textTool={textTool} activateText={() => setTextTool(true)} />
        <footer className="statusbar"><span>النص متاح؛ بقية الأدوات قيد التطوير</span><span className="status-right"><button disabled title={unavailableTitle("تصغير")}><ZoomOut size={15}/></button><span>{zoom}%</span><button disabled title={unavailableTitle("تكبير")}><ZoomIn size={15}/></button><span className="status-divider"/><span>لوحة 1</span></span></footer>
      </section>
    </section>
  </main>;
}
