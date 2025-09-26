from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from langchain_google_community import GmailToolkit
import os

# Scope solo lectura
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


def get_oauth_credentials():
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
            creds = flow.run_local_server(port=8080)  # puedes cambiar a run_console()
        with open("token.json", "w") as token:
            token.write(creds.to_json())
    return creds


# 1. Saca credenciales vía OAuth
credentials = get_oauth_credentials()

# 2. Construye api_resource con discovery
api_resource = build("gmail", "v1", credentials=credentials)

# 3. Pásalo al GmailToolkit
toolkit = GmailToolkit(api_resource=api_resource)


def read_gmail(n: int):
    tools = toolkit.get_tools()
    search_messages = tools[2]

    result = search_messages.invoke(
        {
            "query": "in:inbox",
            "resource": "messages",
            "max_results": n,
        }
    )

    return result
