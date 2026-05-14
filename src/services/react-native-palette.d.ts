declare module 'react-native-palette' {
  type PaletteCallback = (error: Error | null, palette: Record<string, { rgb: [number, number, number]; population: number } | undefined>) => void;
  export function getPalette(imageUri: string, callback: PaletteCallback): void;
}
