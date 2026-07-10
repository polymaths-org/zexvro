import * as React from "react";
import type { SVGProps } from "react";
const SvgNft = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    aria-labelledby="nft-title nft-desc"
    viewBox="0 0 640 460"
    {...props}
  >
    <desc>
      {
        "A messy technical asset diagram simplifies into three clear product steps."
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
    <path
      stroke="#a1a1aa"
      strokeWidth={2}
      d="M92 106h104v76H92zm70 114h142v62H162zm212-112h116v88H374zm44 148h128v70H418zM196 144l178 8m-70 100 114 38M162 182l64 38m264-24-58 60M112 132h62m-62 22h42m36 92h86m126-112h58m-16 150h72"
      opacity={0.8}
    />
    <g opacity={0.15}>
      <g transform="translate(88 128)">
        <rect
          width={132}
          height={132}
          fill="#111113"
          stroke="#fafafa"
          strokeWidth={2}
          rx={8}
        />
        <path stroke="#fafafa" strokeWidth={5} d="m38 74 24 22 36-56" />
        <text
          x={36}
          y={164}
          fill="#a1a1aa"
          fontFamily="JetBrains Mono, monospace"
          fontSize={16}
        >
          {"DEFINE"}
        </text>
      </g>
      <g transform="translate(254 128)">
        <rect
          width={132}
          height={132}
          fill="#111113"
          stroke="#fafafa"
          strokeWidth={2}
          rx={8}
        />
        <path
          stroke="#fafafa"
          strokeWidth={4}
          d="M36 96h60M36 66h60M66 36v90"
        />
        <text
          x={42}
          y={164}
          fill="#a1a1aa"
          fontFamily="JetBrains Mono, monospace"
          fontSize={16}
        >
          {"ISSUE"}
        </text>
      </g>
      <g transform="translate(420 128)">
        <rect
          width={132}
          height={132}
          fill="#111113"
          stroke="#fafafa"
          strokeWidth={2}
          rx={8}
        />
        <path
          stroke="#fafafa"
          strokeWidth={4}
          d="M36 72h60M74 48l24 24-24 24"
        />
        <text
          x={36}
          y={164}
          fill="#a1a1aa"
          fontFamily="JetBrains Mono, monospace"
          fontSize={16}
        >
          {"OPERATE"}
        </text>
      </g>
    </g>
  </svg>
);
export default SvgNft;
