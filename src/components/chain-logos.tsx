import type { SVGProps } from "react";

export function EthereumLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 256 417"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ethereum"
      {...props}
    >
      <path
        fill="currentColor"
        opacity="0.6"
        d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"
      />
      <path
        fill="currentColor"
        d="M127.962 0L0 212.32l127.962 75.639V154.158z"
      />
      <path
        fill="currentColor"
        opacity="0.6"
        d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z"
      />
      <path
        fill="currentColor"
        d="M127.962 416.905v-104.72L0 236.585z"
      />
      <path
        fill="currentColor"
        opacity="0.45"
        d="M127.961 287.958l127.96-75.637-127.96-58.162z"
      />
      <path
        fill="currentColor"
        opacity="0.8"
        d="M0 212.32l127.96 75.638v-133.8z"
      />
    </svg>
  );
}

export function ArbitrumLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Arbitrum"
      {...props}
    >
      <circle cx="16" cy="16" r="16" fill="#28A0F0" opacity="0.15" />
      <path
        d="M16.6 8.3l5.6 9.8-2.3 1.3-3.3-5.7-3.3 5.7-2.3-1.3 5.6-9.8zm-7.1 11.9L16 24l6.5-3.8-1.5-2.7L16 20.7l-5-3.2-1.5 2.7z"
        fill="#28A0F0"
      />
    </svg>
  );
}

export function OptimismLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Optimism"
      {...props}
    >
      <circle cx="16" cy="16" r="16" fill="#FF0420" opacity="0.15" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="13"
        fontWeight="700"
        fill="#FF0420"
      >
        OP
      </text>
    </svg>
  );
}

export function BaseLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Base"
      {...props}
    >
      <circle cx="16" cy="16" r="16" fill="#0052FF" opacity="0.15" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="#0052FF" strokeWidth="2.5" />
    </svg>
  );
}

export function PolygonLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Polygon"
      {...props}
    >
      <circle cx="16" cy="16" r="16" fill="#8247E5" opacity="0.15" />
      <path
        d="M21 13l-3-1.7-3 1.7v3.4l-3 1.7-3-1.7v-3.4l3-1.7L15 12V8.5l-3-1.7-3 1.7v3.4L6 13.5v5l3 1.7 3-1.7v-3.4l3-1.7 3 1.7v3.4l3 1.7 3-1.7v-5L21 13z"
        fill="#8247E5"
      />
    </svg>
  );
}

export function ScrollLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Scroll"
      {...props}
    >
      <circle cx="16" cy="16" r="16" fill="#FFEEDA" opacity="0.18" />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui"
        fontSize="11"
        fontWeight="700"
        fill="#FFB37A"
      >
        SCR
      </text>
    </svg>
  );
}
