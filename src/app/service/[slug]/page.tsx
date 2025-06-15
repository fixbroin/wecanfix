
import ServiceDetailPageClient from '@/components/service/ServiceDetailPageClient';
import { db } from '@/lib/firebase';
import type { FirestoreService, ClientServiceData, FirestoreCategory, FirestoreSubCategory } from '@/types/firestore';
import { collection, query, where, getDocs, limit, Timestamp, doc, getDoc } from 'firebase/firestore'; 

interface ServicePageProps {
  params: { slug: string };
}

// Metadata generation is handled by src/app/service/[slug]/layout.tsx

async function getServiceData(slug: string): Promise<ClientServiceData | null> {
  try {
    const servRef = collection(db, 'adminServices');
    const q = query(servRef, where('slug', '==', slug), where('isActive', '==', true), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const serviceDoc = snapshot.docs[0];
    const serviceDocData = serviceDoc.data() as FirestoreService | undefined;
    if (!serviceDocData) return null; 

    const serviceId = serviceDoc.id;

    let parentCategoryName: string | undefined;
    let parentCategorySlug: string | undefined;

    if (serviceDocData.subCategoryId) {
        const subCatDoc = await getDoc(doc(db, "adminSubCategories", serviceDocData.subCategoryId));
        if (subCatDoc.exists()) {
            const subCategory = subCatDoc.data() as FirestoreSubCategory | undefined;
            if (subCategory && subCategory.parentId) { // Check if subCategory and its parentId exist
                const catDoc = await getDoc(doc(db, "adminCategories", subCategory.parentId));
                if (catDoc.exists()) {
                    const category = catDoc.data() as FirestoreCategory | undefined;
                    if (category) { // Check if category data exists
                        parentCategoryName = category.name;
                        parentCategorySlug = category.slug;
                    }
                }
            }
        }
    }

    const clientData: ClientServiceData = {
      ...serviceDocData, 
      id: serviceId, 
      parentCategoryName,
      parentCategorySlug,
    };
    
    if (serviceDocData.createdAt && serviceDocData.createdAt instanceof Timestamp) {
      clientData.createdAt = serviceDocData.createdAt.toDate().toISOString();
    } else if (serviceDocData.createdAt) {
      clientData.createdAt = String(serviceDocData.createdAt);
    }

    if (serviceDocData.updatedAt && serviceDocData.updatedAt instanceof Timestamp) {
      clientData.updatedAt = serviceDocData.updatedAt.toDate().toISOString();
    } else if (serviceDocData.updatedAt) {
      clientData.updatedAt = String(serviceDocData.updatedAt);
    }

    return clientData;

  } catch (error) {
    console.error('Error fetching service data for page component:', error);
    return null;
  }
}

export async function generateStaticParams() {
  try {
    const servicesSnapshot = await getDocs(query(collection(db, 'adminServices'), where('isActive', '==', true)));
    const paths = servicesSnapshot.docs
      .map(doc => {
        const serviceData = doc.data() as FirestoreService;
        return { slug: serviceData.slug };
      })
      .filter(p => p.slug); // Ensure slug exists and is truthy

    if (paths.length === 0) {
        console.warn("[ServicePage] generateStaticParams: No active service slugs found. This might mean no static service pages will be generated for /service/[slug] routes.");
    }
    return paths;
  } catch (error) {
    console.error("[ServicePage] Error generating static params for /service/[slug] pages:", error);
    return []; // Return empty array on error to prevent build failure
  }
}

export default async function ServicePage({ params }: ServicePageProps) {
  const serviceData = await getServiceData(params.slug);
  const h1Title = serviceData?.h1_title || serviceData?.name || "Service Details";

  return <ServiceDetailPageClient serviceSlug={params.slug} initialServiceData={serviceData} initialH1Title={h1Title} />;
}

