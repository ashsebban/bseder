import type { SVGProps } from "react";

export function StarOfDavid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Upward-pointing triangle */}
      <polygon
        points="12,2 20.66,17 3.34,17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Downward-pointing triangle */}
      <polygon
        points="12,22 3.34,7 20.66,7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
