import { ImageResponse } from "next/og";

// PWA manifest icon, 512×512. Brand gradient square + Fit Sync "F" glyph.
export const dynamic = "force-static";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 116,
          background: "linear-gradient(135deg, #9100D0 0%, #AE33ED 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="340" height="340" viewBox="0 0 1024 1024" fill="#fff" fillOpacity="0.95" xmlns="http://www.w3.org/2000/svg">
          <path d="M180 200 L770 200 C780 200 790 204 797 211 L853 271 C863 281 863 297 853 307 L797 367 C790 374 780 378 770 378 L350 378 L350 470 L620 470 C630 470 639 474 646 481 L687 524 C696 534 696 549 687 559 L646 602 C639 609 630 613 620 613 L350 613 L350 868 C350 880 340 890 328 890 L202 890 C190 890 180 880 180 868 L180 222 C180 210 190 200 202 200 Z" />
        </svg>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
