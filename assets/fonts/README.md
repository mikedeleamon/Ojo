# Required fonts

Download and place these files here before running the app:

1. DMSerifDisplay-Regular.ttf
   https://fonts.google.com/specimen/DM+Serif+Display

2. Outfit (static weights — Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700)
   https://fonts.google.com/specimen/Outfit
   Files: Outfit_300Light.ttf, Outfit_400Regular.ttf, Outfit_500Medium.ttf,
          Outfit_600SemiBold.ttf, Outfit_700Bold.ttf

These are loaded in `app/_layout.tsx` via `useFonts()`.
The app will fail to render past the splash screen if these files are missing.
