import type { SVGProps } from "react";

export function BesederLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="32" height="32" rx="7" fill="#4f46e5" />
      <text
        x="16"
        y="23.5"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="22"
        fontWeight="700"
        fill="white"
      >
        ב
      </text>
    </svg>
  );
}
