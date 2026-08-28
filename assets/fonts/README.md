# Required fonts

Download and place these files here before running the app:

1. DMSerifDisplay-Regular.ttf
   https://fonts.google.com/specimen/DM+Serif+Display

2. Fraunces-SemiBold.ttf (static instance, weight 600 / optical size 72)
   https://fonts.google.com/specimen/Fraunces
   Fraunces ships as a variable font (wght 100–900, opsz 9–144, plus SOFT
   and WONK axes); this file is a static instance pinned to weight 600,
   opsz 72, SOFT 0, WONK 0. Used only for the Home hero (city name + big
   temperature) and its sticky mini-header mirror — see fonts.hero.

3. Outfit (static weights — Light 300, Regular 400, Medium 500, SemiBold 600, Bold 700)
   https://fonts.google.com/specimen/Outfit
   Files: Outfit_300Light.ttf, Outfit_400Regular.ttf, Outfit_500Medium.ttf,
          Outfit_600SemiBold.ttf, Outfit_700Bold.ttf

These are loaded in `app/_layout.tsx` via `useFonts()`.
The app will fail to render past the splash screen if these files are missing.
