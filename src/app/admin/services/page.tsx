
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, ShoppingBag, CheckCircle, XCircle, Loader2, Percent } from "lucide-react";
import type { FirestoreService, FirestoreSubCategory, FirestoreTax } from '@/types/firestore';
import ServiceForm from '@/components/admin/ServiceForm';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, query, Timestamp, where } from "firebase/firestore";
import { ref as storageRef, deleteObject } from "firebase/storage";
import { useToast } from "@/hooks/use-toast";
import { getIconComponent } from '@/lib/iconMap';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";



const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const isFirebaseStorageUrl = (url: string): boolean => {
  if (!url) return false;
  return typeof url === 'string' && url.includes("firebasestorage.googleapis.com");
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<FirestoreService[]>([]);
  const [subCategories, setSubCategories] = useState<FirestoreSubCategory[]>([]);
  const [taxes, setTaxes] = useState<FirestoreTax[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<FirestoreService | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const servicesCollectionRef = collection(db, "adminServices");
  const subCategoriesCollectionRef = collection(db, "adminSubCategories");
  const taxesCollectionRef = collection(db, "adminTaxes");

  const fetchSubCategoriesAndTaxes = async () => {
    try {
      const subCatQuery = query(subCategoriesCollectionRef, orderBy("name", "asc"));
      const subCatData = await getDocs(subCatQuery);
      const fetchedSubCategories = subCatData.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreSubCategory));
      setSubCategories(fetchedSubCategories);

      const taxQuery = query(taxesCollectionRef, where("isActive", "==", true), orderBy("taxName", "asc"));
      const taxData = await getDocs(taxQuery);
      const fetchedTaxes = taxData.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreTax));
      setTaxes(fetchedTaxes);

    } catch (error) {
      console.error("Error fetching sub-categories or taxes: ", error);
      toast({
        title: "Error",
        description: "Could not fetch sub-categories or tax configurations.",
        variant: "destructive",
      });
    }
  };

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const q = query(servicesCollectionRef, orderBy("name", "asc"));
      const data = await getDocs(q);
      const fetchedServices = data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreService));
      setServices(fetchedServices);
    } catch (error) {
      console.error("Error fetching services: ", error);
      toast({
        title: "Error",
        description: "Could not fetch services.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    Promise.all([fetchSubCategoriesAndTaxes(), fetchServices()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddService = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const handleEditService = (service: FirestoreService) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleDeleteService = async (serviceId: string) => {
    setIsSubmitting(true);
    try {
      const serviceDocRef = doc(db, "adminServices", serviceId);
      const serviceSnap = await getDoc(serviceDocRef);
      const serviceData = serviceSnap.data() as FirestoreService | undefined;

      if (serviceData?.imageUrl && isFirebaseStorageUrl(serviceData.imageUrl)) {
        try {
          const imageToDeleteRef = storageRef(storage, serviceData.imageUrl);
          await deleteObject(imageToDeleteRef);
        } catch (imgError: any) {
          console.warn("Error deleting image from Firebase Storage during service delete:", imgError);
        }
      }

      await deleteDoc(serviceDocRef);

      setServices(services.filter(serv => serv.id !== serviceId));
      toast({ title: "Success", description: "Service deleted successfully." });
    } catch (error) {
      console.error("Error deleting service: ", error);
      toast({ title: "Error", description: "Could not delete service.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: Omit<FirestoreService, 'id' | 'createdAt'> & { id?: string }) => {
    setIsSubmitting(true);

    let finalSlugForSave = data.slug || generateSlug(data.name);
    const selectedTax = taxes.find(t => t.id === data.taxId);

    if (!editingService?.id) { // Creating a new service
        let slugToCheck = finalSlugForSave;
        if (!slugToCheck) {
            toast({ title: "Invalid Name/Slug", description: "Service name must be valid to generate a slug if slug is empty.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        
        const wasSlugManuallyEntered = !!data.slug;
        let attempt = 0;
        const baseSlugFromName = generateSlug(data.name); 

        while (true) {
            const q = query(servicesCollectionRef, where("slug", "==", slugToCheck), where("subCategoryId", "==", data.subCategoryId));
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                finalSlugForSave = slugToCheck;
                break; 
            } else {
                if (wasSlugManuallyEntered && attempt === 0) {
                    toast({ title: "Slug Exists", description: `The slug "${slugToCheck}" is already in use for this sub-category. Please choose another.`, variant: "destructive" });
                    setIsSubmitting(false);
                    return;
                }
                attempt++;
                slugToCheck = `${baseSlugFromName}-${attempt + 1}`; 
            }
        }
    } else { 
      finalSlugForSave = editingService!.slug;
    }
    

    const payloadForFirestore: Partial<FirestoreService> = {
      name: data.name,
      slug: finalSlugForSave,
      subCategoryId: data.subCategoryId,
      description: data.description,
      price: Number(data.price),
      isTaxInclusive: data.isTaxInclusive,
      discountedPrice: (data.discountedPrice !== undefined && data.discountedPrice !== null) ? Number(data.discountedPrice) : undefined,
      rating: Number(data.rating || 0),
      reviewCount: Number(data.reviewCount || 0),
      isActive: data.isActive === undefined ? true : data.isActive,
      imageUrl: data.imageUrl || "",
      imageHint: data.imageHint || "",
      shortDescription: data.shortDescription || undefined,
      fullDescription: data.fullDescription || undefined,
      serviceHighlights: data.serviceHighlights || [],
      taxId: data.taxId,
      taxName: selectedTax?.taxName,
      taxPercent: selectedTax?.taxPercent,
      h1_title: data.h1_title || undefined,
      seo_title: data.seo_title || undefined,
      seo_description: data.seo_description || undefined,
      seo_keywords: data.seo_keywords || undefined,
    };

    try {
      if (editingService && data.id) {
        const serviceDoc = doc(db, "adminServices", data.id);
        const updateData = {
          ...payloadForFirestore,
          updatedAt: Timestamp.now(),
        };
        delete (updateData as any).id;
        
        await updateDoc(serviceDoc, updateData);
        toast({ title: "Success", description: "Service updated successfully." });
      } else {
        const newServicePayload = {
          ...payloadForFirestore,
          createdAt: Timestamp.now()
        };
        await addDoc(servicesCollectionRef, newServicePayload as FirestoreService);
        toast({ title: "Success", description: "Service added successfully." });
      }
      setIsFormOpen(false);
      setEditingService(null);
      await fetchServices();
    } catch (error) {
      console.error("Error saving service: ", error);
      toast({ title: "Error", description: (error as Error).message || "Could not save service.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSubCategoryName = (subCategoryId: string) => {
    const sub = subCategories.find(sc => sc.id === subCategoryId);
    return sub ? sub.name : 'Unknown';
  };

  if (!isMounted) {
     return (
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Manage Services</CardTitle><CardDescription>Loading...</CardDescription></CardHeader>
          <CardContent><div className="animate-pulse h-64 bg-muted rounded"></div></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-2xl flex items-center"><ShoppingBag className="mr-2 h-6 w-6 text-primary" /> Manage Services</CardTitle>
            <CardDescription>Add, edit, or delete services. Configure details, pricing, images, SEO, and taxes.</CardDescription>
          </div>
          <Button onClick={handleAddService} disabled={isSubmitting || isLoading || subCategories.length === 0} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Service
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading && (subCategories.length === 0 || taxes.length === 0) ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading prerequisite data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Sub-Category</TableHead>
                  <TableHead className="text-right">Price (₹)</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                 {isLoading ? (
                   <TableRow><TableCell colSpan={8} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                ) : services.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No services found.</TableCell></TableRow>
                ) : (
                  services.map((service) => {
                    const IconComponent = getIconComponent(undefined);
                    return (
                      <TableRow key={service.id}>
                        <TableCell>
                          {service.imageUrl ? (
                            <div className="w-10 h-10 relative rounded-md overflow-hidden">
                              <Image src={service.imageUrl} alt={service.name} fill sizes="40px" className="object-cover" data-ai-hint={service.imageHint || "service"}/>
                            </div>
                          ) : ( <IconComponent className="h-6 w-6 text-muted-foreground" /> )}
                        </TableCell>
                        <TableCell className="font-medium">{service.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{service.slug}</TableCell>
                        <TableCell>{getSubCategoryName(service.subCategoryId)}</TableCell>
                        <TableCell className="text-right">{service.price.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs">
                          {service.taxName ? `${service.taxName} (${service.taxPercent}%)` : 'N/A'}
                        </TableCell>
                        <TableCell className="text-center">
                          {service.isActive ? <CheckCircle className="h-5 w-5 text-green-500 mx-auto" /> : <XCircle className="h-5 w-5 text-red-500 mx-auto" />}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                            <Button variant="outline" size="icon" onClick={() => handleEditService(service)} disabled={isSubmitting}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="icon" disabled={isSubmitting}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{service.name}".</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteService(service.id)} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) setEditingService(null); } }}>
        <DialogContent className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[90vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>{editingService ? 'Edit Service' : 'Add New Service'}</DialogTitle>
            <DialogDescription>{editingService ? 'Update details.' : 'Fill in details for a new service.'}</DialogDescription>
          </DialogHeader>
          {(subCategories.length === 0 && !editingService) && !isLoading ? (
             <div className="p-6 py-8 text-center">
                <p className="text-destructive">
                  {subCategories.length === 0 && "No sub-categories exist. "}
                </p>
                <p className="text-muted-foreground text-sm mt-2">
                  Please add {subCategories.length === 0 ? "sub-categories" : ""} first.
                </p>
             </div>
          ) : (
            <ServiceForm
              onSubmit={handleFormSubmit}
              initialData={editingService}
              subCategories={subCategories}
              taxes={taxes}
              onCancel={() => { setIsFormOpen(false); setEditingService(null); }}
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
    
    
