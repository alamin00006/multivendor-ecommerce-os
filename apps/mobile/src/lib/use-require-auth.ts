import { selectAuth } from '@marketbd/api-client';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';

/** Redirects to /login (returning to `next`) once session restore finished without a session. */
export function useRequireAuth(next: string): boolean {
  const { status } = useSelector(selectAuth);
  useEffect(() => {
    if (status === 'anonymous') router.replace({ pathname: '/login', params: { next } });
  }, [status, next]);
  return status === 'authenticated';
}
