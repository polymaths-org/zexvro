"""Theme — ZEXVRO professional neutral-dark palette and layout styles."""

# Neutral colors aligned with ZEXVRO design tokens
BACKGROUND = "#050505"
SURFACE = "#0A0A0B"
SURFACE_RAISED = "#111113"
SURFACE_HOVER = "#18181B"
BORDER = "#27272A"
BORDER_STRONG = "#3F3F46"
TEXT_PRIMARY = "#FAFAFA"
TEXT_SECONDARY = "#A1A1AA"
TEXT_MUTED = "#71717A"

# Accents
ACCENT = "#FFFFFF"
ACCENT_TEXT = "#050505"
BRAND_BLUE = "#3B82F6"
BRAND_PURPLE = "#7C3AED"

# Semantics
SUCCESS = "#22C55E"
WARNING = "#F59E0B"
DANGER = "#EF4444"

APP_CSS = f"""
Screen {{
    background: {BACKGROUND};
    color: {TEXT_PRIMARY};
}}

/* Header Bar Styling */
#header-bar {{
    height: 3;
    background: {SURFACE_RAISED};
    border-bottom: solid {BORDER};
    layout: horizontal;
    align: left middle;
    padding: 0 2;
}}

#header-title {{
    width: 35%;
    text-style: bold;
    color: {TEXT_PRIMARY};
}}

#header-workspace {{
    width: 45%;
    text-align: center;
    color: {TEXT_SECONDARY};
}}

#header-status {{
    width: 20%;
    text-align: right;
}}

/* Main Workspace split layout */
#main-workspace {{
    height: 1fr;
    layout: horizontal;
}}

/* Sidebar Styling */
#sidebar {{
    width: 35;
    height: 100%;
    background: {SURFACE};
    border-right: solid {BORDER};
    layout: vertical;
}}

#sidebar-mascot-container {{
    height: 10;
    align: center middle;
    border-bottom: dashed {BORDER};
    padding: 1 1;
    background: {SURFACE_RAISED};
}}

#sidebar-logo {{
    width: 100%;
    height: 4;
    content-align: center middle;
    color: {BRAND_BLUE};
}}

#sidebar-engine-title {{
    text-align: center;
    text-style: bold;
    color: {TEXT_SECONDARY};
    margin-top: 1;
}}

#sidebar-status-val {{
    text-align: center;
    margin-top: 0;
}}

TabbedContent {{
    height: 1fr;
}}

TabPane {{
    padding: 0 1;
    height: 100%;
}}

/* Help static widget */
#help-text-widget {{
    color: {TEXT_SECONDARY};
    padding: 1 2;
    height: 100%;
}}

/* Chat Console Panel Styling */
#chat-pane {{
    width: 1fr;
    height: 100%;
    layout: vertical;
}}

#chat-area {{
    height: 1fr;
    background: {BACKGROUND};
    padding: 1 0;
    overflow-y: scroll;
}}

.chat-message-row {{
    width: 100%;
    height: auto;
    layout: horizontal;
    margin-bottom: 1;
}}

.morph-row {{
    align-horizontal: left;
    padding-left: 2;
}}

.user-row {{
    align-horizontal: right;
    padding-right: 0;
}}

.chat-message-block {{
    width: 80%;
    height: auto;
    padding: 0 2;
    background: {SURFACE_RAISED};
}}

.morph-message {{
    border: round {BORDER};
}}

.user-message {{
    border: round {SUCCESS};
}}

/* Chat Input Styling */
#chat-input-container {{
    height: 3;
    border-top: solid {BORDER};
    background: {SURFACE};
    layout: horizontal;
    align: left middle;
    padding: 0 2;
}}

#chat-prompt-symbol {{
    width: 2;
    text-style: bold;
    color: {BRAND_BLUE};
}}

#chat-input {{
    width: 1fr;
    border: none;
    background: {BACKGROUND};
    color: {TEXT_PRIMARY};
}}

#chat-input:focus {{
    border: none;
}}

/* Datatables Styling */
DataTable {{
    background: {SURFACE};
    color: {TEXT_PRIMARY};
    height: 100%;
    width: 100%;
}}

DataTable > .datatable--header {{
    background: {SURFACE_RAISED};
    color: {TEXT_PRIMARY};
    text-style: bold;
}}

DataTable:focus > .datatable--cursor {{
    background: {BRAND_BLUE};
    color: {BACKGROUND};
}}

/* Footer Styling */
#footer-bar {{
    height: 1;
    background: {SURFACE_RAISED};
    border-top: solid {BORDER};
    text-align: center;
    color: {TEXT_MUTED};
    width: 100%;
}}

/* Welcome Screen Styling */
#welcome-screen-container {{
    layout: vertical;
    align: center middle;
    width: 100%;
    height: 100%;
    background: {BACKGROUND};
}}

#welcome-outer {{
    layout: vertical;
    align: center middle;
    width: 70;
    height: auto;
    background: {BACKGROUND};
}}

#logo {{
    color: {BRAND_BLUE};
    height: 14;
    width: 100%;
    content-align: center middle;
    margin: 0;
    padding: 0;
}}

#boot-title {{
    width: 100%;
    text-align: center;
    text-style: bold;
    color: {TEXT_PRIMARY};
    margin-top: 1;
    margin-bottom: 1;
}}

#boot-log {{
    width: 100%;
    height: 12;
    background: {SURFACE};
    border: solid {BORDER};
    margin-bottom: 1;
    padding: 1 2;
}}

#boot-progress-bar {{
    width: 100%;
    text-align: center;
    color: {SUCCESS};
    text-style: bold;
    margin-bottom: 1;
}}

#boot-skip {{
    width: 100%;
    text-align: center;
    color: {TEXT_MUTED};
    text-style: italic;
}}

/* Welcome Menu Screen Styling */
#menu-screen-container {{
    layout: vertical;
    align: center middle;
    width: 100%;
    height: 100%;
    background: {BACKGROUND};
}}

#menu-outer {{
    layout: vertical;
    align: center middle;
    width: 78;
    height: auto;
    border: solid {BORDER};
    padding: 1 2;
    background: {BACKGROUND};
}}

#menu-logo {{
    color: {BRAND_BLUE};
    height: 14;
    width: 100%;
    content-align: center middle;
    margin-bottom: 1;
}}

#menu-subtitle-box {{
    width: 100%;
    align: center middle;
    margin-bottom: 1;
}}

#menu-subtitle-title {{
    width: 100%;
    text-align: center;
    text-style: bold;
    color: {TEXT_PRIMARY};
}}

#menu-subtitle-desc {{
    width: 100%;
    text-align: center;
    color: {TEXT_MUTED};
}}

#menu-auth-status {{
    width: 100%;
    text-align: center;
    color: {TEXT_SECONDARY};
    margin-top: 1;
    text-style: italic;
}}

#menu-actions-wrapper {{
    width: 100%;
    height: auto;
    align: center middle;
    background: transparent;
}}

#menu-actions {{
    width: 50;
    height: auto;
    border: solid {BORDER};
    padding: 1 2;
    margin-bottom: 1;
}}

#menu-actions Button {{
    width: 100%;
    height: 3;
    margin-bottom: 1;
    background: transparent;
    border: none;
    color: {TEXT_SECONDARY};
    content-align: center middle;
    padding: 0 1;
}}

#menu-actions Button:hover {{
    color: {TEXT_PRIMARY};
    background: {SURFACE_HOVER};
}}

#menu-actions Button:focus {{
    color: {BRAND_BLUE};
    text-style: bold;
    background: {SURFACE_HOVER};
}}

#menu-directory-wrapper {{
    width: 100%;
    height: auto;
    align: center middle;
    background: transparent;
}}

#menu-directory {{
    width: 68;
    border: solid {BORDER};
    padding: 0 2;
    text-align: center;
    color: {TEXT_MUTED};
    margin-top: 1;
}}

/* Login Screen Styling */
#login-screen-container {{
    layout: vertical;
    align: center middle;
    width: 100%;
    height: 100%;
    background: {BACKGROUND};
}}

#login-outer {{
    layout: vertical;
    align: center middle;
    width: 78;
    height: auto;
    border: solid {BORDER};
    padding: 2 4;
    background: {BACKGROUND};
}}

#login-logo {{
    color: {BRAND_BLUE};
    height: 14;
    width: 100%;
    content-align: center middle;
    margin-bottom: 1;
}}

#login-title {{
    width: 100%;
    text-align: center;
    text-style: bold;
    color: {TEXT_PRIMARY};
    margin-bottom: 1;
}}

.login-text {{
    width: 100%;
    text-align: center;
    color: {TEXT_SECONDARY};
    margin-bottom: 1;
}}

#login-code-box {{
    width: 44;
    height: 5;
    border: double {BRAND_BLUE};
    background: {SURFACE};
    align: center middle;
    content-align: center middle;
    margin-bottom: 1;
    margin-top: 1;
}}

#login-code-val {{
    text-style: bold;
    color: {TEXT_PRIMARY};
    text-align: center;
}}

#login-link-val {{
    color: {BRAND_BLUE};
    text-align: center;
    margin-bottom: 1;
}}

#login-status {{
    width: 100%;
    text-align: center;
    color: {TEXT_MUTED};
    margin-bottom: 2;
}}

#login-actions-wrapper {{
    width: 100%;
    height: auto;
    align: center middle;
    background: transparent;
}}

#btn-login-cancel {{
    width: 24;
    height: 3;
    background: transparent;
    border: solid {BORDER};
    color: {TEXT_PRIMARY};
}}

#btn-login-cancel:hover {{
    background: {SURFACE_HOVER};
}}

#btn-login-cancel:focus {{
    color: {BRAND_BLUE};
    background: {SURFACE_HOVER};
}}

#memory-screen-container {{
    width: 100%;
    height: 100%;
    align: center middle;
    background: {SURFACE};
}}

#memory-outer {{
    width: 110;
    height: 48;
    border: double {BORDER};
    background: {SURFACE_RAISED};
    padding: 2 4;
    align: center middle;
}}

#memory-logo {{
    width: 100%;
    height: 6;
    text-align: center;
    color: {BRAND_BLUE};
    content-align: center middle;
}}

#memory-header-box {{
    width: 100%;
    align: center middle;
    margin-bottom: 2;
}}

#memory-title {{
    width: 100%;
    text-align: center;
    text-style: bold;
    color: {TEXT_PRIMARY};
}}

#memory-desc {{
    width: 100%;
    text-align: center;
    color: {TEXT_MUTED};
}}

#memory-workspace {{
    width: 100%;
    height: 28;
    layout: horizontal;
}}

#memory-table-container {{
    width: 55%;
    height: 100%;
    padding-right: 2;
}}

#memory-table-label {{
    text-style: bold;
    color: {BRAND_BLUE};
    margin-bottom: 1;
}}

#memory-screen-table {{
    width: 100%;
    height: 1fr;
    border: solid {BORDER};
    background: {SURFACE};
}}

#memory-form-container {{
    width: 45%;
    height: 100%;
    padding-left: 2;
}}

.form-label {{
    text-style: bold;
    color: {TEXT_SECONDARY};
    margin-top: 1;
    margin-bottom: 1;
}}

#input-memory-key, #input-memory-value {{
    width: 100%;
    height: 3;
    border: solid {BORDER};
    background: {SURFACE};
    margin-bottom: 1;
}}

#input-memory-key:focus, #input-memory-value:focus {{
    border: solid {BRAND_BLUE};
}}

#memory-actions-wrapper-inner {{
    margin-top: 1;
    height: auto;
    width: 100%;
}}

#memory-actions-wrapper-inner Button {{
    width: 100%;
    height: 3;
    margin-bottom: 1;
}}
"""
