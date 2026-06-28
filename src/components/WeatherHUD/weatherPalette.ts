// Condition → gradient / footer-tint now live in the shared classifier so the
// icon picker and these palettes can't drift apart. Re-exported here to keep
// existing import sites (WeatherHUD) working.
export { gradientFor, footerBgFor } from '../../lib/weather/conditions';

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
