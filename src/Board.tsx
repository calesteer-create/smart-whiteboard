import { useEffect, useRef, useState } from "react";
import { BookOpen, Shapes, Sparkles, Type } from "lucide-react";
import { emptyBoard, type BoardDocument, type TextElement, type InkPoint, type InkElement } from "./boardModel";
import { loadBoard, saveBoard } from "./boardStorage";

type SaveStatus = "loading" | "ready" | "saving" | "saved" | "read-error" | "save-error";
const labels: Record<SaveStatus, string> = {
  loading: "جارٍ استعادة محتوى اللوحة…", ready: "اللوحة فارغة", saving: "جارٍ حفظ محتوى اللوحة…",
  saved: "محتوى اللوحة محفوظ محليًا", "read-error": "تعذّرت قراءة اللوحة؛ التعديلات في الذاكرة فقط ولن تُحفظ لتجنّب الكتابة فوق المحتوى السابق.",
  "save-error": "تعذّر حفظ محتوى اللوحة؛ التعديلات باقية في الذاكرة. أعد المحاولة.",
};

type Props = { textTool: boolean; activateText: () => void };
export default function Board({ textTool, activateText }: Props) {
  const [board, setBoard] = useState<BoardDocument>(emptyBoard);
  const boardRef = useRef(board);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const canSave = useRef(false);
  const mounted = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const revision = useRef(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const original = useRef<{ id: string; text: string; isNew: boolean } | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ pointerId: number; points: InkPoint[] } | null>(null);
  const [preview, setPreview] = useState<InkPoint[]>([]);
  const suppressClick = useRef(false);
  // Coordinates belong to the document, not the viewport. This is also the
  // single conversion point for a future zoom/pan transform.
  function point(event: React.PointerEvent): InkPoint {
    const rect = paperRef.current!.getBoundingClientRect();
    return { x: Math.max(0, event.clientX - rect.left), y: Math.max(0, event.clientY - rect.top), pressure: event.pressure > 0 ? event.pressure : 0.5 };
  }
  function finishStroke() {
    if (!stroke.current) return;
    const points = stroke.current.points;
    stroke.current = null; setPreview([]);
    if (points.length) {
      const ink: InkElement = { id: crypto.randomUUID(), type: "ink", points };
      update({ ...boardRef.current, elements: [...boardRef.current.elements, ink] });
    }
  }

  useEffect(() => {
    let active = true;
    mounted.current = true;
    loadBoard().then((loaded) => {
      if (!active) return;
      boardRef.current = loaded; setBoard(loaded); canSave.current = true;
      setStatus(loaded.elements.length ? "saved" : "ready");
    }).catch(() => { if (active) setStatus("read-error"); });
    return () => { active = false; mounted.current = false; };
  }, []);
  useEffect(() => { if (editing) editorRef.current?.focus(); }, [editing]);

  function persist(next: BoardDocument) {
    if (!canSave.current) return;
    const current = ++revision.current;
    setStatus("saving");
    // Serial writes prevent an earlier, slower transaction overwriting a later edit.
    queue.current = queue.current.catch(() => {}).then(() => saveBoard(next)).then(() => {
      if (mounted.current && current === revision.current) setStatus("saved");
    }, () => {
      if (mounted.current && current === revision.current) setStatus("save-error");
    });
  }
  function update(next: BoardDocument) {
    boardRef.current = next; setBoard(next); persist(next);
  }
  function updateText(id: string, text: string) {
    update({ ...boardRef.current, elements: boardRef.current.elements.map(item => item.id === id && item.type === "text" ? { ...item, text } : item) });
  }
  function startEditing(item: TextElement, isNew = false) {
    original.current = { id: item.id, text: item.text, isNew };
    setSelected(item.id); setEditing(item.id);
  }
  function finishEditing() { original.current = null; setEditing(null); }
  function cancelEditing() {
    const snapshot = original.current;
    if (!snapshot) return;
    if (snapshot.isNew) {
      update({ ...boardRef.current, elements: boardRef.current.elements.filter(item => item.id !== snapshot.id) });
      setSelected(null);
    } else updateText(snapshot.id, snapshot.text);
    finishEditing();
  }
  function addText(x: number, y: number) {
    const item: TextElement = { id: crypto.randomUUID(), type: "text", x, y, text: "" };
    update({ ...boardRef.current, elements: [...boardRef.current.elements, item] });
    startEditing(item, true);
  }
  function deleteSelected() {
    if (!selected || !window.confirm("هل تريد حذف العنصر النصي المحدد؟")) return;
    update({ ...boardRef.current, elements: boardRef.current.elements.filter(item => item.id !== selected) });
    setSelected(null); finishEditing();
  }
  return <>
    <div className="canvas-wrap"><div ref={paperRef} className="paper" data-testid="board-canvas"
      onPointerDown={event => {
        if (event.pointerType === "touch" && stroke.current) { event.preventDefault(); return; }
        if (event.pointerType !== "pen" || status === "loading" || stroke.current) return;
        // Do not begin ink over an existing editor or interactive control.
        if ((event.target as HTMLElement).closest("textarea,button")) return;
        event.preventDefault(); suppressClick.current = true;
        if (editing) finishEditing();
        const p = point(event); stroke.current = { pointerId: event.pointerId, points: [p] }; setPreview([p]);
        event.currentTarget.setPointerCapture?.(event.pointerId);
      }}
      onPointerMove={event => {
        if (!stroke.current || stroke.current.pointerId !== event.pointerId) return;
        const coalesced = event.nativeEvent.getCoalescedEvents?.();
        const samples = coalesced?.length ? coalesced : [event.nativeEvent];
        const rect = paperRef.current!.getBoundingClientRect();
        for (const sample of samples) stroke.current.points.push({ x: Math.max(0, sample.clientX - rect.left), y: Math.max(0, sample.clientY - rect.top), pressure: sample.pressure > 0 ? sample.pressure : 0.5 });
        setPreview([...stroke.current.points]);
      }}
      onPointerUp={event => { if (stroke.current?.pointerId === event.pointerId) { finishStroke(); window.setTimeout(() => { suppressClick.current = false; }, 0); } }}
      onPointerCancel={event => { if (stroke.current?.pointerId === event.pointerId) finishStroke(); }}
      onLostPointerCapture={event => { if (stroke.current?.pointerId === event.pointerId) finishStroke(); }}
      onClick={event => {
        if (suppressClick.current) { suppressClick.current = false; return; }
        if (event.target !== event.currentTarget || status === "loading") return;
        // الكتابة بالنقر مرتبطة بأداة النص؛ مع تعطيل الأداة لا ينشئ النقر على مساحة فارغة نصاً جديداً.
        if (!textTool) return;
        const rect = event.currentTarget.getBoundingClientRect();
        addText(Math.max(0, event.clientX - rect.left), Math.max(0, event.clientY - rect.top));
      }}>
      <svg className="ink-layer" aria-hidden="true">{[...board.elements.filter((e): e is InkElement => e.type === "ink").map(e => e.points), ...(preview.length ? [preview] : [])].map((points, i) => <g key={i}>{points.map((p, j) => j === 0 ? <circle key={j} cx={p.x} cy={p.y} r={Math.max(0.7, p.pressure * 2)} fill="#334155"/> : <line key={j} x1={points[j-1].x} y1={points[j-1].y} x2={p.x} y2={p.y} stroke="#334155" strokeLinecap="round" strokeWidth={Math.max(1.4, p.pressure * 4)}/>)}</g>)}</svg>
      {board.elements.length === 0 && !preview.length && <div className="welcome-card"><div className="welcome-icon"><Sparkles size={24}/></div><h1>كل فكرة تستحق مساحة</h1><p>انقر في أي مكان للكتابة، أو اكتب مباشرة بالقلم.</p><div className="starter-actions"><button disabled={status === "loading"} onClick={activateText}><Type size={16}/> أضف نصاً</button><button disabled title="اكتب معادلة — غير متاح حاليًا"><BookOpen size={16}/> اكتب معادلة</button><button disabled title="ارسم شكلاً — غير متاح حاليًا"><Shapes size={16}/> ارسم شكلاً</button></div><small>الأزرار المعطّلة غير مكتملة بعد.</small></div>}
      {board.elements.filter((item): item is TextElement => item.type === "text").map(item => <div className={`text-element${selected === item.id ? " selected" : ""}`} key={item.id} style={{ left: item.x, top: item.y }} onClick={event => event.stopPropagation()}>
        {editing === item.id ? <textarea ref={editorRef} aria-label="تحرير النص" dir="auto" value={item.text} onChange={event => updateText(item.id, event.target.value)} onBlur={finishEditing} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); cancelEditing(); }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finishEditing(); }
        }}/> : <button className="text-content" dir="auto" onClick={() => setSelected(item.id)} onDoubleClick={() => startEditing(item)} aria-label={`تحديد النص: ${item.text || "نص فارغ"}`}>{item.text || "نص فارغ"}</button>}
        {selected === item.id && editing !== item.id && <div className="element-actions"><button onClick={() => startEditing(item)}>تحرير</button><button onClick={deleteSelected}>حذف</button></div>}
      </div>)}
    </div></div>
    <div className="board-feedback"><span role="status" aria-live="polite" data-board-status={status}>{labels[status]}</span>{status === "save-error" && <button onClick={() => persist(boardRef.current)}>إعادة محاولة الحفظ</button>}<span>انقر للكتابة أو استخدم القلم. حدّد النص لتحريره أو حذفه. أنهِ التحرير بالنقر خارج النص أو Ctrl+Enter؛ يلغي Esc التغييرات.</span></div>
  </>;
}
