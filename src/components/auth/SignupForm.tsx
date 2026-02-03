'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

const signupSchema = z
  .object({
    name: z.string().min(2, 'Ime mora imati najmanje 2 znaka'),
    email: z.string().email('Unesite ispravnu email adresu'),
    password: z.string().min(6, 'Lozinka mora imati najmanje 6 znakova'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Lozinke se ne podudaraju',
    path: ['confirmPassword'],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

export function SignupForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password, data.name);
      if (error) {
        toast.error('Neuspjesna registracija', {
          description:
            error.message === 'User already registered'
              ? 'Korisnik s ovom email adresom vec postoji.'
              : 'Molimo pokusajte ponovo.',
        });
        return;
      }
      toast.success('Uspjesna registracija!', {
        description: 'Provjerite email za potvrdu registracije.',
      });
      router.push('/login');
    } catch {
      toast.error('Doslo je do greske', {
        description: 'Molimo pokusajte ponovo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ime i prezime</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ivan Horvat"
                  autoComplete="name"
                  {...field}
                />
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
              <FormLabel>Email adresa</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="vas@email.com"
                  autoComplete="email"
                  {...field}
                />
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
              <FormLabel>Lozinka</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Najmanje 6 znakova"
                  autoComplete="new-password"
                  {...field}
                />
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
              <FormLabel>Potvrdi lozinku</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Ponovite lozinku"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Registriraj se
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Vec imate racun?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Prijavite se
          </Link>
        </p>
      </form>
    </Form>
  );
}
