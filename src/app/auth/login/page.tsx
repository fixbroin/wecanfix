
"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import Logo from '@/components/shared/Logo';
import { Mail, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { LogInData } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { ADMIN_EMAIL } from '@/contexts/AuthContext';

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, logIn, isLoading: authContextIsLoading } = useAuth(); // Renamed isLoading to authContextIsLoading
  const searchParams = useSearchParams();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (user && !authContextIsLoading) { // User is already logged in and auth state is resolved
      const redirectPathFromQuery = searchParams.get('redirect');
      let finalRedirectPath = '/';

      if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        finalRedirectPath = '/admin';
      } else {
        // Logic for provider redirect can be added here if available from user object
        // e.g., if (user.isProvider) finalRedirectPath = '/provider';
      }

      if (redirectPathFromQuery && !redirectPathFromQuery.startsWith('/auth/')) {
        finalRedirectPath = redirectPathFromQuery;
      }
      
      if (finalRedirectPath === '/auth/login' || finalRedirectPath === '/auth/signup') {
         finalRedirectPath = (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ? '/admin' : '/';
      }
      router.push(finalRedirectPath);
    }
  }, [user, authContextIsLoading, router, searchParams]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await logIn(data as LogInData);
    } catch (error) {
      console.error("Login page error:", error);
    }
  };

  if (authContextIsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
         <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (user && !authContextIsLoading) { // User is logged in, useEffect will redirect
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
         <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="ml-3 text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  // Only show form if not loading and no user
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-4" size="large" />
          <CardTitle className="text-2xl font-headline">Welcome Back!</CardTitle>
          <CardDescription>Login to access your FixBro account.</CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
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
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="password" className="flex items-center"><KeyRound className="mr-2 h-4 w-4 text-muted-foreground" />Password</FormLabel>
                    <FormControl>
                      <Input id="password" type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <Link href="/auth/forgot-password" passHref>
                  <Button variant="link" className="text-sm px-0">Forgot password?</Button>
                </Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full" size="lg" disabled={authContextIsLoading}>
                {authContextIsLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/auth/signup" passHref>
                  <Button variant="link" className="px-1">Sign up</Button>
                </Link>
              </p>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
