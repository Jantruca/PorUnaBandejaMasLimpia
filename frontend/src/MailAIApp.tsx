import React, { useEffect, useMemo, useState, Suspense } from "react";

// --- Carga perezosa compatible de react-markdown (evita crasheos por ESM) ---
const MarkdownLazy = React.lazy(() =>
  import("react-markdown").then((m: any) => ({ default: m.default ?? m }))
);

// --- ErrorBoundary simple para que un fallo en Markdown no tumbe la app ---
class MarkdownBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return <>{this.props.children}</>;
    return this.props.children as any;
  }
}

function Markdown({ content }: { content: string }) {
  return (
    <MarkdownBoundary>
      <Suspense fallback={<div className="content-summary">{content}</div>}>
        <MarkdownLazy>{content}</MarkdownLazy>
      </Suspense>
    </MarkdownBoundary>
  );
}

// =====================
// Tipos
// =====================
type Email = {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  date: string; // ISO
};

type Category = {
  id: string;
  name: string;
  summary: string;
  emails: Email[];
};

export type MailData = {
  categories: Category[];
};

// =====================
// Config
// =====================
// Ojo: si tu app sirve en https y estas URLs son http => mixed content.
// Usa proxy en dev o sirve también https en el backend. Revisa CORS.
const EMAILS_URL = "http://10.95.228.226:8000/emails";   // POST
const ANALYSE_URL = "http://10.95.228.226:8000/analyse"; // GET

// Solo la categoría GENERAL es fija inicialmente
const MOCK_DATA: MailData = {
  categories: [
    {
      id: "general",
      name: "General",
      summary: "Correos generales cargados desde backend.",
      emails: [],
    },
  ],
};

// =====================
// Tipos del backend
// =====================
type BackendEmail = {
  id: number;
  threadId: string;
  snippet: string;
  body: string;
  subject: string;
  sender: string;
  date?: string | null;
};

type EmailsPayload = {
  emails: BackendEmail[];
};

type AnalyseCategoryBlock = {
  global_summary?: string;
  emails?: BackendEmail[];
  email_count?: number;
};

type AnalysePayload = {
  analysis: Record<string, AnalyseCategoryBlock>;
};

// =====================
// Utilidades
// =====================
function safeTrim(s?: string | null): string {
  return (s ?? "").trim();
}

// Decodifica MIME encoded-words en subjects tipo =?UTF-8?B?...?=
function decodeMimeWord(input: string): string {
  try {
    const rx = /=\?([^?]+)\?([QBqb])\?([^?]+)\?=/g;
    return input.replace(rx, (_: any, charset: string, enc: string, data: string) => {
      const norm = String(charset).toLowerCase();
      const bytes =
        String(enc).toUpperCase() === "B"
          ? Uint8Array.from(atob(data.replace(/\s+/g, "")), c => c.charCodeAt(0))
          : new TextEncoder().encode(
              data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_m, h) =>
                String.fromCharCode(parseInt(h, 16))
              )
            );
      try {
        return new TextDecoder(norm as any).decode(bytes);
      } catch {
        return new TextDecoder("utf-8").decode(bytes);
      }
    });
  } catch {
    return input;
  }
}

function normalizeSender(sender: string): string {
  const s = safeTrim(sender);
  if (!s) return "Desconocido";
  return s.replace(/^"|"$/g, "");
}

