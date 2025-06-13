
"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Edit, Trash2, Layers, Loader2 } from "lucide-react";
import type { FirestoreSubCategory, FirestoreCategory } from '@/types/firestore';
import SubCategoryForm from '@/components/admin/SubCategoryForm';
import { getOverriddenCategoryName } from '@/lib/adminDataOverrides';
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

export default function AdminSubCategoriesPage() {
  const [subCategories, setSubCategories] = useState<FirestoreSubCategory[]>([]);
  const [parentCategories, setParentCategories] = useState<FirestoreCategory[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<FirestoreSubCategory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  const subCategoriesCollectionRef = collection(db, "adminSubCategories");
  const categoriesCollectionRef = collection(db, "adminCategories");

  const fetchParentCategories = async () => {
    try {
      const q = query(categoriesCollectionRef, orderBy("order", "asc"));
      const data = await getDocs(q);
      const fetchedCategories = data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreCategory));
      setParentCategories(fetchedCategories);
    } catch (error) {
      console.error("Error fetching parent categories: ", error);
      toast({
        title: "Error",
        description: "Could not fetch parent categories.",
        variant: "destructive",
      });
    }
  };

  const fetchSubCategories = async () => {
    setIsLoading(true);
    try {
      const q = query(subCategoriesCollectionRef, orderBy("order", "asc"));
      const data = await getDocs(q);
      const fetchedSubCategories = data.docs.map((doc) => ({ ...doc.data(), id: doc.id } as FirestoreSubCategory));
      setSubCategories(fetchedSubCategories);
    } catch (error) {
      console.error("Error fetching sub-categories: ", error);
      toast({
        title: "Error",
        description: "Could not fetch sub-categories.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    Promise.all([fetchParentCategories(), fetchSubCategories()]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'fixbroCategoryNameOverrides') {
        fetchParentCategories();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isMounted]);


  const handleAddSubCategory = () => {
    setEditingSubCategory(null);
    setIsFormOpen(true);
  };

  const handleEditSubCategory = (subCategory: FirestoreSubCategory) => {
    setEditingSubCategory(subCategory);
    setIsFormOpen(true);
  };

  const handleDeleteSubCategory = async (subCategoryId: string) => {
    setIsSubmitting(true);
    try {
      const subCategoryDocRef = doc(db, "adminSubCategories", subCategoryId);
      const subCategorySnap = await getDoc(subCategoryDocRef);
      const subCategoryData = subCategorySnap.data() as FirestoreSubCategory | undefined;

      if (subCategoryData?.imageUrl && isFirebaseStorageUrl(subCategoryData.imageUrl)) {
        try {
          const imageToDeleteRef = storageRef(storage, subCategoryData.imageUrl);
          await deleteObject(imageToDeleteRef);
          toast({ title: "Image Deleted", description: "Associated image removed from storage." });
        } catch (imgError: any) {
          console.warn("Error deleting image from Firebase Storage during sub-category delete:", imgError);
          toast({ title: "Image Deletion Warning", description: `Sub-category will be deleted, but failed to remove image: ${imgError.message}`, variant: "default", duration: 7000 });
        }
      }

      await deleteDoc(subCategoryDocRef);

      setSubCategories(subCategories.filter(sub => sub.id !== subCategoryId));
      toast({ title: "Success", description: "Sub-category deleted successfully." });
    } catch (error) {
      console.error("Error deleting sub-category: ", error);
      toast({ title: "Error", description: "Could not delete sub-category.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = async (data: Omit<FirestoreSubCategory, 'id' | 'createdAt'> & { id?: string, slug?: string }) => {
    setIsSubmitting(true);

    let finalSlugForSave = "";
    const baseNameSlug = generateSlug(data.name);

    if (editingSubCategory && data.id) { // Editing existing
      finalSlugForSave = editingSubCategory.slug;
    } else { // Creating new
      const wasSlugManuallyEntered = !!data.slug && data.slug.trim() !== "";
      let slugToCheck = wasSlugManuallyEntered ? data.slug!.trim() : baseNameSlug;
      
      if (!slugToCheck && !baseNameSlug) {
        toast({ title: "Invalid Name", description: "Sub-category name must be valid to generate a slug.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }
      if (!slugToCheck) slugToCheck = baseNameSlug;

      let isUnique = false;
      let attempt = 0;
      const originalSlugToIterate = wasSlugManuallyEntered ? slugToCheck : baseNameSlug;

      while (!isUnique) {
        const q = query(subCategoriesCollectionRef, where("slug", "==", slugToCheck), where("parentId", "==", data.parentId));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          isUnique = true;
          finalSlugForSave = slugToCheck;
        } else {
          if (wasSlugManuallyEntered && attempt === 0) { 
            toast({ title: "Slug Exists", description: `The slug "${slugToCheck}" is already in use for this parent category. Please choose another.`, variant: "destructive" });
            setIsSubmitting(false);
            return; 
          }
          attempt++;
          slugToCheck = `${baseNameSlug}-${attempt + 1}`;
        }
      }
    }

    const payloadForFirestore: Omit<FirestoreSubCategory, 'id' | 'createdAt'> = {
      name: data.name,
      slug: finalSlugForSave,
      parentId: data.parentId,
      order: Number(data.order),
      imageUrl: data.imageUrl || "",
      imageHint: data.imageHint || "",
      h1_title: data.h1_title || undefined,
      seo_title: data.seo_title || undefined,
      seo_description: data.seo_description || undefined,
      seo_keywords: data.seo_keywords || undefined,
    };

    try {
      if (editingSubCategory && data.id) {
        const subCategoryDoc = doc(db, "adminSubCategories", data.id);
        await updateDoc(subCategoryDoc, { ...payloadForFirestore, updatedAt: Timestamp.now() } as any);
        toast({ title: "Success", description: "Sub-category updated successfully." });
      } else {
        await addDoc(subCategoriesCollectionRef, { ...payloadForFirestore, createdAt: Timestamp.now() });
        toast({ title: "Success", description: "Sub-category added successfully." });
      }
      setIsFormOpen(false);
      setEditingSubCategory(null);
      await fetchSubCategories();
    } catch (error) {
      console.error("Error saving sub-category: ", error);
      toast({ title: "Error", description: (error as Error).message || "Could not save sub-category.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getParentCategoryNameDisplay = (parentId: string) => {
    const parent = parentCategories.find(cat => cat.id === parentId);
    if (!parent) return 'Unknown Parent';
    return getOverriddenCategoryName(parentId, parent.name);
  };

  if (!isMounted) {
     return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center"><Layers className="mr-2 h-6 w-6 text-primary" /> Manage Sub-Categories</CardTitle>
              <CardDescription>Loading sub-categories...</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="animate-pulse h-10 bg-muted rounded w-full"></div>
             <div className="animate-pulse h-20 bg-muted rounded w-full mt-4"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-2xl flex items-center"><Layers className="mr-2 h-6 w-6 text-primary" /> Manage Sub-Categories</CardTitle>
            <CardDescription>Add, edit, or delete service sub-categories. Manage images and SEO fields.</CardDescription>
          </div>
          <Button onClick={handleAddSubCategory} disabled={isSubmitting || isLoading || parentCategories.length === 0} className="w-full sm:w-auto">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Sub-Category
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          {isLoading && parentCategories.length === 0 ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading data...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Image</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Parent Category</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>H1 Title</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                   <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <div className="flex justify-center items-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="ml-2">Loading sub-categories...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : subCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No sub-categories found. Add one to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subCategories.map((subCategory) => {
                    const IconComponent = getIconComponent(undefined);
                    return (
                      <TableRow key={subCategory.id}>
                        <TableCell>
                          {subCategory.imageUrl ? (
                            <div className="w-10 h-10 relative rounded-md overflow-hidden">
                              <Image
                                src={subCategory.imageUrl}
                                alt={subCategory.name}
                                fill
                                sizes="40px"
                                className="object-cover"
                                data-ai-hint={subCategory.imageHint || "sub-category"}
                              />
                            </div>
                          ) : (
                            <IconComponent className="h-6 w-6 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{subCategory.name}</TableCell>
                        <TableCell>{getParentCategoryNameDisplay(subCategory.parentId)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{subCategory.slug}</TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={subCategory.h1_title}>{subCategory.h1_title || "Not set"}</TableCell>
                        <TableCell className="text-center">{subCategory.order}</TableCell>
                        <TableCell>
                          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-2 sm:justify-end">
                            <Button variant="outline" size="icon" onClick={() => handleEditSubCategory(subCategory)} disabled={isSubmitting}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="icon" disabled={isSubmitting}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the sub-category
                                    {subCategory.imageUrl && isFirebaseStorageUrl(subCategory.imageUrl) ? " and its associated image from storage." : "."}
                                    {" "}Services under this sub-category might be affected.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteSubCategory(subCategory.id)}
                                    disabled={isSubmitting}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Delete
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

      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!isSubmitting) { setIsFormOpen(open); if (!open) setEditingSubCategory(null); } }}>
        <DialogContent className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle>{editingSubCategory ? 'Edit Sub-Category' : 'Add New Sub-Category'}</DialogTitle>
             <DialogDescription>
              {editingSubCategory ? 'Update the details for this sub-category.' : 'Fill in the details to create a new sub-category.'}
            </DialogDescription>
          </DialogHeader>
          {parentCategories.length === 0 && !isLoading ? (
             <div className="py-8 text-center">
                <p className="text-destructive">Cannot add sub-categories because no parent categories exist.</p>
                <p className="text-muted-foreground text-sm mt-2">Please add at least one category first.</p>
             </div>
          ) : (
            <SubCategoryForm
              onSubmit={handleFormSubmit}
              initialData={editingSubCategory}
              parentCategories={parentCategories}
              onCancel={() => {
                setIsFormOpen(false);
                setEditingSubCategory(null);
              }}
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
    
