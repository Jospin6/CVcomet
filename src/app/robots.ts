import type { MetadataRoute } from 'next'
import { mainUrl } from '@/helpers/constants';
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/dashboard/', '/g/', '/settings/', '/onboarding/'],
    },
    sitemap: `${mainUrl}/sitemap.xml`,
  }
}