function formatDate(dateISO: string) {
  try {
    const d = new Date(dateISO);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return "—";
  }
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

// Mapea emails del backend a tu tipo Email
function mapBackendEmails(items: BackendEmail[]): Email[] {
  const nowISO = new Date().toISOString();
  return (items || [])
    .map((e) => {
      const subject = safeTrim(e.subject);
      const decodedSubject = subject ? decodeMimeWord(subject) : "(Sin asunto)";
      const snippet = safeTrim(e.snippet) || safeTrim(e.body) || "(Sin contenido)";
      const date = safeTrim(e.date || "") || nowISO;
      return {
        id: `g-${String(e.id)}`,
        subject: decodedSubject || "(Sin asunto)",
        sender: normalizeSender(e.sender || "Desconocido"),
        snippet,
        date,
      } as Email;
    })
    .sort((a, b) => {
      const ta = Date.parse(a.date);
      const tb = Date.parse(b.date);
      if (!isNaN(ta) && !isNaN(tb)) return tb - ta;
      return parseInt(b.id.slice(2)) - parseInt(a.id.slice(2));
    });
}

// Convierte el JSON de /analyse a categorías dinámicas
function mapAnalyseToCategories(payload: AnalysePayload): Category[] {
  const blocks = payload?.analysis || {};
  const result: Category[] = [];
  for (const [name, block] of Object.entries(blocks)) {
    const emails = mapBackendEmails(block.emails || []);
    result.push({
      id: slugify(name) || `cat-${result.length + 1}`,
      name,
      summary: safeTrim(block.global_summary) || "",
      emails,
    });
  }
  // Orden opcional: más correos primero
  return result.sort((a, b) => b.emails.length - a.emails.length);
}

// =====================
// UI
// =====================
function Sidebar({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">Categorías</div>
      <nav className="sidebar-nav">
        {categories.map((c) => {
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`sidebar-item ${active ? "is-active" : ""}`}
            >
              <div className="sidebar-item-row">
                <span className="sidebar-item-name">{c.name}</span>
                <span className="sidebar-item-count">{c.emails.length}</span>
              </div>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function EmailList({
  emails,
  onOpen,
}: {
  emails: Email[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul className="email-list">
      {emails.map((e) => (
        <li key={e.id}>
          <button className="email-list-item" onClick={() => onOpen(e.id)}>
            <div className="email-list-main">
              <div className="email-list-subject">{e.subject}</div>
              <div className="email-list-sender">{e.sender}</div>
            </div>
            <div className="email-list-date">{formatDate(e.date)}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function EmailDetail({ email, onBack }: { email: Email; onBack: () => void }) {
  return (
    <div className="email-detail">
      <button className="back-btn" onClick={onBack}>
        ← Volver a la lista
      </button>
      <h2 className="email-detail-subject">{email.subject}</h2>
      <div className="email-detail-meta">
        <span>{email.sender}</span> · <span>{formatDate(email.date)}</span>
      </div>
      <div className="email-detail-body">{email.snippet || "Sin contenido"}</div>
    </div>
  );
}

function CategoryContent({
  category,
  isLoading,
  error,
  onAnalyse,
}: {
  category: Category;
  isLoading?: boolean;
  error?: string | null;
  onAnalyse?: () => void;
}) {
  const [openedEmailId, setOpenedEmailId] = useState<string | null>(null);
  const opened = category.emails.find((e) => e.id === openedEmailId) || null;

  return (
    <section className="content">
      {!opened ? (
        <>
          <header className="content-header">
            <h1>{category.name}</h1>

            {category.id === "general" && (
              <button onClick={onAnalyse} className="analyse-btn">
                ANALIZAR MEDIANTE IA
              </button>
            )}

            {category.id !== "general" && category.summary && (
              <div className="content-summary">
                <Markdown content={category.summary} />
              </div>
            )}
          </header>

          {isLoading && <div className="loading">Cargando correos...</div>}
          {error && <div className="error">No se pudieron cargar los correos: {error}</div>}

          <EmailList emails={category.emails} onOpen={setOpenedEmailId} />
        </>
      ) : (
        <EmailDetail email={opened} onBack={() => setOpenedEmailId(null)} />
      )}
    </section>
  );
}

// =====================
// Componente principal
// =====================
export default function MailAIApp({ data = MOCK_DATA }: { data?: MailData }) {
  const [dataState, setDataState] = useState<MailData>(data);
  const categories = dataState.categories || [];

  const [selectedId, setSelectedId] = useState<string>(categories[0]?.id ?? "");

  const [loadingGeneral, setLoadingGeneral] = useState<boolean>(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const [loadingAnalyse, setLoadingAnalyse] = useState<boolean>(false);
  const [errorAnalyse, setErrorAnalyse] = useState<string | null>(null);

  // Cargar "General" al entrar
  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function loadGeneral() {
      try {
        setLoadingGeneral(true);
        setErrorGeneral(null);

        const res = await fetch(EMAILS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: ac.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as EmailsPayload;
        const mapped = mapBackendEmails(json?.emails || []);

        if (!cancelled) {
          setDataState((prev) => ({
            ...prev,
            categories: (prev.categories || []).map((c) =>
              c.id === "general" ? { ...c, emails: mapped } : c
            ),
          }));
        }
      } catch (err: any) {
        if (!cancelled) setErrorGeneral(err?.message || "Error desconocido");
      } finally {
        if (!cancelled) setLoadingGeneral(false);
      }
    }

    loadGeneral();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  // Botón "ANALIZAR MEDIANTE IA" -> GET /analyse y crear categorías dinámicas
  async function handleAnalyse() {
    try {
      setLoadingAnalyse(true);
      setErrorAnalyse(null);

      const res = await fetch(ANALYSE_URL, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = (await res.json()) as AnalysePayload;
      const dynCats = mapAnalyseToCategories(json);

      setDataState((prev) => {
        const general =
          (prev.categories || []).find((c) => c.id === "general") ||
          MOCK_DATA.categories[0];
        return { ...prev, categories: [general, ...dynCats] };
      });
    } catch (err: any) {
      setErrorAnalyse(err?.message || "Error desconocido");
    } finally {
      setLoadingAnalyse(false);
    }
  }

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedId) || categories[0],
    [categories, selectedId]
  );

  if (!categories.length) {
    return <div className="empty">No hay categorías para mostrar.</div>;
  }

  const isGeneral = selectedCategory?.id === "general";

  return (
    <div className="app">
      <Sidebar
        categories={categories}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      {selectedCategory ? (
        <CategoryContent
          category={selectedCategory}
          isLoading={isGeneral ? loadingGeneral : loadingAnalyse}
          error={isGeneral ? errorGeneral : errorAnalyse}
          onAnalyse={isGeneral ? handleAnalyse : undefined}
        />
      ) : (
        <section className="content">
          <header className="content-header">
            <h1>Selecciona una categoría</h1>
          </header>
        </section>
      )}
    </div>
  );
}

/* =====================
   Estilos mínimos sugeridos (opcional)
   =====================
.app { display: grid; grid-template-columns: 280px 1fr; height: 100vh; font-family: system-ui, sans-serif; }
.sidebar { border-right: 1px solid #eee; padding: 16px; overflow: auto; }
.sidebar-title { font-weight: 600; margin-bottom: 8px; }
.sidebar-item { width: 100%; text-align: left; padding: 10px; border-radius: 8px; }
.sidebar-item.is-active { background: #f3f4f6; }
.sidebar-item-row { display:flex; justify-content: space-between; gap: 8px; }
.content { overflow: auto; }
.content-header { padding: 16px; border-bottom: 1px solid #eee; display:flex; align-items:center; gap:12px; }
.analyse-btn { padding: 8px 12px; border: 1px solid #111; border-radius: 8px; cursor: pointer; background: #111; color: #fff; }
.email-list { list-style: none; margin: 0; padding: 0; }
.email-list-item { width: 100%; padding: 12px; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f1f1; }
.email-detail { padding: 16px; }
.loading { padding: 12px; opacity: 0.8; }
.error { padding: 12px; color: #b00020; }
.content-summary :where(h1,h2,h3){ margin: 0.5rem 0; }
*/