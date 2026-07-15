import * as React from "react";
import type { SVGProps } from "react";
const SvgA2A = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    aria-labelledby="a2a-title a2a-desc"
    viewBox="0 0 640 460"
    {...props}
  >
    <desc>
      {
        "Two agent nodes exchange offer and counter-offer pulses through a controlled settlement rail."
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
    <g transform="translate(78 126)">
      <rect
        width={164}
        height={164}
        fill="#0a0a0b"
        stroke="#fafafa"
        strokeWidth={2}
        rx={8}
      />
      <path stroke="#fafafa" strokeWidth={2} d="M44 66h76M44 98h46" />
      <rect
        width={52}
        height={52}
        x={56}
        y={-24}
        fill="#111113"
        stroke="#fafafa"
        strokeWidth={2}
        rx={6}
      />
      <path stroke="#fafafa" strokeWidth={2} d="M82 28v36" />
      <text
        x={42}
        y={134}
        fill="#a1a1aa"
        fontFamily="JetBrains Mono, monospace"
        fontSize={16}
      >
        {"AGENT A"}
      </text>
    </g>
    <g transform="translate(398 126)">
      <rect
        width={164}
        height={164}
        fill="#0a0a0b"
        stroke="#fafafa"
        strokeWidth={2}
        rx={8}
      />
      <path stroke="#fafafa" strokeWidth={2} d="M44 66h76M44 98h46" />
      <rect
        width={52}
        height={52}
        x={56}
        y={-24}
        fill="#111113"
        stroke="#fafafa"
        strokeWidth={2}
        rx={6}
      />
      <path stroke="#fafafa" strokeWidth={2} d="M82 28v36" />
      <text
        x={42}
        y={134}
        fill="#a1a1aa"
        fontFamily="JetBrains Mono, monospace"
        fontSize={16}
      >
        {"AGENT B"}
      </text>
    </g>
    <path
      stroke="#fafafa"
      strokeWidth={2}
      d="M246 180c60-50 88-50 148 0m0 56c-60 50-88 50-148 0"
    />
    <circle cx={246} cy={180} r={8} fill="#fafafa" />
    <circle cx={394} cy={236} r={8} fill="#a1a1aa" />
    <g transform="translate(238 322)">
      <rect
        width={164}
        height={42}
        fill="#111113"
        stroke="#3f3f46"
        strokeWidth={2}
        rx={6}
      />
      <path
        stroke="#fafafa"
        strokeDasharray="7 9"
        strokeWidth={2}
        d="M24 21h116"
      />
      <circle cx={24} cy={21} r={5} fill="#fafafa" />
      <circle cx={140} cy={21} r={5} fill="#fafafa" />
    </g>
  </svg>
);
export default SvgA2A;
