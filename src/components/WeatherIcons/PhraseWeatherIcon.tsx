/**
 * PhraseWeatherIcon — renders a forecast phrase as one of the app's own SVG
 * weather icons, replacing the ❄️/🌧️/⛈️/☁️/☀️/💨/🌤️ emoji that TripFit used to
 * print via `phraseEmoji`.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * Emoji are not a safe rendering primitive across environments. The iOS
 * Simulator runtime ships no `Core/AppleColorEmoji.ttc` (only the unused
 * `CoreAddition/AppleColorEmoji-160px.ttc`), so CoreText has nothing to fall
 * back to and every emoji codepoint draws as a missing-glyph box — including
 * the U+FE0F variation selector, which is why a single `✈️` rendered as *two*
 * boxes. Physical devices do ship that font, so the same build looks correct
 * there. Screenshots, previews, and CI captures therefore disagreed with the
 * device for reasons that had nothing to do with this app.
 *
 * Drawing the glyph ourselves removes the system-font dependency entirely, and
 * follows the direction already set by CameraIcon / SuitcaseIcon /
 * PackingCategoryIcon, each of which replaced an emoji for the same reason.
 *
 * Icon selection goes through `iconTypeFor` — the same classifier the main
 * WeatherHUD uses — so a phrase can't map to one glyph here and a different
 * one on the home screen.
 */

import SunnyIcon from './SunnyIcon';
import CloudyIcon from './CloudyIcon';
import PartlyCloudyIcon from './PartlyCloudyIcon';
import PartlyCloudyNightIcon from './PartlyCloudyNightIcon';
import RainyIcon from './RainyIcon';
import StormIcon from './StormIcon';
import SnowIcon from './SnowIcon';
import ClearNightIcon from './ClearNightIcon';
import { iconTypeFor } from '../../lib/weather/conditions';

interface Props {
    /** Free-text forecast phrase, e.g. WeatherKit's "Mostly Cloudy". */
    phrase: string;
    size?: number;
    /** Daily trip forecasts describe daytime, so this defaults to true. */
    isDay?: boolean;
    /**
     * Glyph fill. The underlying icons default to near-white because their
     * usual home is the hero over a saturated sky gradient — which makes them
     * invisible on the light day-cards, so those call sites must pass a token.
     */
    color?: string;
    decorative?: boolean;
}

const PhraseWeatherIcon = ({
    phrase,
    size = 20,
    isDay = true,
    color = '#fefefe',
    decorative = false,
}: Props) => {
    switch (iconTypeFor(phrase ?? '', isDay)) {
        case 'storm':
            return <StormIcon size={size} color={color} decorative={decorative} />;
        case 'snow':
            return <SnowIcon size={size} color={color} decorative={decorative} />;
        case 'rainy':
            return <RainyIcon size={size} color={color} animate={false} decorative={decorative} />;
        case 'cloudy':
            return <CloudyIcon size={size} color={color} decorative={decorative} />;
        case 'partly-cloudy':
            return (
                <PartlyCloudyIcon size={size} color={color} animate={false} decorative={decorative} />
            );
        case 'partly-cloudy-night':
            return <PartlyCloudyNightIcon size={size} color={color} decorative={decorative} />;
        case 'clear-night':
            return (
                <ClearNightIcon
                    size={size}
                    color={color}
                    starCount={6}
                    animate={false}
                    decorative={decorative}
                />
            );
        case 'sunny':
        default:
            return <SunnyIcon size={size} color={color} decorative={decorative} />;
    }
};

export default PhraseWeatherIcon;
