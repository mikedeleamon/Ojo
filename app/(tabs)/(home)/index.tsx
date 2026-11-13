import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from 'expo-router';
import MainPage from '../../../src/views/MainPage/MainPage';

export default function HomeTab() {
  // Home always sits on the sky, which stays dark in light mode too, so the
  // app-wide status bar (dark icons in light mode) would put a black clock on a
  // navy background. Only while Home is focused: the other tabs are light in
  // light mode and should keep following the theme.
  const focused = useIsFocused();
  return (
    <>
      {focused && <StatusBar style='light' />}
      <MainPage />
    </>
  );
}
