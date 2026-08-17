// React Native injects __DEV__ at build time; a bare ts-jest run has no bundler
// to do that. The outfit engine reads it for its perf logging (outfitEngine.ts),
// so without this any test that actually invokes generateOutfits throws
// ReferenceError before reaching a single assertion. False = production
// behaviour: no timing work, no console noise in test output.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  },
}));
