import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: 'https://smartcv-landingpage.vercel.app/',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://smartcv-landingpage.vercel.app/login',
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://smartcv-landingpage.vercel.app/upgrade',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: 'https://smartcv-landingpage.vercel.app/more',
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];
}
