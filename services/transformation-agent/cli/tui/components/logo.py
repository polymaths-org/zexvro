"""ASCII art mascot for the TUI main screen — representing the Morph AI helper."""

BANNER = r"""
 -+.                      .+:
 %M#*:                  :*#M+
 %M#M#%-              -%#M#M+
 %M###MM@=         .=@MM###M+
 %M###MMMM@+.    .+#MMM####M+
 *M###@%#MMM#+ .*#MMM#%####M+
 *M##M= .+#MMM.-MMM@+. *M##M+
 *M##M=   .+@M.-M@=    *M##M+
 *M##M=      - .-      *M##M+
 *MM##%.              :@##MM=
 .=@MMM#*: []    [] -%#MMM%=
    -%#MM* []    [] #MM#*:
      :*#*          ##+.
        :-          =.
"""


def get_banner() -> str:
    """Return banner with trailing whitespace and outer blank lines stripped."""
    lines = BANNER.splitlines()
    lines = [l.rstrip() for l in lines]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)


SMALL_LOGO = r"""
   /\    /\
  /  \__/  \
 |  []  []  |
  \________/
"""


def get_small_logo() -> str:
    """Return the compact small logo mascot."""
    lines = SMALL_LOGO.splitlines()
    lines = [l.rstrip() for l in lines]
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return "\n".join(lines)

