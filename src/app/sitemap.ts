
import { MetadataRoute } from 'next';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { FirestoreCategory, FirestoreService, FirestoreCity, FirestoreArea } from '@/types/firestore';
import { getBaseUrl } from '@/lib/config'; // Import the helper

export const dynamic = 'force-static'; 

// Helper to safely get ISO string from Timestamp or return current date
const safeToISOString = (timestamp: Timestamp | undefined | string | Date, fallbackDate: string): string => {
  try {
    if (timestamp && typeof (timestamp as Timestamp).toDate === 'function') {
      return (timestamp as Timestamp).toDate().toISOString();
    }
    if (typeof timestamp === 'string') {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    return fallbackDate;
  } catch (e) {
    return fallbackDate;
  }
};


async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const appBaseUrl = getBaseUrl(); // Use the helper
  const entries: MetadataRoute.Sitemap = [];
  const currentDate = new Date().toISOString();

  // 1. Static pages
  const staticPages = [
    '', 
    '/about-us',
    '/contact-us',
    '/careers',
    '/terms-of-service',
    '/privacy-policy',
    '/faq',
    '/help-center',
    '/cancellation-policy',
    '/categories', 
  ];
  staticPages.forEach(page => {
    entries.push({
      url: `${appBaseUrl}${page}`,
      lastModified: currentDate,
      changeFrequency: 'weekly',
      priority: page === '' ? 1.0 : 0.8,
    });
  });

  // 2. Categories
  try {
    const categoriesSnapshot = await getDocs(query(collection(db, 'adminCategories')));
    categoriesSnapshot.forEach(docSnap => {
      const categoryData = docSnap.data();
      if (categoryData && categoryData.slug) {
        const category = categoryData as FirestoreCategory;
        entries.push({
          url: `${appBaseUrl}/category/${category.slug}`,
          lastModified: safeToISOString(category.createdAt, currentDate),
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching categories:", e);
    throw e; 
  }

  // 3. Services
  try {
    const servicesSnapshot = await getDocs(query(collection(db, 'adminServices'), where('isActive', '==', true)));
    servicesSnapshot.forEach(docSnap => {
      const serviceData = docSnap.data();
      if (serviceData && serviceData.slug) {
        const service = serviceData as FirestoreService;
        entries.push({
          url: `${appBaseUrl}/service/${service.slug}`,
          lastModified: safeToISOString(service.updatedAt || service.createdAt, currentDate),
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching services:", e);
    throw e;
  }

  // 4. Cities
  try {
    const citiesSnapshot = await getDocs(query(collection(db, 'cities'), where('isActive', '==', true)));
    citiesSnapshot.forEach(docSnap => {
      const cityData = docSnap.data();
      if (cityData && cityData.slug) {
        const city = cityData as FirestoreCity;
        entries.push({
          url: `${appBaseUrl}/${city.slug}`,
          lastModified: safeToISOString(city.updatedAt || city.createdAt, currentDate),
          changeFrequency: 'monthly',
          priority: 0.7,
        });
      }
    });
  } catch (e) {
    console.error("Sitemap: Error fetching cities:", e);
    throw e;
  }

  // 5. Areas (City/Area pages)
  try {
    const citiesSnapshot = await getDocs(query(collection(db, 'cities'), where('isActive', '==', true)));
    for (const cityDoc of citiesSnapshot.docs) {
        const city = cityDoc.data() as FirestoreCity;
        if (!city || !city.slug) {
            continue;
        }

        const areasSnapshot = await getDocs(query(collection(db, 'areas'), where('cityId', '==', cityDoc.id), where('isActive', '==', true)));
        areasSnapshot.forEach(areaDoc => {
            const area = areaDoc.data() as FirestoreArea;
            if (area && area.slug) {
                entries.push({
                    url: `${appBaseUrl}/${city.slug}/${area.slug}`,
                    lastModified: safeToISOString(area.updatedAt || area.createdAt, currentDate),
                    changeFrequency: 'monthly',
                    priority: 0.6,
                });
            }
        });
    }
  } catch (e) {
    console.error("Sitemap: Error fetching areas:", e);
    throw e;
  }
  
  // 6. City/Area/Category pages
  try {
    const citiesSnapshot = await getDocs(query(collection(db, 'cities'), where('isActive', '==', true)));
    const categoriesSnapshot = await getDocs(query(collection(db, 'adminCategories'))); 

    for (const cityDoc of citiesSnapshot.docs) {
      const cityData = cityDoc.data() as FirestoreCity;
      if (!cityData || !cityData.slug) {
          continue;
      }

      const areasSnapshot = await getDocs(query(collection(db, 'areas'), where('cityId', '==', cityDoc.id), where('isActive', '==', true)));
      if (areasSnapshot.empty) continue;

      for (const areaDoc of areasSnapshot.docs) {
        const areaData = areaDoc.data() as FirestoreArea;
        if (!areaData || !areaData.slug) {
            continue;
        }

        categoriesSnapshot.forEach(categoryDoc => {
          const categoryData = categoryDoc.data() as FirestoreCategory;
          if (categoryData && categoryData.slug) {
            entries.push({
              url: `${appBaseUrl}/${cityData.slug}/${areaData.slug}/${categoryData.slug}`,
              lastModified: safeToISOString(categoryData.createdAt, currentDate), 
              changeFrequency: 'weekly',
              priority: 0.5,
            });
          }
        });
      }
    }
  } catch (e) {
    console.error("Sitemap: Error fetching city/area/category pages:", e);
    throw e;
  }

  const uniqueEntries = Array.from(new Map(entries.map(entry => [entry.url, entry])).values());
  return uniqueEntries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await getSitemapEntries();
  } catch (error) {
    console.error("SITEMAP_GENERATION_ERROR: Failed to generate sitemap entries:", error);
    const appBaseUrl = getBaseUrl(); // Use helper even in fallback
    return [
      {
        url: appBaseUrl,
        lastModified: new Date().toISOString(),
        changeFrequency: 'yearly',
        priority: 0.1,
      },
    ];
  }
}
