"""
ZEXVRO transactional email templates.

Brand (from assets/brand + design.md):
  - Black canvas, white geometric node mark + futuristic wordmark
  - Tagline: UNIFIED WEB3 PAAS
  - Footer uses typo-logo wordmark image
  - High contrast, minimal, professional — not crypto-neon

Emails are table-based for client compatibility. Logo loads from MAIL_ASSET_BASE
(HTTPS). Layout remains readable if images are blocked.
"""

from __future__ import annotations

import html
import os
from typing import Optional


def asset_base() -> str:
    return (
        os.environ.get("MAIL_ASSET_BASE_URL")
        or os.environ.get("FRONTEND_URL")
        or "https://console.zexvro.in"
    ).rstrip("/")


def header_wordmark_url() -> str:
    """Top header: landing wordmark-transparent.png (centered)."""
    custom = (os.environ.get("MAIL_HEADER_WORDMARK_URL") or os.environ.get("MAIL_WORDMARK_URL") or "").strip()
    if custom:
        return custom
    return f"{asset_base()}/brand/wordmark-transparent.png"


def footer_mark_url() -> str:
    """Bottom footer: landing logo-transparent.png (node mark)."""
    custom = (os.environ.get("MAIL_FOOTER_LOGO_URL") or os.environ.get("MAIL_LOGO_URL") or "").strip()
    if custom:
        return custom
    return f"{asset_base()}/brand/logo-transparent.png"


def _esc(value: str) -> str:
    return html.escape(value or "", quote=True)


def render_layout(
    *,
    preheader: str,
    eyebrow: str,
    title: str,
    body_html: str,
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    secondary_html: str = "",
    footer_note: str = "",
) -> str:
    """Full HTML document — dark brand shell."""
    pre = _esc(preheader)
    eye = _esc(eyebrow)
    tit = _esc(title)
    cta_l = _esc(cta_label or "")
    cta_u = _esc(cta_url or "")
    header_mark = _esc(header_wordmark_url())
    footer_mark = _esc(footer_mark_url())
    foot = footer_note or "You received this because of activity on your ZEXVRO workspace."
    foot = _esc(foot)

    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
              <tr>
                <td style="padding:8px 0 28px 0;" align="left">
                  <a href="{cta_u}"
                     style="display:inline-block;background:#ffffff;color:#000000;
                            font-family:Inter,Helvetica,Arial,sans-serif;
                            font-size:13px;font-weight:600;letter-spacing:0.04em;
                            text-decoration:none;padding:14px 22px;border-radius:6px;">
                    {cta_l}
                  </a>
                </td>
              </tr>"""

    secondary_block = ""
    if secondary_html:
        secondary_block = f"""
              <tr>
                <td style="padding:0 0 8px 0;font-family:Inter,Helvetica,Arial,sans-serif;
                           font-size:12px;line-height:1.55;color:#a1a1aa;">
                  {secondary_html}
                </td>
              </tr>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>{tit}</title>
  <!--[if mso]><style>body,table,td{{font-family:Arial,sans-serif!important}}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#050505;color:#fafafa;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    {pre}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:#050505;margin:0;padding:0;width:100%;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:560px;background:#0a0a0b;border:1px solid #27272a;border-radius:12px;">
          <!-- Header / centered wordmark -->
          <tr>
            <td style="padding:28px 32px 22px 32px;border-bottom:1px solid #18181b;" align="center">
              <img src="{header_mark}" width="220" height="40" alt="ZEXVRO"
                   style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;outline:none;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px 8px 32px;" align="left">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:0 0 10px 0;font-family:Inter,Helvetica,Arial,sans-serif;
                             font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;">
                    {eye}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px 0;font-family:Inter,Helvetica,Arial,sans-serif;
                             font-size:22px;font-weight:600;line-height:1.25;color:#fafafa;letter-spacing:-0.02em;">
                    {tit}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 20px 0;font-family:Inter,Helvetica,Arial,sans-serif;
                             font-size:14px;line-height:1.65;color:#a1a1aa;">
                    {body_html}
                  </td>
                </tr>
                {cta_block}
                {secondary_block}
              </table>
            </td>
          </tr>
          <!-- Footer node mark (logo-transparent) -->
          <tr>
            <td style="padding:8px 32px 28px 32px;" align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-top:1px solid #18181b;">
                <tr>
                  <td style="padding:24px 0 0 0;" align="center">
                    <img src="{footer_mark}" width="56" height="56" alt="ZEXVRO"
                         style="display:block;margin:0 auto;width:56px;height:56px;border:0;outline:none;" />
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px 24px 32px;border-top:1px solid #18181b;
                       font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.5;color:#52525b;"
                align="left">
              <p style="margin:0 0 6px 0;">{foot}</p>
              <p style="margin:0;">
                <a href="{_esc(asset_base())}" style="color:#a1a1aa;text-decoration:none;">zexvro.in</a>
                &nbsp;·&nbsp;
                <span style="color:#3f3f46;">Do not share secrets in email</span>
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"
               style="width:100%;max-width:560px;">
          <tr>
            <td style="padding:16px 8px 0 8px;font-family:Inter,Helvetica,Arial,sans-serif;
                       font-size:10px;color:#3f3f46;text-align:center;">
              © ZEXVRO · Unified Web3 PaaS
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""


