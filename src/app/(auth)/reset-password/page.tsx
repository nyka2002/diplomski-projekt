import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Zaboravljena lozinka - Agent za nekretnine',
  description: 'Resetirajte svoju lozinku',
};

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Zaboravljena lozinka</CardTitle>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
