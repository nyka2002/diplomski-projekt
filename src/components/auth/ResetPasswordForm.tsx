'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
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

const resetSchema = z.object({
  email: z.string().email('Unesite ispravnu email adresu'),
});

type ResetFormValues = z.infer<typeof resetSchema>;

export function ResetPasswordForm() {
  const { resetPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(data.email);
      if (error) {
        toast.error('Greska pri slanju emaila', {
          description: 'Molimo pokusajte ponovo.',
        });
        return;
      }
      setIsEmailSent(true);
    } catch {
      toast.error('Doslo je do greske', {
        description: 'Molimo pokusajte ponovo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isEmailSent) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold">Provjerite email</h3>
          <p className="text-sm text-muted-foreground">
            Poslali smo vam upute za resetiranje lozinke na{' '}
            <span className="font-medium text-foreground">
              {form.getValues('email')}
            </span>
          </p>
        </div>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Natrag na prijavu
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Unesite email adresu povezanu s vasim racunom i poslat cemo vam
            upute za resetiranje lozinke.
          </p>
        </div>

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

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Posalji upute
        </Button>

        <Button variant="ghost" asChild className="w-full">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Natrag na prijavu
          </Link>
        </Button>
      </form>
    </Form>
  );
}