def _detail_row(label: str, value: str, mono: bool = False) -> str:
    val_style = (
        "font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;"
        if mono
        else "font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;font-weight:500;"
    )
    return f"""
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #18181b;
                   font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#71717a;width:38%;">
          {_esc(label)}
        </td>
        <td style="padding:10px 0;border-bottom:1px solid #18181b;{val_style}color:#e4e4e7;text-align:right;">
          {_esc(value)}
        </td>
      </tr>"""


def render_workspace_invite(
    *,
    recipient_email: str,
    workspace_name: str,
    inviter_name: str,
    role: str,
    accept_url: str,
    expires_label: str = "",
) -> tuple[str, str, str]:
    """
    Returns (subject, html, text).
    """
    ws = workspace_name or "a ZEXVRO workspace"
    inviter = inviter_name or "A teammate"
    role_name = role or "Developer"
    subject = f"ZEXVRO · Join {ws} as {role_name}"

    details = f"""
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="margin:8px 0 4px 0;background:#09090b;border:1px solid #27272a;border-radius:8px;">
        <tr>
          <td style="padding:4px 16px 8px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              {_detail_row("Workspace", ws)}
              {_detail_row("Role", f"roles/{role_name}", mono=True)}
              {_detail_row("Invited by", inviter)}
              {_detail_row("Sign in as", recipient_email, mono=True)}
              {(_detail_row("Expires", expires_label) if expires_label else "")}
            </table>
          </td>
        </tr>
      </table>
    """

    body = f"""
      <p style="margin:0 0 12px 0;color:#d4d4d8;">
        <strong style="color:#fafafa;">{_esc(inviter)}</strong>
        invited you to join
        <strong style="color:#fafafa;">{_esc(ws)}</strong>
        on ZEXVRO.
      </p>
      <p style="margin:0 0 4px 0;color:#a1a1aa;">
        Accepting attaches your account to this workspace with the role below.
        Use the same email address when you sign in.
      </p>
      {details}
    """

    secondary = f"""
      If the button does not work, open this link:<br />
      <a href="{_esc(accept_url)}" style="color:#e4e4e7;word-break:break-all;">{_esc(accept_url)}</a>
    """

    html_doc = render_layout(
        preheader=f"{inviter} invited you to {ws} on ZEXVRO",
        eyebrow="Workspace invitation",
        title=f"Join {ws}",
        body_html=body,
        cta_label="Review & accept invitation",
        cta_url=accept_url,
        secondary_html=secondary,
        footer_note="This invitation is intended only for the recipient above. If you did not expect it, you can ignore this email.",
    )

    text = (
        f"ZEXVRO workspace invitation\n\n"
        f"{inviter} invited you to join {ws} as roles/{role_name}.\n"
        f"Sign in as: {recipient_email}\n"
        f"Accept: {accept_url}\n"
        + (f"Expires: {expires_label}\n" if expires_label else "")
        + "\n— ZEXVRO\n"
    )
    return subject, html_doc, text


def render_generic(
    *,
    subject: str,
    eyebrow: str,
    title: str,
    message_html: str,
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
    preheader: str = "",
) -> tuple[str, str, str]:
    html_doc = render_layout(
        preheader=preheader or title,
        eyebrow=eyebrow,
        title=title,
        body_html=message_html,
        cta_label=cta_label,
        cta_url=cta_url,
    )
    # crude text strip
    import re
    text = re.sub(r"<[^>]+>", " ", message_html)
    text = re.sub(r"\s+", " ", text).strip()
    text = f"{title}\n\n{text}\n"
    if cta_url:
        text += f"\n{cta_label or 'Open'}: {cta_url}\n"
    return subject, html_doc, text
