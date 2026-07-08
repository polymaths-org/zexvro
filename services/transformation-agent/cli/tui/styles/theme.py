"""Theme — ZEXVRO professional neutral-dark palette and layouts."""

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

/* Centered Screen Layouts */
MainScreen, AboutScreen, MemoryScreen, ToolsScreen {{
    align: center middle;
    layout: vertical;
}}

/* Header Styling */
#screen-title {{
    padding: 1 2;
    text-style: bold;
    color: {TEXT_PRIMARY};
    background: {SURFACE_RAISED};
    border-bottom: double {BORDER};
    width: 100%;
}}

/* Main Screen Hub */
#main-container {{
    width: 80;
    height: auto;
    border: solid {BORDER};
    background: {SURFACE};
    padding: 1 2;
    align: center middle;
    align-horizontal: center;
}}

#logo {{
    width: 100%;
    height: auto;
    color: {TEXT_PRIMARY};
    content-align: center middle;
    margin-bottom: 1;
}}

#title {{
    text-align: center;
    color: {TEXT_PRIMARY};
    text-style: bold;
    margin-bottom: 0;
}}

#subtitle {{
    text-align: center;
    color: {TEXT_SECONDARY};
    margin-bottom: 1;
}}

#menu {{
    width: 50;
    margin-top: 1;
    margin-bottom: 1;
    align-horizontal: center;
}}

ListView {{
    border: solid {BORDER_STRONG};
    height: auto;
    background: {SURFACE};
}}

ListItem {{
    padding: 0 2;
    height: 3;
    align: left middle;
    color: {TEXT_SECONDARY};
    background: {SURFACE};
}}

ListItem:hover {{
    background: {SURFACE_HOVER};
    color: {TEXT_PRIMARY};
}}

ListView:focus .list-item--focused {{
    background: {BRAND_BLUE};
    color: {BACKGROUND};
    text-style: bold;
}}

#info-box {{
    width: 100%;
    border: solid {BORDER};
    background: {SURFACE_RAISED};
    padding: 0 2;
    margin-top: 1;
    color: {TEXT_MUTED};
    height: 3;
    content-align: center middle;
}}

/* Welcome Screen Boot sequence */
WelcomeScreen {{
    align: center middle;
    layout: vertical;
}}

#welcome-container {{
    width: 90;
    height: 25;
    border: double {BORDER};
    background: {SURFACE};
    padding: 1 3;
    align: center middle;
}}

#boot-title {{
    color: {TEXT_PRIMARY};
    text-style: bold;
    text-align: center;
    margin-top: 1;
}}

#boot-log {{
    width: 100%;
    height: 4;
    border: solid {BORDER};
    background: {BACKGROUND};
    color: {TEXT_SECONDARY};
    margin-top: 1;
    margin-bottom: 1;
    padding: 0 1;
}}

#boot-progress-container {{
    width: 80;
    height: 3;
    border: solid {BORDER_STRONG};
    background: {SURFACE_RAISED};
    align: center middle;
    margin-top: 1;
    margin-bottom: 1;
}}

#boot-progress-bar {{
    width: 100%;
    color: {BRAND_BLUE};
    background: {BACKGROUND};
}}

#boot-skip {{
    text-align: center;
    color: {TEXT_MUTED};
    margin-top: 1;
}}

/* Chat Screen Layout */
ChatScreen {{
    layout: horizontal;
    background: {BACKGROUND};
}}

#chat-sidebar {{
    width: 30;
    height: 100%;
    background: {SURFACE};
    border-right: solid {BORDER};
    layout: vertical;
    padding: 1 2;
}}

#sidebar-logo {{
    width: 100%;
    height: 4;
    content-align: center middle;
    color: {BRAND_BLUE};
    margin-bottom: 1;
}}

#sidebar-title {{
    color: {TEXT_PRIMARY};
    text-style: bold;
    text-align: center;
    border-bottom: solid {BORDER_STRONG};
    padding-bottom: 1;
    margin-bottom: 1;
}}

.sidebar-label {{
    color: {TEXT_SECONDARY};
    margin-top: 1;
}}

.sidebar-val {{
    color: {BRAND_BLUE};
    text-style: bold;
    margin-bottom: 1;
}}

#chat-main {{
    width: 1fr;
    height: 100%;
    layout: vertical;
}}

#chat-area {{
    width: 1fr;
    height: 1fr;
    background: {BACKGROUND};
    padding: 1 2;
    overflow-y: scroll;
}}

/* Chat Message Cards */
.message-container {{
    width: 100%;
    height: auto;
    margin-bottom: 1;
    layout: vertical;
}}

.message-container-user {{
    align-horizontal: right;
}}

.message-container-morph {{
    align-horizontal: left;
}}

.message-card {{
    width: 85%;
    height: auto;
    padding: 1 2;
    border: solid {BORDER};
    background: {SURFACE};
}}

.message-card-user {{
    border: solid {BORDER_STRONG};
    background: {SURFACE_RAISED};
}}

.message-card-morph {{
    border: solid {BRAND_BLUE};
    background: {SURFACE};
}}

.message-header {{
    text-style: bold;
    padding-bottom: 0;
}}

.message-header-user {{
    color: {SUCCESS};
}}

.message-header-morph {{
    color: {BRAND_BLUE};
}}

.message-text {{
    color: {TEXT_PRIMARY};
    margin-bottom: 0;
}}

.message-time {{
    color: {TEXT_MUTED};
    text-align: right;
}}

/* Chat Input Bar */
#chat-input-container {{
    height: 5;
    border-top: solid {BORDER};
    background: {SURFACE};
    padding: 0 2;
    align: center middle;
}}

#chat-input {{
    width: 100%;
    border: solid {BORDER_STRONG};
    background: {BACKGROUND};
    color: {TEXT_PRIMARY};
}}

#chat-input:focus {{
    border: solid {ACCENT};
}}

/* DataTables and General Logs */
#table-container, #log-container {{
    width: 100%;
    height: 12;
    border: solid {BORDER};
    background: {BACKGROUND};
    margin-top: 1;
    margin-bottom: 1;
}}

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

RichLog {{
    border: none;
    background: {SURFACE};
    color: {TEXT_PRIMARY};
    height: 100%;
    width: 100%;
}}

/* Bottom Navigation Instruction / Footer */
#screen-footer {{
    text-align: center;
    color: {TEXT_MUTED};
    margin-top: 1;
}}
"""
