import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

// =====================
// Tipos
// =====================
type Email = {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  date: string;
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
const EMAILS_URL = "http://10.95.228.226:8000/emails";
const ANALYSE_URL = "http://10.95.228.226:8000/analyse";

const MOCK_DATA: MailData = {
  categories: [
    {
      id: "general",
      name: "General",
      summary: "Resumen semanal: correos generales cargados desde backend.",
      emails: [],
    },
  ],
};

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

function safeTrim(s?: string | null): string {
  return (s ?? "").trim();
}

function decodeMimeWord(input: string): string {
  try {
    const rx = /=\?([^?]+)\?([QBqb])\?([^?]+)\?=/g;
    return input.replace(rx, (_, charset, enc, data) => {
      const norm = String(charset).toLowerCase();
      const bytes =
        String(enc).toUpperCase() === "B"
          ? Uint8Array.from(atob(data.replace(/\s+/g, "")), c => c.charCodeAt(0))
          : new TextEncoder().encode(
              data.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
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
  return result.sort((a, b) => b.emails.length - a.emails.length);
}

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
              <ReactMarkdown className="content-summary">{category.summary}</ReactMarkdown>
            )}
          </header>

          {category.id === "general" && isLoading && (
            <div className="loading">Cargando correos...</div>
          )}
          {category.id === "general" && error && (
            <div className="error">No se pudieron cargar los correos: {error}</div>
          )}

          <EmailList emails={category.emails} onOpen={setOpenedEmailId} />
        </>
      ) : (
        <EmailDetail email={opened} onBack={() => setOpenedEmailId(null)} />
      )}
    </section>
  );
}

export default function MailAIApp({ data = MOCK_DATA }: { data?: MailData }) {
  const [dataState, setDataState] = useState<MailData>(data);
  const categories = dataState.categories || [];

  const [selectedId, setSelectedId] = useState<string>(categories[0]?.id ?? "");

  const [loadingGeneral, setLoadingGeneral] = useState<boolean>(false);
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);

  const [loadingAnalyse, setLoadingAnalyse] = useState<boolean>(false);
  const [errorAnalyse, setErrorAnalyse] = useState<string | null>(null);

  useEffect(() => {
    const ac1 = new AbortController();
    let cancelled = false;

    async function loadGeneral() {
      try {
        setLoadingGeneral(true);
        setErrorGeneral(null);
        const res = await fetch(EMAILS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
          signal: ac1.signal,
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
      ac1.abort();
    };
  }, []);

  async function handleAnalyse() {
    try {
      setLoadingAnalyse(true);
      setErrorAnalyse(null);
      const res = await fetch(ANALYSE_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnalysePayload;
      const dynCats = mapAnalyseToCategories(json);
      setDataState((prev) => {
        const general = (prev.categories || []).find((c) => c.id === "general") || MOCK_DATA.categories[0];
        return {
          ...prev,
          categories: [general, ...dynCats],
        };
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
          isLoading={selectedCategory.id === "general" ? loadingGeneral : loadingAnalyse}
          error={selectedCategory.id === "general" ? errorGeneral : errorAnalyse}
          onAnalyse={handleAnalyse}
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
