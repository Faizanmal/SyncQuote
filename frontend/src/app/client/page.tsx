import { ClientPortal } from '@/components/client-portal';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Client Portal - SyncQuote',
  description: 'Access your proposals and provide feedback',
};

export default function ClientPortalPage() {
  return <ClientPortal />;
}
