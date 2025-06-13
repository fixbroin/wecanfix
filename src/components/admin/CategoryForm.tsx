
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FirestoreCategory } from '@/types/firestore';
import { useEffect, useState, useRef } from "react";
import { Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NextImage from 'next/image'; // Renamed import
import { storage } from '@/lib/firebase'; // Keep for potential old image deletion from Firebase
import { ref as storageRefStandard, deleteObject } from "firebase/storage"; // Keep for potential old image deletion
import { Progress } from "@/components/ui/progress";

const generateSlug = (name: string) => {
  if (!name) return "";
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
};

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  slug: z.string().min(2, "Slug must be at least 2 characters.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format (e.g., my-category-name).").optional().or(z.literal('')),
  order: z.coerce.number().min(0, { message: "Order must be a non-negative number." }),
  imageUrl: z.string().optional().or(z.literal('')), // URL or relative path
  imageHint: z.string().max(50, { message: "Image hint should be max 50 characters."}).optional().or(z.literal('')),
  h1_title: z.string().max(100, "H1 title too long.").optional().or(z.literal('')),
  seo_title: z.string().max(70, "Meta title too long.").optional().or(z.literal('')),
  seo_description: z.string().max(300, "Meta description too long.").optional().or(z.literal('')),
  seo_keywords: z.string().optional().or(z.literal('')),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  onSubmit: (data: Omit<FirestoreCategory, 'id' | 'createdAt'> & { id?: string, slug?: string }) => Promise<void>;
  initialData?: FirestoreCategory | null;
  onCancel: () => void;
  isSubmitting?: boolean; 
}

const isFirebaseStorageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  return typeof url === 'string' && url.includes("firebasestorage.googleapis.com");
};

