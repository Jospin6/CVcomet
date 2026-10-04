import { mainUrl } from '@/helpers/constants';
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${mainUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    { url: `${mainUrl}/features`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${mainUrl}/pricing`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    {
      url: `${mainUrl}/login`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${mainUrl}/upgrade`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${mainUrl}/templates`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ];
}
