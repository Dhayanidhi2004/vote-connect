import type { Config } from "tailwindcss";
import path from "path";

const frontendRoot = process.cwd();
const source = (folder: string) =>
  path.join(frontendRoot, folder, "**/*.{ts,tsx}").replaceAll("\\", "/");

/** Shared design tokens for the public site and every role-based workspace. */
const config: Config = {
  // Absolute globs keep production builds from dropping utility classes.
  content: [source("app"), source("components"), source("lib")],
  theme: {
    extend: {
      colors: {
        // slate-ink family for text and dark surfaces
        navy: {
          50: "#F1F5F9",
          100: "#E2E8F0",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
        },
        brand: {
          blue: "#1D4ED8",
          blueLight: "#1E40AF",
          blueTint: "#EFF6FF",
          green: "#15803D",
          greenDark: "#166534",
          greenTint: "#F0FDF4",
          orange: "#B45309",
          orangeTint: "#FFF7ED",
          purple: "#7E22CE",
          purpleTint: "#FAF5FF",
          teal: "#0F766E",
          tealTint: "#F0FDFA",
          red: "#B91C1C",
          redTint: "#FEF2F2",
          amber: "#A16207",
        },
        canvas: "#F6F8FC",
        ink: "#0F172A",
        body: "#334155",
        muted: "#64748B",
        line: "#E2E8F0",
      },
      fontFamily: {
        display: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.035)",
        tile: "0 1px 3px rgba(15,23,42,0.08)",
        lift: "0 16px 40px rgba(15,23,42,0.10)",
        header: "0 1px 0 rgba(15,23,42,0.08)",
      },
      borderRadius: {
        lg: "9px",
        xl: "12px",
        "2xl": "16px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
