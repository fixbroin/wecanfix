
import type { Metadata, ResolvingMetadata } from 'next';
import { doc, getDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FirestoreCategory, FirestoreCity, FirestoreArea, FirestoreSEOSettings, GlobalWebSettings } from '@/types/firestore';
import { getGlobalSEOSettings, replacePlaceholders } from '@/lib/seoUtils';
import CategoryPageClient from '@/components/category/CategoryPageClient';
import type { BreadcrumbItem } from '@/types/ui';
import { getBaseUrl } from '@/lib/config'; // Import the helper

export const dynamic = 'force-dynamic'; // Ensure metadata is fetched on each request

interface AreaCategoryPageProps {
  params: { city: string; area: string; categorySlug: string };
}

// Helper function to get city data
async function getCityData(citySlug: string): Promise<FirestoreCity | null> {
  try {
    const citiesRef = collection(db, 'cities');
    const cityQuery = query(citiesRef, where('slug', '==', citySlug), where('isActive', '==', true), limit(1));
    const citySnapshot = await getDocs(cityQuery);
    if (citySnapshot.empty) {
      // console.warn(`[AreaCategoryPage] Metadata: City not found or inactive for slug: ${citySlug}`);
      return null;
    }
    return { id: citySnapshot.docs[0].id, ...citySnapshot.docs[0].data() } as FirestoreCity;
  } catch (error) {
    console.error(`[AreaCategoryPage] Metadata: Error fetching city data for slug ${citySlug}:`, error);
    return null;
  }
}

// Helper function to get area data
async function getAreaData(cityId: string, areaSlug: string): Promise<FirestoreArea | null> {
  try {
    const areasRef = collection(db, 'areas');
    const areaQuery = query(areasRef, where('cityId', '==', cityId), where('slug', '==', areaSlug), where('isActive', '==', true), limit(1));
    const areaSnapshot = await getDocs(areaQuery);
    if (areaSnapshot.empty) {
      // console.warn(`[AreaCategoryPage] Metadata: Area not found or inactive for cityId ${cityId} and slug ${areaSlug}`);
      return null;
    }
    return { id: areaSnapshot.docs[0].id, ...areaSnapshot.docs[0].data() } as FirestoreArea;
  } catch (error) {
    console.error(`[AreaCategoryPage] Metadata: Error fetching area data for cityId ${cityId}, slug ${areaSlug}:`, error);
    return null;
  }
}

// Helper function to get category data
async function getCategoryData(categorySlug: string): Promise<FirestoreCategory | null> {
  try {
    const categoriesRef = collection(db, 'adminCategories');
    const categoryQuery = query(categoriesRef, where('slug', '==', categorySlug), limit(1));
    const categorySnapshot = await getDocs(categoryQuery);
    if (categorySnapshot.empty) {
      // console.warn(`[AreaCategoryPage] Metadata: Category not found for slug: ${categorySlug}`);
      return null;
    }
    return { id: categorySnapshot.docs[0].id, ...categorySnapshot.docs[0].data() } as FirestoreCategory;
  } catch (error) {
    console.error(`[AreaCategoryPage] Metadata: Error fetching category data for slug ${categorySlug}:`, error);
    return null;
  }
}

async function getGlobalWebsiteSettings(): Promise<GlobalWebSettings | null> {
    try {
        const settingsDocRef = doc(db, "webSettings", "global");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) { return docSnap.data() as GlobalWebSettings; }
        // console.warn("[AreaCategoryPage] Metadata: Global web settings not found.");
        return null;
    } catch (error) { 
        console.error("[AreaCategoryPage] Metadata: Error fetching global web settings:", error); 
        return null; 
    }
}

