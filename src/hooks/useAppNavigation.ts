import { useRouter } from 'expo-router';

export const useAppNavigation = () => {
  const router = useRouter();
  return {
    push:    (route: string, params?: Record<string, unknown>) =>
               router.push({ pathname: route as any, params: params as any }),
    goBack:  () => router.back(),
    replace: (route: string) => router.replace(route as any),
    reset:   (route: string) => router.replace(route as any),
  };
};
