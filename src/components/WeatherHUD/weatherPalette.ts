import { weatherGradients } from '../../theme/tokens';

/** Maps an AccuWeather condition string + day/night flag to a gradient palette. */
export const gradientFor = (condition: string, isDay: boolean): readonly string[] => {
    const c = condition.toLowerCase();

    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return weatherGradients.clearNight;

    if (c.includes('fog') || c.includes('mist')) return weatherGradients.foggy;
    if (c.includes('haz') || c.includes('smoke')) return weatherGradients.hazy;

    if (c.includes('hot')) return weatherGradients.hot;

    if (c.includes('sunny') || c.includes('mostly sunny'))
        return weatherGradients.clearDay;
    if (c.includes('clear'))
        return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;

    if (c.includes('partly') || c.includes('intermittent'))
        return weatherGradients.partlyCloudy;
    if (c.includes('cloud') || c.includes('overcast'))
        return weatherGradients.cloudy;

    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard'))
        return weatherGradients.snow;
    if (
        c.includes('sleet') ||
        c.includes('ice') ||
        c.includes('freez') ||
        c.includes('wintry')
    )
        return weatherGradients.ice;

    if (c.includes('drizzle') || c.includes('sprinkle'))
        return weatherGradients.drizzle;
    if (c.includes('rain') || c.includes('shower'))
        return weatherGradients.rainy;
    if (c.includes('thunder') || c.includes('storm'))
        return weatherGradients.stormy;

    return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;
};

/** Matching footer background tint for each weather condition. */
export const footerBgFor = (condition: string, isDay: boolean): string => {
    const c = condition.toLowerCase();

    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return 'rgba(2,6,23,0.97)';

    if (c.includes('fog') || c.includes('mist')) return 'rgba(31,41,55,0.97)';
    if (c.includes('haz') || c.includes('smoke')) return 'rgba(41,32,20,0.97)';
    if (c.includes('hot')) return 'rgba(92,35,8,0.97)';

    if (c.includes('sunny') || c.includes('mostly sunny'))
        return 'rgba(2,78,142,0.97)';
    if (c.includes('clear'))
        return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(2,6,23,0.97)';

    if (c.includes('partly') || c.includes('intermittent'))
        return 'rgba(22,34,54,0.97)';
    if (c.includes('cloud') || c.includes('overcast'))
        return 'rgba(16,24,39,0.97)';

    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard'))
        return 'rgba(50,90,130,0.97)';
    if (
        c.includes('sleet') ||
        c.includes('ice') ||
        c.includes('freeze') ||
        c.includes('wintry')
    )
        return 'rgba(10,25,45,0.97)';

    if (c.includes('drizzle') || c.includes('sprinkle'))
        return 'rgba(10,26,48,0.97)';
    if (c.includes('rain') || c.includes('shower')) return 'rgba(6,18,36,0.97)';
    if (c.includes('thunder') || c.includes('storm'))
        return 'rgba(10,8,28,0.97)';

    return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(10,16,32,0.97)';
};

export const formatLastUpdated = (date: Date): string => {
    const totalMins = Math.floor((Date.now() - date.getTime()) / 60_000);

    if (totalMins < 1) return 'Just now';
    if (totalMins < 60) {
        return totalMins === 1 ? '1 min ago' : `${totalMins} mins ago`;
    }

    const totalHours = Math.floor(totalMins / 60);
    if (totalHours < 24) {
        return totalHours === 1 ? '1 hour ago' : `${totalHours} hours ago`;
    }

    const totalDays = Math.floor(totalHours / 24);
    return totalDays === 1 ? '1 day ago' : `${totalDays} days ago`;
};
