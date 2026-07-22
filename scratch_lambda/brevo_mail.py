"""
ZEXVRO mail sender via Brevo (Sendinblue) Transactional API.

Env (server-side only — never commit real keys):
  BREVO_API_KEY          required for live send
  BREVO_SENDER_EMAIL     verified sender in Brevo (default: noreply@zexvro.in)
  BREVO_SENDER_NAME      default: ZEXVRO
  MAIL_PROVIDER          brevo | console (default: brevo if key set, else console)

Usage:
  from brevo_mail import send_email, MailError
  send_email(to="user@example.com", subject="…", html="<p>…</p>")
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional

BREVO_SMTP_URL = "https://api.brevo.com/v3/smtp/email"


class MailError(Exception):
    def __init__(self, message: str, status: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status = status
        self.body = body


def _provider() -> str:
    explicit = (os.environ.get("MAIL_PROVIDER") or "").strip().lower()
    if explicit in ("brevo", "console", "ses"):
        return explicit
    if (os.environ.get("BREVO_API_KEY") or "").strip():
        return "brevo"
    return "console"


def sender_identity() -> tuple[str, str]:
    # Prefer verified @zexvro.in sender (domain authenticated in Brevo).
    email = (
        os.environ.get("BREVO_SENDER_EMAIL")
        or os.environ.get("INVITE_SOURCE_EMAIL")
        or "noreply@zexvro.in"
    ).strip()
    name = (os.environ.get("BREVO_SENDER_NAME") or "ZEXVRO").strip() or "ZEXVRO"
    return name, email


def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str] = None,
    reply_to: Optional[str] = None,
    tags: Optional[list[str]] = None,
) -> dict[str, Any]:
    """
    Send one transactional email.
    Returns provider payload, e.g. {"provider": "brevo", "messageId": "…"}.
    """
    to = (to or "").strip()
    if not to or "@" not in to:
        raise MailError("valid recipient email is required")

    provider = _provider()
    if provider == "console":
        print(
            json.dumps(
                {
                    "mail": "console",
                    "to": to,
                    "subject": subject,
                    "html_chars": len(html or ""),
                }
            )
        )
        return {"provider": "console", "messageId": f"console-{to}", "to": to}

    if provider == "brevo":
        return _send_brevo(
            to=to,
            subject=subject,
            html=html,
            text=text,
            reply_to=reply_to,
            tags=tags,
        )

    raise MailError(f"unsupported MAIL_PROVIDER={provider}")


def _send_brevo(
    *,
    to: str,
    subject: str,
    html: str,
    text: Optional[str],
    reply_to: Optional[str],
    tags: Optional[list[str]],
) -> dict[str, Any]:
    api_key = (os.environ.get("BREVO_API_KEY") or "").strip()
    if not api_key:
        raise MailError("BREVO_API_KEY is not configured")

    sender_name, sender_email = sender_identity()
    payload: dict[str, Any] = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text
    if reply_to:
        payload["replyTo"] = {"email": reply_to}
    if tags:
        payload["tags"] = tags[:10]

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        BREVO_SMTP_URL,
        data=data,
        method="POST",
        headers={
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": api_key,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8") or "{}"
            body = json.loads(raw) if raw.strip() else {}
            message_id = body.get("messageId") or body.get("message_id")
            return {
                "provider": "brevo",
                "messageId": message_id,
                "status": getattr(resp, "status", 201),
                "to": to,
            }
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode("utf-8", errors="replace")
        raise MailError(
            f"Brevo send failed ({exc.code}): {err_body[:400]}",
            status=exc.code,
            body=err_body,
        ) from exc
    except urllib.error.URLError as exc:
        raise MailError(f"Brevo network error: {exc.reason}") from exc
