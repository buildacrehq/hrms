'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getAccessToken } from '@/lib/api';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    router.replace(getAccessToken() ? '/home' : '/login');
  }, [router]);
  return null;
}
