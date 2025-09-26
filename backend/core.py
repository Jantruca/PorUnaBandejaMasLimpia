# flake8: noqa
from rich import inspect
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage
from rich.pretty import pprint
from typing import TypedDict
from rich.console import Console
from mails import read_gmail


class EmailSummary(TypedDict):
    category: str = Field(description="La categoría del correo electrónico")
    ids: list[int] = Field(
        description="Lista de IDs de correos electrónicos en esta categoría"
    )
    summary: str = Field(
        description="El resumen de al menos 20 lineas (de los correos de esta categoria) usando markdown de los correos electrónicos. Asegurate de para categoria poner un titulo y al menos 4 sub secciones informativas"
    )


class EmailCategories(BaseModel):
    summaries: list[EmailSummary] = Field(
        description="Una lista de categorías de correos electrónicos y sus resúmenes"
    )


CATEGORIZER_PROMPT = """
Eres un asistente que clasifica correos electrónicos en categorías específicas en español.
Por favor genera entre 3 y 6 categorías relevantes donde cada categoría sea una palabra o una frase corta.
Para los resumenes:

Genera un **resumen semanal de las categorias de los correos** y preséntalo usando **Markdown**.  

El resumen debe:
- Explicar de forma **bonita, larga y visual** los puntos principales de cada correo.  
- Resaltar cualquier tema **muy relevante**, indicando en qué correo específico aparece para que el usuario lo lea en detalle.  
- Marcar estos correos relevantes de manera visible en Markdown (por ejemplo, con **⚠️ Importante** o resaltado especial) para que el usuario pueda identificarlos.  
- Es importante que el resumen tenga al menos 20 lineas.
- Incluye en los resumenes, un titulo y al menos 4 sub secciones informativas.
- Usa muchas listas, emojis, negritas y titulos (markdown), links o hipervinculos, etc para que el resumen sea facil de leer y visualmente atractivo.
- Como minimo obligatorio una lista por descripción de categoria o bien usar emojis, o bien usar ``` para hacer cajas o notas! OBLIGATORIO AL MENOS UNA DE ESTAS.
- OBLIGATORIO EN AL MENOS LA MITAD DE CATEGORIAS HACER UNA TABLA O LISTA DE PUNTOS!
- No hagas referencias a los ids de los correos, en su lugar di: el primer, el septimo, el ultimo correo, etc.
"""


class EmailSummarizer:

    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.7)
        self.categorizer_prompt = ChatPromptTemplate.from_messages(
            [SystemMessage(content=CATEGORIZER_PROMPT), ("human", "{input}")]
        )
        self.categorizer = self.categorizer_prompt | self.llm.with_structured_output(
            EmailCategories
        )

    def invoke(self, emails: list[dict]) -> EmailCategories:
        return self.categorizer.invoke({"input": str(emails)})


def resolve_from_response(emails: list[dict], response: EmailCategories) -> list[dict]:
    categorized_emails = {}
    for summary in response.summaries:
        category = summary["category"]
        ids = summary["ids"]
        categorized_emails[category] = {}
        categorized_emails[category]["global_summary"] = summary["summary"]
        categorized_emails[category]["emails"] = [
            email for email in emails if email["id"] in ids
        ]
        categorized_emails[category]["email_count"] = len(
            categorized_emails[category]["emails"]
        )

    return categorized_emails


def get_emails():

    console = Console()
    with console.status("[bold green]Reading emails...[/]", spinner="dots"):
        emails = read_gmail(20)
        for idx, e in enumerate(emails):
            e["id"] = idx
        inspect(emails)
    return emails


def analyse_emails(emails: list[dict]):
    console = Console()
    with console.status("[bold green]Processing...[/]", spinner="dots"):
        summarizer = EmailSummarizer()
        result = summarizer.invoke(emails)
        resolved_emails = resolve_from_response(emails, result)
    pprint(resolved_emails, max_length=None)
    return resolved_emails
