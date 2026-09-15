import { useEffect } from 'react';

const SITE_URL = 'https://gamebirj.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-cover.png`;

interface SeoProps {
  title: string;
  description: string;
  path: string;
  /** Private/auth pages must not be indexed. Defaults to indexable. */
  noindex?: boolean;
  image?: string;
  type?: 'website' | 'article';
  /** Valid JSON-LD objects to inject (no fake ratings/reviews/prices). */
  jsonLd?: Record<string, unknown>[];
}

function upsertMetaByName(name: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertMetaByProperty(property: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string): void {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Client-side head manager for the SPA. Updates title, description,
 * canonical, robots and social tags on route change so every indexable
 * page has unique metadata even without SSR.
 */
export function Seo({
  title,
  description,
  path,
  noindex = false,
  image = DEFAULT_IMAGE,
  type = 'website',
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;

    document.title = title;
    upsertMetaByName('description', description);
    upsertMetaByName(
      'robots',
      noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large',
    );
    upsertLink('canonical', url);

    upsertMetaByProperty('og:title', title);
    upsertMetaByProperty('og:description', description);
    upsertMetaByProperty('og:url', url);
    upsertMetaByProperty('og:type', type);
    upsertMetaByProperty('og:image', image);
    upsertMetaByName('twitter:title', title);
    upsertMetaByName('twitter:description', description);
    upsertMetaByName('twitter:image', image);

    const injected: HTMLScriptElement[] = [];
    if (jsonLd) {
      for (const schema of jsonLd) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.seoJsonLd = 'true';
        script.text = JSON.stringify(schema);
        document.head.appendChild(script);
        injected.push(script);
      }
    }
    return () => {
      for (const script of injected) script.remove();
    };
  }, [title, description, path, noindex, image, type, jsonLd]);

  return null;
}

export { SITE_URL };
