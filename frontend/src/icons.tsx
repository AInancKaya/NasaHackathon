// AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant.
// Reviewed and directed by the project author.

// One small icon set, drawn here: 24 px grid, 1.75 px stroke, round caps. Decorative by default.
import type { ReactNode } from "react";

function Svg({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="ico"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

type P = { size?: number };

const bulb = <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0z" />;

export const IconThermo = (p: P) => (
  <Svg {...p}>
    {bulb}
    <path d="M12 10v6" />
  </Svg>
);
export const IconThermoUp = (p: P) => (
  <Svg {...p}>
    {bulb}
    <path d="M12 9v7M18 5v6M16 7l2-2 2 2" />
  </Svg>
);
export const IconThermoDown = (p: P) => (
  <Svg {...p}>
    {bulb}
    <path d="M12 13v3M18 5v6M16 9l2 2 2-2" />
  </Svg>
);
export const IconRain = (p: P) => (
  <Svg {...p}>
    <path d="M7 14a4.5 4.5 0 1 1 1-8.9A5.5 5.5 0 0 1 18.5 7 3.5 3.5 0 0 1 18 14H7z" />
    <path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" />
  </Svg>
);
export const IconWave = (p: P) => (
  <Svg {...p}>
    <path d="M3 9c2 0 2-2 4.5-2S9.5 9 12 9s2.5-2 4.5-2S19 9 21 9" />
    <path d="M3 14c2 0 2-2 4.5-2s2 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2" />
    <path d="M3 19c2 0 2-2 4.5-2s2 2 4.5 2 2.5-2 4.5-2 2.5 2 4.5 2" />
  </Svg>
);
export const IconSnow = (p: P) => (
  <Svg {...p}>
    <path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7" />
    <path d="M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5M3.6 10.4L6.8 9.5 5.9 6.3M18.1 17.7l-.9-3.2 3.2-.9M3.6 13.6l3.2.9-.9 3.2M18.1 6.3l-.9 3.2 3.2.9" />
  </Svg>
);
export const IconIce = (p: P) => (
  <Svg {...p}>
    <path d="M4 15l3-6h4l2-4h4l3 10z" />
    <path d="M2 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" />
  </Svg>
);
export const IconLeaf = (p: P) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15" />
    <path d="M5 19c3-4 6-7 10-9" />
  </Svg>
);
export const IconSoil = (p: P) => (
  <Svg {...p}>
    <path d="M12 13V8M12 8c0-2.5 2-4 5-4 0 3-2 4-5 4zM12 10c0-2-1.6-3.2-4-3.2 0 2.4 1.6 3.2 4 3.2z" />
    <path d="M3 14h18M5 17.5h3M11 17.5h2M16 17.5h3M7 20.5h2M14 20.5h3" />
  </Svg>
);
export const IconDrop = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5s-6 6.4-6 10.5a6 6 0 0 0 12 0c0-4.1-6-10.5-6-10.5z" />
    <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
  </Svg>
);
export const IconVapour = (p: P) => (
  <Svg {...p}>
    <path d="M4 8c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1 4-.5M4 12.5c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1 4-.5M4 17c2-1.5 4-1.5 6 0s4 1.5 6 0 3-1 4-.5" />
  </Svg>
);
export const IconWind = (p: P) => (
  <Svg {...p}>
    <path d="M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7" />
  </Svg>
);
export const IconGlobe = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </Svg>
);
export const IconSearch = (p: P) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Svg>
);
export const IconLocate = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
  </Svg>
);
export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3.2-3.2a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3.2 3.2a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);
export const IconPrint = (p: P) => (
  <Svg {...p}>
    <path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" />
    <path d="M7 14h10v6H7z" />
  </Svg>
);
export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Svg>
);
export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const IconChevron = (p: P & { dir?: "down" | "left" | "right" | "up" }) => (
  <Svg size={p.size}>
    <path
      d={
        p.dir === "left"
          ? "M14.5 6l-6 6 6 6"
          : p.dir === "right"
            ? "M9.5 6l6 6-6 6"
            : p.dir === "up"
              ? "M6 14.5l6-6 6 6"
              : "M6 9.5l6 6 6-6"
      }
    />
  </Svg>
);
export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" />
  </Svg>
);
export const IconBook = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
  </Svg>
);
export const IconCompass = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </Svg>
);
export const IconFlask = (p: P) => (
  <Svg {...p}>
    <path d="M9.5 3.5h5M10.5 3.5v6L5 18.5A1.3 1.3 0 0 0 6.1 20.5h11.8a1.3 1.3 0 0 0 1.1-2L13.5 9.5v-6" />
    <path d="M7.5 15h9" />
  </Svg>
);
export const IconMap = (p: P) => (
  <Svg {...p}>
    <path d="M9 4.5L3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </Svg>
);
