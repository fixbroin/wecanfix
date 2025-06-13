
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { FirestoreService, FirestoreSubCategory, FirestoreTax } from '@/types/firestore';
import { useEffect, useState, useRef } from "react";
import { Loader2, Image as ImageIcon, Trash2, PlusCircle, Percent } from "lucide-react";
import NextImage from 'next/image';
import { useToast } from "@/hooks/use-toast";
import { storage } from '@/lib/firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const serviceFormSchema = z.object({
  name: z.string().min(3, { message: "Service name must be at least 3 characters." }),
  slug: z.string().min(3, "Slug must be at least 3 characters.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format (e.g., my-service-name).").optional().or(z.literal('')),
  subCategoryId: z.string({ required_error: "Please select a sub-category." }),
  price: z.coerce.number().positive({ message: "Price must be a positive number." }),
  discountedPrice: z.coerce.number().nonnegative({ message: "Discounted price must be non-negative." }).optional().nullable(),
  description: z.string().min(10, { message: "Description must be at least 10 characters." }).max(200, { message: "Description must be 200 characters or less."}),
  shortDescription: z.string().max(300, {message: "Short description max 300 chars."}).optional().nullable(),
  fullDescription: z.string().optional().nullable(),
  serviceHighlights: z.array(
    z.string()
      .min(5, { message: "Highlight must be at least 5 characters." })
      .max(150, { message: "Highlight must be 150 characters or less." })
  ).optional(),
  imageUrl: z.string().url({ message: "Must be a valid URL if provided." }).optional().or(z.literal('')),
  imageHint: z.string().max(50, { message: "Image hint should be max 50 characters."}).optional().or(z.literal('')),
  rating: z.coerce.number().min(0).max(5).default(0),
  reviewCount: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
  taxId: z.string().nullable().optional(),
  isTaxInclusive: z.enum(["true", "false"], { required_error: "Please select tax type."}).default("false"),
  h1_title: z.string().max(100, "H1 title too long.").optional().or(z.literal('')),
  seo_title: z.string().max(70, "Meta title too long.").optional().or(z.literal('')),
  seo_description: z.string().max(300, "Meta description too long.").optional().or(z.literal('')),
  seo_keywords: z.string().optional().or(z.literal('')),
});

type ServiceFormDataInternal = z.infer<typeof serviceFormSchema>;

