import { useNavigation } from '@react-navigation/native';

export const useAppNavigation = () => {
  const nav = useNavigation<any>();
  return {
    push:    (route: string, params?: Record<string, unknown>) =>
               nav.navigate(route as never, params as never),
    goBack:  () => nav.goBack(),
    replace: (route: string) => nav.replace(route as never),
    reset:   (route: string) => nav.reset({ index: 0, routes: [{ name: route }] }),
  };
};
