import React, { useMemo, useState } from "react";

// --- Types ---
type Email = {
  id: string;
  subject: string;
  sender: string;
  snippet: string; // lo usamos como cuerpo de ejemplo
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

// --- Mock JSON (puedes reemplazarlo por tu JSON real) ---
const MOCK_DATA: MailData = {
  categories: [
    {
      id: "general",
      name: "General",
      summary:
        "Resumen semanal: 12 correos generales. Acciones pendientes: responder a 2, archivar 3.",
      emails: [
        {
          id: "g-1",
          subject: "Bienvenido a la plataforma",
          sender: "Equipo Soporte <soporte@example.com>",
          snippet:
            "Gracias por registrarte. Aquí tienes algunos pasos para comenzar...",
          date: "2025-09-18T10:24:00Z",
        },
        {
          id: "g-2",
          subject: "Factura de septiembre",
          sender: "Facturación <billing@example.com>",
          snippet:
            "Adjuntamos tu factura correspondiente al período 01-30 de septiembre...",
          date: "2025-09-21T08:14:00Z",
        },
      ],
    },
    {
      id: "ventas",
      name: "Ventas",
      summary:
        "Resumen semanal: 5 oportunidades nuevas. 2 cerradas ganadas, 1 en negociación.",
      emails: [
        {
          id: "v-1",
          subject: "Propuesta actualizada para Acme",
          sender: "Laura (Ventas) <laura@example.com>",
          snippet:
            "He subido la propuesta con el nuevo pricing y condiciones...",
          date: "2025-09-20T16:02:00Z",
        },
        {
          id: "v-2",
          subject: "Reunión con Contoso confirmada",
          sender: "Calendario <noreply@calendar.example.com>",
          snippet: "Evento confirmado para el martes a las 10:00 (CET)...",
          date: "2025-09-22T09:30:00Z",
        },
        {
          id: "v-3",
          subject: "Cierre Q3 — resultados",
          sender: "Dirección Comercial <dc@example.com>",
          snippet: "¡Buen trabajo! En Q3 alcanzamos el 112% del objetivo...",
          date: "2025-09-23T17:45:00Z",
        },
      ],
    },
    {
      id: "soporte",
      name: "Soporte",
      summary:
        "Resumen semanal: 8 tickets resueltos. SLA medio 3h. 1 ticket en espera del cliente.",
      emails: [
        {
          id: "s-1",
          subject: "[Ticket #1432] Error 500 al subir archivos",
          sender: "Cliente XYZ <it@xyz.co>",
          snippet: "Cuando intentamos subir un CSV grande, recibimos un 500...",
          date: "2025-09-24T11:11:00Z",
        },
        {
          id: "s-2",
          subject: "[Ticket #1433] Recuperación de contraseña",
          sender: "Cliente ABC <ops@abc.com>",
          snippet:
            "Un usuario no recibe el email de reset. ¿Podéis revisar el log?...",
          date: "2025-09-24T14:52:00Z",
        },
      ],
    },
  ],
};

// --- Utilidades ---
function formatDate(dateISO: string) {
  try {
    const d = new Date(dateISO);
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return dateISO;
  }
}

// --- UI ---
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
              {/* Comentado: si quisieras ver el resumen aquí, descomenta */}
              {/* <div className="sidebar-item-summary">{c.summary}</div> */}
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
      <div className="email-detail-body">
        {email.snippet || "Sin contenido"}
      </div>
    </div>
  );
}

function CategoryContent({ category }: { category: Category }) {
  // No mostramos el resumen por defecto
  const [openedEmailId, setOpenedEmailId] = useState<string | null>(null);

  const opened = category.emails.find((e) => e.id === openedEmailId) || null;

  return (
    <section className="content">
      {!opened ? (
        <>
          <header className="content-header">
            <h1>{category.name}</h1>
            {category.id !== "general" && (
              <p className="content-summary">{category.summary}</p>
            )}
            {/* Si quisieras mostrar un botón para ver el resumen: */}
            {/* <p className="content-summary">{category.summary}</p> */}
          </header>
          <EmailList emails={category.emails} onOpen={setOpenedEmailId} />
        </>
      ) : (
        <EmailDetail email={opened} onBack={() => setOpenedEmailId(null)} />
      )}
    </section>
  );
}

// --- Componente principal ---
export default function MailAIApp({ data = MOCK_DATA }: { data?: MailData }) {
  const categories = data.categories || [];
  const [selectedId, setSelectedId] = useState<string>(categories[0]?.id ?? "");

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
        <CategoryContent category={selectedCategory} />
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