interface ServiceFormProps {
  onSubmit: (data: Omit<FirestoreService, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  initialData?: FirestoreService | null;
  onCancel: () => void;
  subCategories: FirestoreSubCategory[];
  taxes: FirestoreTax[];
  isSubmitting?: boolean;
}

const isFirebaseStorageUrl = (url: string): boolean => {
  if (!url) return false;
  return typeof url === 'string' && url.includes("firebasestorage.googleapis.com");
};

const generateRandomHexString = (length: number) => {
  return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');
};

const isValidImageSrc = (url: string | null | undefined): url is string => {
    if (!url || url.trim() === '') return false;
    if (url.startsWith('blob:') || url.startsWith('data:') || url.startsWith('http:') || url.startsWith('https:') || url.startsWith('/')) {
        try {
            if (url.startsWith('http:') || url.startsWith('https:')) {
                new URL(url);
            }
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
};

const NO_TAX_VALUE = "__NO_TAX__";

export default function ServiceForm({ onSubmit: onSubmitProp, initialData, onCancel, subCategories, taxes, isSubmitting: isParentSubmitting = false }: ServiceFormProps) {
  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [originalImageUrlFromInitialData, setOriginalImageUrlFromInitialData] = useState<string | null>(null);
  
  const [isFormBusyForImage, setIsFormBusyForImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const form = useForm<ServiceFormDataInternal>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      name: "", slug: "", subCategoryId: undefined, price: 0, discountedPrice: undefined,
      description: "", shortDescription: "", fullDescription: "", serviceHighlights: [],
      imageUrl: "", imageHint: "", rating: 0, reviewCount: 0, isActive: true,
      taxId: null, isTaxInclusive: "false", 
      h1_title: "", seo_title: "", seo_description: "", seo_keywords: "",
    },
  });

  const { fields: highlightFields, append: appendHighlight, remove: removeHighlight } = useFieldArray({
    control: form.control,
    name: "serviceHighlights"
  });

  const watchedName = form.watch("name");
  const watchedImageHint = form.watch("imageHint");
  const watchedTaxId = form.watch("taxId");
  const taxSelected = watchedTaxId !== null && watchedTaxId !== NO_TAX_VALUE;

  useEffect(() => {
    if (initialData) {
      const hasActualTaxIdInInitial = !!(initialData.taxId && initialData.taxId !== NO_TAX_VALUE);
      const isTaxInclusiveForForm = (hasActualTaxIdInInitial && initialData.isTaxInclusive === true) ? "true" : "false";
      
      form.reset({
        name: initialData.name || "",
        slug: initialData.slug || "",
        subCategoryId: initialData.subCategoryId || undefined,
        price: initialData.price || 0,
        discountedPrice: initialData.discountedPrice === undefined || initialData.discountedPrice === null ? null : initialData.discountedPrice,
        description: initialData.description || "",
        shortDescription: initialData.shortDescription || "",
        fullDescription: initialData.fullDescription || "",
        serviceHighlights: initialData.serviceHighlights || [],
        imageUrl: initialData.imageUrl || "",
        imageHint: initialData.imageHint || "",
        rating: initialData.rating || 0,
        reviewCount: initialData.reviewCount || 0,
        isActive: initialData.isActive === undefined ? true : initialData.isActive,
        taxId: initialData.taxId || null,
        isTaxInclusive: isTaxInclusiveForForm,
        h1_title: initialData.h1_title || "",
        seo_title: initialData.seo_title || "",
        seo_description: initialData.seo_description || "",
        seo_keywords: initialData.seo_keywords || "",
      });
      setCurrentImagePreview(initialData.imageUrl || null);
      setOriginalImageUrlFromInitialData(initialData.imageUrl || null);
    } else {
      form.reset({
        name: "", slug: "", subCategoryId: undefined, price: 0, discountedPrice: null,
        description: "", shortDescription: "", fullDescription: "", serviceHighlights: [],
        imageUrl: "", imageHint: "", rating: 0, reviewCount: 0, isActive: true,
        taxId: null, isTaxInclusive: "false", 
        h1_title: "", seo_title: "", seo_description: "", seo_keywords: "",
      });
      setCurrentImagePreview(null);
      setOriginalImageUrlFromInitialData(null);
    }
    setSelectedFile(null);
    setUploadProgress(null);
    setIsFormBusyForImage(false);
    setStatusMessage("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [initialData, form]);

  useEffect(() => {
    if (watchedName && !initialData && !form.getFieldState('slug').isDirty) {
      form.setValue('slug', generateSlug(watchedName), { shouldValidate: true });
    }
  }, [watchedName, initialData, form]);

  useEffect(() => {
    const isCurrentTaxValid = watchedTaxId && watchedTaxId !== NO_TAX_VALUE;
    if (!isCurrentTaxValid) {
      if (form.getValues("isTaxInclusive") === "true") {
        form.setValue("isTaxInclusive", "false", { shouldValidate: true });
      }
    }
  }, [watchedTaxId, form]);


  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        toast({ title: "File Too Large", description: "Please select an image smaller than 5MB.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFile(null);
        setCurrentImagePreview(form.getValues('imageUrl') || originalImageUrlFromInitialData || null);
        return;
      }
      setSelectedFile(file);
      setCurrentImagePreview(URL.createObjectURL(file));
      form.setValue('imageUrl', '', { shouldValidate: false }); 
    } else {
      setSelectedFile(null);
      setCurrentImagePreview(form.getValues('imageUrl') || originalImageUrlFromInitialData || null);
    }
  };
  
  const handleRemoveImage = async () => {
    if (selectedFile && currentImagePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(currentImagePreview);
    }
    setSelectedFile(null);
    setCurrentImagePreview(null);
    form.setValue('imageUrl', '', { shouldValidate: true });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (formData: ServiceFormDataInternal) => {
    setIsFormBusyForImage(true);
    let finalImageUrl = formData.imageUrl || ""; 

    const currentIsTaxInclusiveString = form.getValues('isTaxInclusive'); 
    const finalTaxIdValue = (formData.taxId && formData.taxId !== NO_TAX_VALUE) ? formData.taxId : undefined;
    const finalIsTaxInclusiveValue = finalTaxIdValue ? (currentIsTaxInclusiveString === "true") : false;
    
    const selectedTaxObject = taxes.find(t => t.id === finalTaxIdValue);

    try {
      if (selectedFile) {
        setStatusMessage("Uploading image...");
        setUploadProgress(0);
        if (originalImageUrlFromInitialData && isFirebaseStorageUrl(originalImageUrlFromInitialData)) {
          try { await deleteObject(storageRef(storage, originalImageUrlFromInitialData)); } 
          catch (error) { console.warn("Error deleting old image: ", error); }
        }
        const timestamp = Math.floor(Date.now() / 1000);
        const randomString = generateRandomHexString(16);
        const extension = selectedFile.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `${timestamp}_${randomString}.${extension}`;
        const imagePath = `public/uploads/services/${fileName}`; 
        const fileStorageRefInstance = storageRef(storage, imagePath);
        const uploadTask = uploadBytesResumable(fileStorageRefInstance, selectedFile);
        finalImageUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(progress); setStatusMessage(`Uploading: ${Math.round(progress)}%`);
            },
            (error) => { console.error("Upload error:", error); reject(new Error(`Upload failed: ${error.message}`)); },
            async () => {
              try { resolve(await getDownloadURL(uploadTask.snapshot.ref)); }
              catch (error) { reject(new Error(`Download URL failed: ${(error as Error).message}`)); }
            }
          );
        });
        setUploadProgress(100); setStatusMessage("Image uploaded. Saving...");
      } else if (!formData.imageUrl && originalImageUrlFromInitialData && isFirebaseStorageUrl(originalImageUrlFromInitialData)) {
        setStatusMessage("Removing image...");
        try { await deleteObject(storageRef(storage, originalImageUrlFromInitialData)); finalImageUrl = ""; setStatusMessage("Image removed. Saving..."); }
        catch (error: any) { throw new Error(`Failed to delete image: ${error.message}. Not saved.`); }
      } else { setStatusMessage(initialData ? "Saving changes..." : "Creating service..."); }

      const finalSlug = initialData?.slug ? initialData.slug : (formData.slug || generateSlug(formData.name));
      
      const dataToSubmit: Omit<FirestoreService, 'id' | 'createdAt'> & { id?: string } = {
        name: formData.name, slug: finalSlug, subCategoryId: formData.subCategoryId,
        price: formData.price, 
        isTaxInclusive: finalIsTaxInclusiveValue, 
        discountedPrice: formData.discountedPrice === null ? undefined : formData.discountedPrice,
        description: formData.description, shortDescription: formData.shortDescription === null ? undefined : formData.shortDescription,
        fullDescription: formData.fullDescription === null ? undefined : formData.fullDescription,
        serviceHighlights: formData.serviceHighlights || [], imageUrl: finalImageUrl, imageHint: formData.imageHint,
        rating: formData.rating, reviewCount: formData.reviewCount, isActive: formData.isActive,
        taxId: finalTaxIdValue, taxName: selectedTaxObject?.taxName, taxPercent: selectedTaxObject?.taxPercent,
        h1_title: formData.h1_title, seo_title: formData.seo_title, seo_description: formData.seo_description,
        seo_keywords: formData.seo_keywords, id: initialData?.id,
      };
      
      await onSubmitProp(dataToSubmit);
      setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Error in service form submission:", error);
      toast({ title: "Operation Failed", description: (error as Error).message || "Could not save service.", variant: "destructive" });
    } finally {
      setIsFormBusyForImage(false); setStatusMessage(""); setUploadProgress(null);
    }
  };
  
