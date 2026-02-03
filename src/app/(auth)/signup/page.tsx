import type { Metadata } from 'next';
import { SignupForm } from '@/components/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Registracija - Agent za nekretnine',
  description: 'Napravite novi racun',
};

export default function SignupPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Registracija</CardTitle>
        <CardDescription>
          Napravite racun za spremanje omiljenih oglasa i pracenje pretrazivanja
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