export async function generateMetadata(
  { params }: AreaCategoryPageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { city: citySlug, area: areaSlug, categorySlug: catSlug } = params; // Destructure params

  const cityData = await getCityData(citySlug);
  const areaData = cityData ? await getAreaData(cityData.id, areaSlug) : null;
  const categoryData = await getCategoryData(catSlug);
  
  const seoSettings = await getGlobalSEOSettings();
  const webSettings = await getGlobalWebsiteSettings();
  const resolvedParent = await parent;
  const siteName = resolvedParent.openGraph?.siteName || seoSettings.siteName || "FixBro";
  const defaultSuffix = seoSettings.defaultMetaTitleSuffix || ` - ${siteName}`;
  const appBaseUrl = getBaseUrl(); // Use the helper

  if (!cityData || !areaData || !categoryData) {
    let missingItems: string[] = [];
    if (!cityData) missingItems.push(`city "${citySlug}"`);
    if (cityData && !areaData) missingItems.push(`area "${areaSlug}" (under city "${citySlug}")`);
    else if (!cityData && !areaData) missingItems.push(`area "${areaSlug}" (city "${citySlug}" also not found)`);
    if (!categoryData) missingItems.push(`category "${catSlug}"`);
    
    // console.warn(`[AreaCategoryPage] generateMetadata: Content not found for ${missingItems.join(', ')}. Params: city=${citySlug}, area=${areaSlug}, category=${catSlug}`);
    return {
      title: `Content Not Found${defaultSuffix}`,
      description: 'The page you are looking for does not exist or parameters are invalid.',
    };
  }

  const placeholderData = {
    areaName: areaData.name,
    cityName: cityData.name,
    categoryName: categoryData.name,
    siteName: siteName,
  };

  const title = replacePlaceholders(seoSettings.areaCategoryPageTitlePattern, placeholderData) || 
                replacePlaceholders(seoSettings.cityCategoryPageTitlePattern, placeholderData) || 
                replacePlaceholders(seoSettings.categoryPageTitlePattern, placeholderData) || 
                `${categoryData.name} in ${areaData.name}, ${cityData.name}${defaultSuffix}`;

  const description = replacePlaceholders(seoSettings.areaCategoryPageDescriptionPattern, placeholderData) ||
                      replacePlaceholders(seoSettings.cityCategoryPageDescriptionPattern, placeholderData) ||
                      replacePlaceholders(seoSettings.categoryPageDescriptionPattern, placeholderData) ||
                      `Find ${categoryData.name} services in ${areaData.name}, ${cityData.name}. ${seoSettings.defaultMetaDescription || ""}`;

  const keywordsStr = replacePlaceholders(seoSettings.areaCategoryPageKeywordsPattern, placeholderData) ||
                      replacePlaceholders(seoSettings.cityCategoryPageKeywordsPattern, placeholderData) ||
                      replacePlaceholders(seoSettings.categoryPageKeywordsPattern, placeholderData) ||
                      seoSettings.defaultMetaKeywords;
  const keywords = keywordsStr?.split(',').map(k => k.trim()).filter(k => k);
  
  const ogImageFromWebSettings = webSettings?.websiteIconUrl || webSettings?.logoUrl;
  const ogImage = categoryData.imageUrl || ogImageFromWebSettings || seoSettings.structuredDataImage || `${appBaseUrl}/default-og-image.png`;
  const canonicalUrl = `${appBaseUrl}/${citySlug}/${areaSlug}/${catSlug}`;

  return {
    title,
    description,
    keywords: keywords && keywords.length > 0 ? keywords : undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: ogImage ? [{ url: ogImage }] : [],
      siteName,
      type: 'website',
    },
  };
}

export async function generateStaticParams() {
  try {
    const citiesSnapshot = await getDocs(query(collection(db, 'cities'), where('isActive', '==', true)));
    const categoriesSnapshot = await getDocs(query(collection(db, 'adminCategories'))); 
    const paramsArray: { city: string; area: string; categorySlug: string }[] = [];

    for (const cityDoc of citiesSnapshot.docs) {
      const cityData = cityDoc.data() as FirestoreCity;
      if (!cityData.slug) {
        // console.warn(`[AreaCategoryPage] generateStaticParams: Skipping city ID ${cityDoc.id} due to missing slug.`);
        continue;
      }
      const areasQuery = query(collection(db, 'areas'), where('cityId', '==', cityDoc.id), where('isActive', '==', true));
      const areasSnapshot = await getDocs(areasQuery);

      if (areasSnapshot.empty) {
        // console.log(`[AreaCategoryPage] generateStaticParams: No active areas found for city ${cityData.slug}. Skipping category combinations for this city.`);
        continue; 
      }

      for (const areaDoc of areasSnapshot.docs) {
        const areaData = areaDoc.data() as FirestoreArea;
        if (!areaData.slug) {
          // console.warn(`[AreaCategoryPage] generateStaticParams: Skipping area ID ${areaDoc.id} under city ${cityData.slug} due to missing slug.`);
          continue;
        }
        categoriesSnapshot.docs.forEach(categoryDoc => {
          const categoryData = categoryDoc.data() as FirestoreCategory;
          if (categoryData.slug) {
            paramsArray.push({ city: cityData.slug!, area: areaData.slug!, categorySlug: categoryData.slug });
          } else {
            // console.warn(`[AreaCategoryPage] generateStaticParams: Skipping category ID ${categoryDoc.id} due to missing slug.`);
          }
        });
      }
    }
    if (paramsArray.length === 0) {
        // console.warn("[AreaCategoryPage] generateStaticParams: No valid city/area/category combinations found.");
    }
    return paramsArray;
  } catch (error) {
    console.error("[AreaCategoryPage] Error generating static params for area-category pages:", error);
    return []; 
  }
}

export default async function AreaCategoryPage({ params }: AreaCategoryPageProps) {
  const { city: citySlug, area: areaSlug, categorySlug: catSlug } = params; // Destructure params

  const cityData = await getCityData(citySlug);
  const areaData = cityData ? await getAreaData(cityData.id, areaSlug) : null;
  const categoryData = await getCategoryData(catSlug);

  const breadcrumbItems: BreadcrumbItem[] = [{ label: "Home", href: "/" }];
  if (cityData) {
    breadcrumbItems.push({ label: cityData.name, href: `/${citySlug}` });
    if (areaData) {
      breadcrumbItems.push({ label: areaData.name, href: `/${citySlug}/${areaSlug}` });
    }
  }
  if (categoryData) {
    breadcrumbItems.push({ label: categoryData.name });
  } else if (cityData && areaData) { 
    breadcrumbItems.push({ label: "Category Not Found" });
  }

  return <CategoryPageClient categorySlug={catSlug} citySlug={citySlug} areaSlug={areaSlug} breadcrumbItems={breadcrumbItems} />;
}
