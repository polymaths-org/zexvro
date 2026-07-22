"""
Cognito Custom Message trigger — branded ZEXVRO HTML for verification codes.
Cognito still sends the email (COGNITO_DEFAULT or SES DEVELOPER From-address).
"""

from __future__ import annotations

ASSET_BASE = "https://console.zexvro.in"


def _html_code_email(*, title: str, intro: str, code: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="color-scheme" content="dark"/><title>{title}</title></head>
<body style="margin:0;padding:0;background:#050505;color:#fafafa;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#050505;width:100%;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#0a0a0b;border:1px solid #27272a;border-radius:12px;">
  <tr><td style="padding:28px 32px 22px 32px;border-bottom:1px solid #18181b;" align="center">
    <img src="{ASSET_BASE}/brand/wordmark-transparent.png" width="220" alt="ZEXVRO" style="display:block;margin:0 auto;width:220px;max-width:80%;height:auto;border:0;"/>
  </td></tr>
  <tr><td style="padding:28px 32px 8px 32px;" align="left">
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">Account verification</div>
    <div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;color:#fafafa;margin-bottom:16px;">{title}</div>
    <p style="margin:0 0 16px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#a1a1aa;">{intro}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;border:1px solid #27272a;border-radius:8px;margin:8px 0 20px 0;">
      <tr><td align="center" style="padding:22px 16px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:0.28em;color:#ffffff;">{code}</td></tr>
    </table>
    <p style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#71717a;">If you did not request this, ignore this email.</p>
  </td></tr>
  <tr><td style="padding:8px 32px 28px 32px;" align="center">
    <table role="presentation" width="100%" style="border-top:1px solid #18181b;"><tr>
      <td style="padding:24px 0 0 0;" align="center">
        <img src="{ASSET_BASE}/brand/logo-transparent.png" width="56" height="56" alt="ZEXVRO" style="display:block;margin:0 auto;width:56px;height:56px;border:0;"/>
      </td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:16px 32px 24px 32px;border-top:1px solid #18181b;font-family:Inter,Helvetica,Arial,sans-serif;font-size:11px;color:#52525b;">
    <p style="margin:0 0 6px 0;">Sent by ZEXVRO authentication.</p>
    <p style="margin:0;"><a href="{ASSET_BASE}" style="color:#a1a1aa;text-decoration:none;">zexvro.in</a> · Do not share secrets in email</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>"""


def handler(event, context):
    trigger = event.get("triggerSource", "")
    req = event.get("request") or {}
    # Must use Cognito's placeholders so the service can inject the real code.
    code_placeholder = req.get("codeParameter") or "{####}"
    username_placeholder = req.get("usernameParameter") or event.get("userName") or "user"

    # Ensure response dict exists
    event.setdefault("response", {})
    response = event["response"]

    def set_email(subject: str, title: str, intro: str):
        response["emailSubject"] = subject
        response["emailMessage"] = _html_code_email(
            title=title,
            intro=intro,
            code=code_placeholder,
        )
        response["smsMessage"] = f"ZEXVRO code: {code_placeholder}"

    if trigger in ("CustomMessage_SignUp", "CustomMessage_ResendCode"):
        set_email(
            "ZEXVRO · Your verification code",
            "Your verification code",
            "Use this code to confirm your ZEXVRO account. It expires soon — do not share it.",
        )
    elif trigger == "CustomMessage_ForgotPassword":
        set_email(
            "ZEXVRO · Password reset code",
            "Password reset code",
            "Use this code to reset your ZEXVRO password.",
        )
    elif trigger == "CustomMessage_AdminCreateUser":
        set_email(
            "ZEXVRO · Temporary password",
            "Your temporary password",
            f"Username: <strong style=\"color:#fafafa;\">{username_placeholder}</strong><br/>"
            "Sign in and change this password immediately.",
        )
    elif trigger in ("CustomMessage_UpdateUserAttribute", "CustomMessage_VerifyUserAttribute"):
        set_email(
            "ZEXVRO · Verify email",
            "Verify your email",
            "Use this code to verify your email on ZEXVRO.",
        )
    elif trigger == "CustomMessage_Authentication":
        set_email(
            "ZEXVRO · Sign-in code",
            "Your sign-in code",
            "Use this one-time code to sign in to ZEXVRO.",
        )
    else:
        # Unknown custom-message trigger — still brand it if a code is present.
        if code_placeholder:
            set_email(
                "ZEXVRO · Verification code",
                "Your verification code",
                "Use this code for your ZEXVRO account.",
            )

    return event
