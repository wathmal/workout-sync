import { ImageResponse } from "next/og";

// Generate the favicon at build time. Mirrors the sidebar logo: a 32×32
// rounded square with the brand-primary gradient and a white barbell glyph.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #9100D0 0%, #AE33ED 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 10v4M22 10v4M5 7v10a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1H6a1 1 0 00-1 1zM16 7v10a1 1 0 001 1h1a1 1 0 001-1V7a1 1 0 00-1-1h-1a1 1 0 00-1 1zM8 12h8"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
