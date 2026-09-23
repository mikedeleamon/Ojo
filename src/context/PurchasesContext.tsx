import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { getUserId } from '../lib/auth';

export const ENTITLEMENT_ID = 'pro';

const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
});

/** RevenueCat's Test Store (keys prefixed `test_` — the local .env's, never a
 *  store build's) shows its purchase UI as an alert inside the app rather than
 *  a system sheet, so the app never loses focus while it is up. The paywall
 *  reads focus loss as "the store sheet appeared" (see handlePurchase), and
 *  needs to know when that signal can't exist. */
export const IS_TEST_STORE = API_KEY?.startsWith('test_') ?? false;

interface PurchasesState {
  isReady: boolean;
  /** False until a RevenueCat API key is set — see API_KEY above. Screens
   *  that render RevenueCatUI components must check this first: rendering
   *  them unconfigured throws the SDK's own raw "Purchases has not been
   *  configured" error instead of anything user-facing. */
  isConfigured: boolean;
  isPro: boolean;
}

const PurchasesContext = createContext<PurchasesState>({
  isReady: false,
  isConfigured: false,
  isPro: false,
});

// Configure is a one-time SDK call per process, independent of React's
// render/mount lifecycle — guard it at module scope so remounts (e.g. fast
// refresh) don't re-configure and so every provider instance shares it.
let configured = false;

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [isPro, setIsPro] = useState(false);
  // Tracks which app user id RevenueCat is currently identified as, so the
  // login effect only calls logIn/logOut on an actual transition rather than
  // on every re-render while isLoggedIn stays true.
  const identifiedUserId = useRef<string | null>(null);

  const applyCustomerInfo = useCallback((info: CustomerInfo) => {
    setIsPro(!!info.entitlements.active[ENTITLEMENT_ID]);
  }, []);

  useEffect(() => {
    // No key configured yet (RevenueCat dashboard / store products not set
    // up) — stay ready with isPro false rather than crash the app on an
    // undefined apiKey.
    if (!API_KEY) {
      setIsReady(true);
      return;
    }

    if (!configured) {
      Purchases.configure({ apiKey: API_KEY });
      configured = true;
    }

    Purchases.getCustomerInfo()
      .then(applyCustomerInfo)
      .finally(() => setIsReady(true));

    Purchases.addCustomerInfoUpdateListener(applyCustomerInfo);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(applyCustomerInfo);
    };
  }, [applyCustomerInfo]);

  useEffect(() => {
    if (!API_KEY || !configured) return;

    if (isLoggedIn) {
      const userId = getUserId();
      if (userId && identifiedUserId.current !== userId) {
        identifiedUserId.current = userId;
        Purchases.logIn(userId).then(({ customerInfo }) => applyCustomerInfo(customerInfo)).catch(() => {});
      }
    } else if (identifiedUserId.current) {
      // Revert to a fresh anonymous identity so the next account signed into
      // this device doesn't inherit the previous account's entitlement.
      identifiedUserId.current = null;
      Purchases.logOut().then(applyCustomerInfo).catch(() => {});
    }
  }, [isLoggedIn, applyCustomerInfo]);

  return (
    <PurchasesContext.Provider value={{ isReady, isConfigured: !!API_KEY, isPro }}>
      {children}
    </PurchasesContext.Provider>
  );
}

export const usePurchases = () => useContext(PurchasesContext);