  const displayPreviewUrl = isValidImageSrc(currentImagePreview) ? currentImagePreview : null;
  const effectiveIsSubmitting = isParentSubmitting || isFormBusyForImage;
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-grow space-y-6 p-6 overflow-y-auto">
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Service Name</FormLabel><FormControl><Input placeholder="e.g., Premium AC Servicing" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
        <FormField control={form.control} name="slug" render={({ field }) => (<FormItem><FormLabel>Service Slug {initialData ? "(Non-editable)" : "(Optional - auto-generated if blank)"}</FormLabel><FormControl><Input placeholder="e.g., premium-ac-servicing" {...field} onChange={(e) => field.onChange(generateSlug(e.target.value))} disabled={effectiveIsSubmitting || !!initialData}/></FormControl><FormDescription>{initialData ? "Slug cannot be changed for existing services." : "Lowercase, dash-separated. Auto-generated from name if left blank."}</FormDescription><FormMessage /></FormItem>)}/>
        <FormField
          control={form.control}
          name="subCategoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Sub-Category</FormLabel>
              <Select
                key={`subcat-select-${initialData?.id || 'new-service'}-${subCategories.length}-${field.value}`}
                onValueChange={field.onChange}
                value={field.value}
                disabled={effectiveIsSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sub-category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {subCategories.map(subCat => (
                    <SelectItem key={subCat.id} value={subCat.id}>
                      {subCat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={form.control} name="price" render={({ field }) => (<FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 1200" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
          <FormField control={form.control} name="discountedPrice" render={({ field }) => (<FormItem><FormLabel>Discounted Price (₹) (Optional)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="e.g., 999" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting}/></FormControl><FormMessage /></FormItem>)}/>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="taxId"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center"><Percent className="mr-2 h-4 w-4 text-muted-foreground" />Applicable Tax (Optional)</FormLabel>
                <Select
                  key={`tax-id-select-${initialData?.id || 'new-service'}-${taxes.length}-${field.value}`}
                  onValueChange={(value) => {
                    const newTaxId = value === NO_TAX_VALUE ? null : value;
                    field.onChange(newTaxId); 
                    if (newTaxId === null) {
                      form.setValue('isTaxInclusive', "false", { shouldValidate: true });
                    }
                  }}
                  value={field.value ?? NO_TAX_VALUE} 
                  disabled={effectiveIsSubmitting || taxes.length === 0}
                >
                  <FormControl><SelectTrigger><SelectValue placeholder={taxes.length > 0 ? "Select a tax configuration" : "No active taxes"} /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NO_TAX_VALUE}>No Tax</SelectItem>
                    {taxes.map(tax => (<SelectItem key={tax.id} value={tax.id}>{tax.taxName} ({tax.taxPercent}%)</SelectItem>))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isTaxInclusive"
            render={({ field }) => {
              return (
                <FormItem>
                  <FormLabel className={!taxSelected ? "text-muted-foreground" : ""}>Price Tax Type</FormLabel>
                  <Select
                    key={`is-tax-inclusive-select-${initialData?.id || 'new-service'}-${taxes.length}-${field.value}`} 
                    onValueChange={field.onChange} 
                    value={field.value} 
                    disabled={!taxSelected || effectiveIsSubmitting}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="Select tax type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={"false"}>Tax Exclusive (Price + Tax)</SelectItem>
                      <SelectItem value={"true"}>Tax Inclusive (Price includes Tax)</SelectItem>
                    </SelectContent>
                  </Select>
                  {!taxSelected && <FormDescription className="text-xs">Select a tax first to enable this option.</FormDescription>}
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description (for cards, max 200 chars)</FormLabel><FormControl><Textarea placeholder="Briefly describe the service" {...field} rows={3} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
        <FormField control={form.control} name="shortDescription" render={({ field }) => (<FormItem><FormLabel>Short Description (Optional, max 300 chars)</FormLabel><FormControl><Textarea placeholder="Slightly more detailed description for service page intro." {...field} value={field.value ?? ""} rows={3} disabled={effectiveIsSubmitting}/></FormControl><FormMessage /></FormItem>)}/>
        <FormField control={form.control} name="fullDescription" render={({ field }) => (<FormItem><FormLabel>Full Description (Optional)</FormLabel><FormControl><Textarea placeholder="Detailed info, what's included, etc." {...field} value={field.value ?? ""} rows={5} disabled={effectiveIsSubmitting}/></FormControl><FormMessage /></FormItem>)}/>
        
        <Separator />
        <div>
          <FormLabel>Service Highlights</FormLabel><FormDescription className="mb-2">Key benefits or features. Max 150 chars each.</FormDescription>
          {highlightFields.map((item, index) => (<FormField key={item.id} control={form.control} name={`serviceHighlights.${index}`} render={({ field: itemField }) => (<FormItem className="flex items-center gap-2 mb-2"><FormControl><Input placeholder={`Highlight ${index + 1}`} {...itemField} disabled={effectiveIsSubmitting} /></FormControl><Button type="button" variant="ghost" size="icon" onClick={() => removeHighlight(index)} disabled={effectiveIsSubmitting}><Trash2 className="h-4 w-4 text-destructive" /></Button><FormMessage /></FormItem>)}/>))}
          <Button type="button" variant="outline" size="sm" onClick={() => appendHighlight("")} disabled={effectiveIsSubmitting} className="mt-2"><PlusCircle className="mr-2 h-4 w-4" /> Add Highlight</Button>
        </div>
        <Separator />

        <FormItem>
          <FormLabel>Service Main Image (Optional)</FormLabel>
          {displayPreviewUrl ? (<div className="my-2 relative w-full h-40 rounded-md overflow-hidden border bg-muted/10"><NextImage src={displayPreviewUrl} alt="Current service image" fill className="object-contain" data-ai-hint={watchedImageHint || "service image preview"} unoptimized={displayPreviewUrl.startsWith('blob:') || displayPreviewUrl.startsWith('data:')} sizes="(max-width: 640px) 100vw, 50vw"/></div>) : (<div className="my-2 flex items-center justify-center w-full h-40 rounded-md border border-dashed bg-muted/10"><ImageIcon className="h-10 w-10 text-muted-foreground" /></div>)}
          <FormControl><Input type="file" accept="image/png, image/jpeg, image/gif, image/webp" onChange={handleFileSelected} disabled={effectiveIsSubmitting} ref={fileInputRef} className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/80 file:text-primary-foreground hover:file:bg-primary/90"/></FormControl>
          <FormDescription className="mt-1">Upload new image (PNG, JPG, GIF, WEBP, max 5MB).</FormDescription>
          {uploadProgress !== null && selectedFile && (<div className="mt-2"><Progress value={uploadProgress} className="w-full h-2" />{statusMessage && <p className="text-xs text-muted-foreground mt-1">{statusMessage}</p>}</div>)}
        </FormItem>
        <FormField control={form.control} name="imageUrl" render={({ field }) => (<FormItem><FormLabel>Image URL (Leave empty to remove)</FormLabel><div className="flex flex-col sm:flex-row sm:items-center gap-2"><FormControl className="flex-grow"><Textarea placeholder="Auto-filled after upload, or manually enter. Clear to remove." {...field} disabled={effectiveIsSubmitting || selectedFile !== null} rows={2} onChange={(e) => { field.onChange(e); if (!selectedFile) { setCurrentImagePreview(e.target.value || null); }}}/></FormControl>{(field.value || selectedFile || currentImagePreview) && (<Button type="button" variant="ghost" size="icon" onClick={handleRemoveImage} disabled={effectiveIsSubmitting} aria-label="Clear image" className="sm:ml-auto mt-2 sm:mt-0"><Trash2 className="h-4 w-4 text-destructive"/></Button>)}</div><FormDescription>If file uploaded, URL ignored. Empty this and save to remove existing image.</FormDescription><FormMessage /></FormItem>)}/>
        <FormField control={form.control} name="imageHint" render={({ field }) => (<FormItem><FormLabel>Image AI Hint (Optional)</FormLabel><FormControl><Input placeholder="e.g., ac unit repair" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormDescription>Keywords for AI. Max 50 chars.</FormDescription><FormMessage /></FormItem>)}/>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField control={form.control} name="rating" render={({ field }) => (<FormItem><FormLabel>Default Rating (0-5)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="e.g., 4.5" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="reviewCount" render={({ field }) => (<FormItem><FormLabel>Default Review Count</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
        </div>
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background/50">
              <div className="space-y-0.5">
                <FormLabel>Service Active</FormLabel>
                <FormDescription>If unchecked, this service will not be shown publicly.</FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={effectiveIsSubmitting}/>
              </FormControl>
            </FormItem>
          )}
        />
        
        <Separator />
        <div className="space-y-4 pt-4 border-t">
            <h3 className="text-md font-semibold text-muted-foreground">SEO Settings (Optional)</h3>
            <p className="text-xs text-muted-foreground">Use placeholders like {"{{serviceName}}"} and {"{{categoryName}}"} for global patterns.</p>
            <FormField control={form.control} name="h1_title" render={({ field }) => (<FormItem><FormLabel>H1 Title</FormLabel><FormControl><Input placeholder="e.g., Expert AC Servicing" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="seo_title" render={({ field }) => (<FormItem><FormLabel>Meta Title</FormLabel><FormControl><Input placeholder="e.g., AC Servicing | Best AC Repair" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="seo_description" render={({ field }) => (<FormItem><FormLabel>Meta Description</FormLabel><FormControl><Textarea placeholder="e.g., Get your AC serviced by professionals." {...field} value={field.value ?? ""} rows={3} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
            <FormField control={form.control} name="seo_keywords" render={({ field }) => (<FormItem><FormLabel>Meta Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., ac service, ac repair" {...field} value={field.value ?? ""} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>)}/>
        </div>

        <div className="p-6 border-t sticky bottom-0 bg-background flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={effectiveIsSubmitting}>Cancel</Button>
          <Button type="submit" disabled={effectiveIsSubmitting || (subCategories.length === 0 && !initialData) }>
            {effectiveIsSubmitting && !statusMessage.includes("Uploading") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFormBusyForImage && statusMessage ? statusMessage : (initialData ? 'Save Changes' : 'Create Service')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
