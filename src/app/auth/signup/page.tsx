
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Logo from '@/components/shared/Logo';
import { Mail, KeyRound, User, Loader2, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { SignUpData } from '@/contexts/AuthContext';

const signUpSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  mobileNumber: z.string()
    .min(10, { message: "Mobile number must be at least 10 digits." })
    .max(15, { message: "Mobile number cannot exceed 15 digits." })
    .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid mobile number format (e.g., +919876543210 or 9876543210)." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], // path of error
});

type SignUpFormValues = z.infer<typeof signUpSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { signUp, isLoading } = useAuth();

  const form = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: "",
      email: "",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: SignUpFormValues) => {
    try {
      // The type assertion is safe here because Zod ensures password exists.
      await signUp(data as SignUpData);
      // router.push('/'); // Redirect is handled in AuthContext signUp
    } catch (error) {
      // Error is handled by toast in AuthContext
      console.error("Signup page error:", error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-4" size="large" />
          <CardTitle className="text-2xl font-headline">Create Your Account</CardTitle>
          <CardDescription>Join FixBro to easily book home services.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="fullName" className="flex items-center"><User className="mr-2 h-4 w-4 text-muted-foreground" />Full Name</FormLabel>
                    <FormControl>
                      <Input id="fullName" placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="email" className="flex items-center"><Mail className="mr-2 h-4 w-4 text-muted-foreground" />Email</FormLabel>
                    <FormControl>
                      <Input id="email" type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mobileNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="mobileNumber" className="flex items-center"><Phone className="mr-2 h-4 w-4 text-muted-foreground" />Mobile Number</FormLabel>
                    <FormControl>
                      <Input id="mobileNumber" type="tel" placeholder="e.g., 9876543210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="password" className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Password</FormLabel>
                    <FormControl>
                      <Input id="password" type="password" placeholder="Choose a strong password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="confirmPassword" className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Confirm Password</FormLabel>
                    <FormControl>
                      <Input id="confirmPassword" type="password" placeholder="Re-enter your password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign Up
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/login" passHref>
                  <Button variant="link" className="px-1">Login</Button>
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
