import type { MetadataRoute } from "next";

/**
 * Lets the family add the calendar to a phone's home screen, where it opens
 * without browser chrome — which is how most of them will actually use it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Organiser",
    short_name: "Family",
    description: "One shared calendar for the whole family.",
    start_url: "/calendar",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6f3",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
