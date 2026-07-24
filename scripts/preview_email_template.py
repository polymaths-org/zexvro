#!/usr/bin/env python3
"""Render ZEXVRO email templates to HTML for local preview + optional Brevo send.

  python3 scripts/preview_email_template.py
  python3 scripts/preview_email_template.py --send you@example.com
"""

from __future__ import annotations

import argparse
import os
import sys
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scratch_lambda"))
OUT = ROOT / "docs" / "email-previews"


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def main() -> int:
    load_dotenv(ROOT / ".env")
    # Prefer public console assets for logos in email clients
    os.environ.setdefault("MAIL_ASSET_BASE_URL", "https://console.zexvro.in")
    os.environ.setdefault("FRONTEND_URL", os.environ.get("FRONTEND_URL") or "https://console.zexvro.in")

    from email_templates import render_workspace_invite, render_generic

    parser = argparse.ArgumentParser()
    parser.add_argument("--send", metavar="EMAIL", help="Send invite preview via Brevo")
    parser.add_argument("--open", action="store_true", help="Open preview in browser")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)

    subject, html, text = render_workspace_invite(
        recipient_email="teammate@company.com",
        workspace_name="N4bi10p's Workspace",
        inviter_name="n4bi10p",
        role="Developer",
        accept_url="https://console.zexvro.in/invite/accept?token=example_token_preview",
        expires_label="2026-07-28 18:00 UTC",
    )
    invite_path = OUT / "workspace-invite.html"
    invite_path.write_text(html, encoding="utf-8")
    (OUT / "workspace-invite.txt").write_text(text, encoding="utf-8")

    _, generic_html, _ = render_generic(
        subject="ZEXVRO · Notification",
        eyebrow="Account notice",
        title="Something changed on your workspace",
        message_html="<p style='margin:0;color:#a1a1aa;'>This is the generic shell used for future system mails (audit alerts, credits, etc.).</p>",
        cta_label="Open console",
        cta_url="https://console.zexvro.in/dashboard",
        preheader="Workspace notification",
    )
    generic_path = OUT / "generic-notice.html"
    generic_path.write_text(generic_html, encoding="utf-8")

    print(f"subject: {subject}")
    print(f"wrote:   {invite_path}")
    print(f"wrote:   {generic_path}")
    base = os.environ.get("MAIL_ASSET_BASE_URL") or "https://console.zexvro.in"
    print(f"header:  {base}/brand/wordmark-transparent.png")
    print(f"footer:  {base}/brand/logo-transparent.png")

    if args.open:
        webbrowser.open(invite_path.as_uri())

    if args.send:
        from brevo_mail import send_email

        res = send_email(
            to=args.send,
            subject=subject + " [preview]",
            html=html,
            text=text,
            tags=["zexvro-invite-preview"],
        )
        print("sent:", res)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
