import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cantina Escolar",
    short_name: "Cantina",
    description: "Monedero prepago/crédito para la cantina escolar",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf6ec",
    theme_color: "#D6482F",
    icons: [
      {
        src: "/icon.png",
        sizes: "1024x1024",
        type: "image/png",
      },
    ],
  };
}