const isValidImageUrl = (url: string | null | undefined): url is string => {
    if (!url || url.trim() === '') return false;
    // Allow blob URLs for local previews, relative paths for new server uploads, and full http(s) URLs
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


export default function CategoryForm({ onSubmit: onSubmitProp, initialData, onCancel, isSubmitting: isParentSubmitting = false }: CategoryFormProps) {
  const [currentImagePreview, setCurrentImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [originalImageUrlFromInitialData, setOriginalImageUrlFromInitialData] = useState<string | null>(null);
  
  const [isFormBusyForImage, setIsFormBusyForImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");


  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "", slug: "", order: 0, imageUrl: "", imageHint: "",
      h1_title: "", seo_title: "", seo_description: "", seo_keywords: "",
    },
  });

  const watchedName = form.watch("name");
  const watchedImageHint = form.watch("imageHint");

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name, slug: initialData.slug, order: initialData.order,
        imageUrl: initialData.imageUrl || "", imageHint: initialData.imageHint || "",
        h1_title: initialData.h1_title || "", seo_title: initialData.seo_title || "",
        seo_description: initialData.seo_description || "", seo_keywords: initialData.seo_keywords || "",
      });
      setCurrentImagePreview(initialData.imageUrl || null);
      setOriginalImageUrlFromInitialData(initialData.imageUrl || null); 
    } else {
      form.reset({ 
        name: "", slug: "", order: 0, imageUrl: "", imageHint: "",
        h1_title: "", seo_title: "", seo_description: "", seo_keywords: ""
      });
      setCurrentImagePreview(null); setOriginalImageUrlFromInitialData(null);
    }
    setSelectedFile(null); setUploadProgress(null); setIsFormBusyForImage(false); setStatusMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [initialData, form]);

  useEffect(() => {
    if (watchedName && !initialData && !form.getFieldState('slug').isDirty) {
      form.setValue('slug', generateSlug(watchedName), { shouldValidate: true });
    }
  }, [watchedName, initialData, form]);

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File Too Large", description: "Select image smaller than 5MB.", variant: "destructive" });
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        setSelectedFile(null);
        setCurrentImagePreview(form.getValues('imageUrl') || originalImageUrlFromInitialData || null); 
        return;
      }
      setSelectedFile(file);
      setCurrentImagePreview(URL.createObjectURL(file)); 
      form.setValue('imageUrl', '', { shouldValidate: false }); // Clear manual URL as file takes precedence
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

  const handleSubmit = async (formData: CategoryFormData) => {
    setIsFormBusyForImage(true); 
    let finalImageUrl = formData.imageUrl || ""; 

    try {
      if (selectedFile) { // New file selected, upload to /api/upload
        setStatusMessage("Uploading image...");
        setUploadProgress(0);

        // If there was an old image and it was a Firebase Storage URL, try to delete it
        if (originalImageUrlFromInitialData && isFirebaseStorageUrl(originalImageUrlFromInitialData)) {
          try {
            const oldImageRef = storageRefStandard(storage, originalImageUrlFromInitialData);
            await deleteObject(oldImageRef);
          } catch (error) {
            console.warn("Warning: Failed to delete old Firebase Storage image:", error);
          }
        }
        // Deleting from local /public/uploads would require another API call if `originalImageUrlFromInitialData` was a local path.
        // For simplicity, we're not handling deletion of old local files here.

        const fileFormData = new FormData();
        fileFormData.append('file', selectedFile);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: fileFormData,
          // `Content-Type` header is set automatically by browser for FormData
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || result.message || 'Image upload via API failed.');
        }
        finalImageUrl = result.url; // This will be like /uploads/filename.jpg
        setUploadProgress(100);
        setStatusMessage("Image uploaded. Saving category...");

      } else if (!formData.imageUrl && originalImageUrlFromInitialData) {
        // Image URL field is empty, and there was an original image. This means "remove".
        setStatusMessage("Removing image reference...");
        if (isFirebaseStorageUrl(originalImageUrlFromInitialData)) {
          // If it was a Firebase Storage URL, try to delete it
          try {
            const oldImageRef = storageRefStandard(storage, originalImageUrlFromInitialData);
            await deleteObject(oldImageRef);
          } catch (error: any) {
            console.warn(`Warning: Failed to delete previous Firebase image from storage: ${error.message}`);
          }
        }
        // For local /uploads/ images, we can't delete from client. User needs to manage public/uploads folder manually or via a separate admin interface.
        finalImageUrl = ""; 
        setStatusMessage("Image reference removed. Saving category...");
      } else {
         setStatusMessage(initialData ? "Saving changes..." : "Creating category...");
      }

      await onSubmitProp({
        name: formData.name, slug: formData.slug, order: formData.order,
        imageUrl: finalImageUrl, imageHint: formData.imageHint,
        h1_title: formData.h1_title, seo_title: formData.seo_title,
        seo_description: formData.seo_description, seo_keywords: formData.seo_keywords,
        id: initialData?.id,
      });
      
      setSelectedFile(null); 
      if (fileInputRef.current) fileInputRef.current.value = "";
      
    } catch (error) {
      console.error("Error during category form submission or image operation:", error);
      toast({ title: "Operation Failed", description: (error as Error).message || "Could not save category data.", variant: "destructive" });
    } finally {
      setIsFormBusyForImage(false); setStatusMessage(""); setUploadProgress(null); 
    }
  };
  
  const displayPreviewUrl = isValidImageUrl(currentImagePreview) ? currentImagePreview : null;
  const effectiveIsSubmitting = isParentSubmitting || isFormBusyForImage; 
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Home Repairs" {...field} disabled={effectiveIsSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug {initialData ? "(Non-editable)" : "(Auto-generated or custom)"}</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., home-repairs"
                  {...field}
                  onChange={(e) => field.onChange(generateSlug(e.target.value))}
                  disabled={effectiveIsSubmitting || !!initialData}
                />
              </FormControl>
              <FormDescription>
                {initialData ? "Slug cannot be changed for existing categories." : "Lowercase, dash-separated. Auto-generated from name if left blank."}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="order"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Order</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} disabled={effectiveIsSubmitting} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Category Image (Optional)</FormLabel>
          {displayPreviewUrl ? (
            <div className="my-2 relative w-full h-40 rounded-md overflow-hidden border bg-muted/10">
              <NextImage
                src={displayPreviewUrl}
                alt="Current category image"
                fill
                className="object-contain"
                data-ai-hint={watchedImageHint || "category image preview"}
                unoptimized={displayPreviewUrl.startsWith('blob:') || displayPreviewUrl.startsWith('data:')}
                sizes="(max-width: 640px) 100vw, 50vw"
              />
            </div>
          ) : (
            <div className="my-2 flex items-center justify-center w-full h-40 rounded-md border border-dashed bg-muted/10">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <FormControl>
            <Input
              type="file"
              accept="image/png, image/jpeg, image/gif, image/webp"
              onChange={handleFileSelected}
              disabled={effectiveIsSubmitting}
              ref={fileInputRef}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/80 file:text-primary-foreground hover:file:bg-primary/90"
            />
          </FormControl>
           <FormDescription className="mt-1">
            Select image (PNG, JPG, GIF, WEBP, max 5MB) for local upload, or enter URL below.
          </FormDescription>
          {uploadProgress !== null && selectedFile && ( 
            <div className="mt-2">
              <Progress value={uploadProgress} className="w-full h-2" />
               {statusMessage && <p className="text-xs text-muted-foreground mt-1">{statusMessage}</p>}
            </div>
          )}
        </FormItem>

         <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Or Enter Image URL (Clear to remove existing)</FormLabel>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <FormControl className="flex-grow">
                  <Textarea
                    placeholder="e.g., /uploads/image.jpg or https://example.com/image.png"
                    {...field}
                    disabled={effectiveIsSubmitting || selectedFile !== null} 
                    rows={3}
                    onBlur={(e) => { 
                        if (!selectedFile) { 
                            setCurrentImagePreview(e.target.value || null);
                            form.setValue('imageUrl', e.target.value, { shouldValidate: true });
                        }
                    }}
                  />
                </FormControl>
                {(field.value || selectedFile || currentImagePreview) && ( 
                    <Button type="button" variant="ghost" size="icon" onClick={handleRemoveImage} disabled={effectiveIsSubmitting} aria-label="Clear image selection or URL" className="sm:ml-auto mt-2 sm:mt-0">
                        <Trash2 className="h-4 w-4 text-destructive"/>
                    </Button>
                )}
              </div>
              <FormDescription>If a new file is selected above, this URL will be ignored. If this field is empty and an image exists, it will be removed upon saving.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="imageHint"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image AI Hint (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g., tools repair" {...field} disabled={effectiveIsSubmitting} />
              </FormControl>
               <FormDescription>One or two keywords for AI image search (e.g. "tools repair"). Max 50 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4 pt-4 border-t">
            <h3 className="text-md font-semibold text-muted-foreground">SEO Settings (Optional)</h3>
             <p className="text-xs text-muted-foreground">Leave blank to use global SEO patterns defined in SEO Settings. Use <code>{"{{categoryName}}"}</code> in global patterns.</p>
            <FormField control={form.control} name="h1_title" render={({ field }) => (
                <FormItem><FormLabel>H1 Title</FormLabel><FormControl><Input placeholder="e.g., Expert Home Repair Services" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="seo_title" render={({ field }) => (
                <FormItem><FormLabel>Meta Title</FormLabel><FormControl><Input placeholder="e.g., Home Repair Services | FixBro" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="seo_description" render={({ field }) => (
                <FormItem><FormLabel>Meta Description</FormLabel><FormControl><Textarea placeholder="e.g., Get reliable home repair services for plumbing, electrical, and more." {...field} rows={3} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
            )}/>
            <FormField control={form.control} name="seo_keywords" render={({ field }) => (
                <FormItem><FormLabel>Meta Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., home repair, plumbing, electrical services" {...field} disabled={effectiveIsSubmitting} /></FormControl><FormMessage /></FormItem>
            )}/>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={effectiveIsSubmitting}>
                Cancel
            </Button>
            <Button type="submit" disabled={effectiveIsSubmitting}>
                {effectiveIsSubmitting && !statusMessage.includes("Uploading") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isFormBusyForImage && statusMessage ? statusMessage : (initialData ? 'Save Changes' : 'Create Category')}
            </Button>
        </div>
      </form>
    </Form>
  );
}
