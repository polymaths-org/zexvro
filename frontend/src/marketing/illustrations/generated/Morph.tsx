import * as React from "react";
import type { SVGProps } from "react";
const SvgMorph = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    aria-labelledby="morph-title morph-desc"
    viewBox="0 0 640 460"
    {...props}
  >
    <desc>
      {
        "A repository graph enters a terminal where Morph writes a migration plan."
      }
    </desc>
    <rect
      width={638}
      height={458}
      x={1}
      y={1}
      fill="#050505"
      stroke="#27272a"
      strokeWidth={2}
      rx={8}
    />
    <g stroke="#fafafa" strokeWidth={2}>
      <path
        stroke="#3b82f6"
        d="m92 122 72 62m0 0-48 88m48-88 90 12m0 0-34 94"
      />
      <rect width={48} height={48} x={68} y={98} fill="#111113" rx={6} />
      <rect width={48} height={48} x={140} y={160} fill="#111113" rx={6} />
      <rect width={48} height={48} x={92} y={248} fill="#111113" rx={6} />
      <rect width={48} height={48} x={230} y={172} fill="#111113" rx={6} />
      <rect width={48} height={48} x={196} y={266} fill="#111113" rx={6} />
    </g>
    <rect
      width={272}
      height={304}
      x={306}
      y={78}
      fill="#0a0a0b"
      stroke="#fafafa"
      strokeWidth={2}
      rx={8}
    />
    <path stroke="#27272a" strokeWidth={2} d="M306 122h272" />
    <circle cx={332} cy={101} r={5} fill="#3b82f6" />
    <circle cx={354} cy={101} r={5} fill="#3f3f46" />
    <circle cx={376} cy={101} r={5} fill="#3f3f46" />
    <g fill="#fafafa" fontFamily="JetBrains Mono, monospace" fontSize={18}>
      <text x={332} y={164} className="morph_svg__terminal-line">
        {"> morph inspect repo"}
      </text>
      <text x={332} y={202} className="morph_svg__terminal-line">
        {"read: deployment files"}
      </text>
      <text x={332} y={240} className="morph_svg__terminal-line">
        {"map: web2 services"}
      </text>
      <text x={332} y={278} className="morph_svg__terminal-line">
        {"plan: web3-ready path"}
      </text>
      <text x={332} y={316} className="morph_svg__terminal-line">
        {"status: human approval"}
      </text>
    </g>
    <path stroke="#3b82f6" strokeWidth={4} d="M332 340h28" />
    <path
      stroke="#3b82f6"
      strokeDasharray="7 11"
      strokeWidth={3}
      d="M278 196c30 0 16 34 46 34"
    />
  </svg>
);
export default SvgMorph;
