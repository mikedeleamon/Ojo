declare module 'react-native-palette' {
  type PaletteSwatch = { rgb: [number, number, number]; population: number };
  type PaletteResult = Partial<Record<
    'vibrant' | 'darkVibrant' | 'lightVibrant' | 'muted' | 'darkMuted' | 'lightMuted',
    PaletteSwatch
  >>;
  type PaletteCallback = (error: Error | null, palette: PaletteResult) => void;

  interface RNPaletteModule {
    getPalette(imageUri: string, callback: PaletteCallback): void;
  }

  const RNPalette: RNPaletteModule;
  export default RNPalette;
}
