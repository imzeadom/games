import type { MetadataRoute } from "next";
import { SITE_URL } from "./site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1, changeFrequency: "weekly" as const },
    { path: "/sudoku", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/1024", priority: 0.9, changeFrequency: "monthly" as const },
    { path: "/sky-hop", priority: 0.9, changeFrequency: "monthly" as const },
    {
      path: "/twilight-canopy",
      priority: 0.9,
      changeFrequency: "monthly" as const,
    },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  return pages.map((page) => ({
    url: `${SITE_URL}${page.path}`,
    lastModified: new Date(),
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
