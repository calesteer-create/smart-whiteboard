import { useEffect, useRef, useState } from "react";
import { BookOpen, Shapes, Sparkles, Type } from "lucide-react";
import { emptyBoard, type BoardDocument, type TextElement } from "./boardModel";
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
    update({ ...boardRef.current, elements: boardRef.current.elements.map(item => item.id === id ? { ...item, text } : item) });
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
    <div className="canvas-wrap"><div className={`paper${textTool ? " text-tool-active" : ""}`} data-testid="board-canvas" onClick={event => {
      if (event.target !== event.currentTarget || status === "loading") return;
      if (textTool) {
        const rect = event.currentTarget.getBoundingClientRect();
        addText(Math.max(0, Math.min(event.clientX - rect.left, Math.max(0, rect.width - 225))), Math.max(0, event.clientY - rect.top));
      } else setSelected(null);
    }}>
      {board.elements.length === 0 && <div className="welcome-card"><div className="welcome-icon"><Sparkles size={24}/></div><h1>كل فكرة تستحق مساحة</h1><p>أضف نصًا إلى اللوحة، أما الرسم والمعادلات فستتوفر لاحقًا.</p><div className="starter-actions"><button disabled={status === "loading"} onClick={activateText}><Type size={16}/> أضف نصاً</button><button disabled title="اكتب معادلة — غير متاح حاليًا"><BookOpen size={16}/> اكتب معادلة</button><button disabled title="ارسم شكلاً — غير متاح حاليًا"><Shapes size={16}/> ارسم شكلاً</button></div><small>{textTool ? "انقر على مساحة فارغة في اللوحة لإضافة نص." : "الأزرار المعطّلة غير مكتملة بعد."}</small></div>}
      {board.elements.map(item => <div className={`text-element${selected === item.id ? " selected" : ""}`} key={item.id} style={{ left: item.x, top: item.y }} onClick={event => event.stopPropagation()}>
        {editing === item.id ? <textarea ref={editorRef} aria-label="تحرير النص" dir="auto" value={item.text} onChange={event => updateText(item.id, event.target.value)} onBlur={finishEditing} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Escape") { event.preventDefault(); cancelEditing(); }
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); finishEditing(); }
        }}/> : <button className="text-content" dir="auto" onClick={() => setSelected(item.id)} onDoubleClick={() => startEditing(item)} aria-label={`تحديد النص: ${item.text || "نص فارغ"}`}>{item.text || "نص فارغ"}</button>}
        {selected === item.id && editing !== item.id && <div className="element-actions"><button onClick={() => startEditing(item)}>تحرير</button><button onClick={deleteSelected}>حذف</button></div>}
      </div>)}
    </div></div>
    <div className="board-feedback"><span role="status" aria-live="polite" data-board-status={status}>{labels[status]}</span>{status === "save-error" && <button onClick={() => persist(boardRef.current)}>إعادة محاولة الحفظ</button>}<span>اختر النص لتحريره أو حذفه. أنهِ التحرير بالنقر خارج النص أو Ctrl+Enter؛ يلغي Esc التغييرات.</span></div>
  </>;
}
