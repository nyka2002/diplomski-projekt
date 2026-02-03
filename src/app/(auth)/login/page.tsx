import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Prijava - Agent za nekretnine',
  description: 'Prijavite se na svoj racun',
};

function LoginFormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Prijava</CardTitle>
        <CardDescription>
          Prijavite se na svoj racun za pristup spremljenim oglasima
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoginFormSkeleton />}>
          <LoginForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
