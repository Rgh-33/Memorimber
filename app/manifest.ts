import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Memorimber", short_name: "Memorimber", lang: "ja",
    description: "何もなかった、なんてことはない。思い出を残し、振り返る。",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#4a90e2",
    icons: [192, 512].map((size) => ({ src: `/pwa/icon-${size}.png`, sizes: `${size}x${size}`, type: "image/png", purpose: "any" })),
  };
}
