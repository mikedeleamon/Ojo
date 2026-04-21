import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Closet, CurrentWeather, Settings } from '../../types';
import { generateOutfit, OutfitRole } from '../../lib/outfitEngine';
import { getToken } from '../../lib/auth';
import styles from './WearTodayStrip.module.css';

const CSS_COLORS: Record<string, string> = {
  Black: '#1a1a1a', White: '#f5f5f5', Grey: '#9ca3af', Navy: '#1e3a5f',
  Blue: '#3b82f6', Green: '#22c55e', Red: '#ef4444', Brown: '#92400e',
  Beige: '#d4b896', Pink: '#f9a8d4', Yellow: '#fbbf24', Purple: '#a855f7',
  Orange: '#f97316', Multi: 'linear-gradient(135deg, #f97316, #3b82f6, #22c55e)',
};

const ROLE_ICON: Record<OutfitRole, string> = {
  top: '👕', bottom: '👖', fullBody: '👗',
  outerwear: '🧥', footwear: '👟', accessory: '✨',
};

interface Props {
  weather:  CurrentWeather;
  settings: Settings;
}

const WearTodayStrip = ({ weather, settings }: Props) => {
  const [closets, setClosets] = useState<Closet[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    axios.get<Closet[]>('/api/closets', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setClosets(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const preferred = useMemo(() => closets.find(c => c.isPreferred) ?? null, [closets]);

  const outfit = useMemo(() => {
    if (!preferred || preferred.articles.length === 0) return null;
    return generateOutfit(preferred.articles, weather, settings);
  }, [preferred, weather, settings]);

  // Don't render if loading, no closet, or insufficient articles
  if (loading || !outfit || outfit.status !== 'ok' || outfit.slots.length === 0) return null;

  const tempVal = settings.temperatureScale === 'Metric'
    ? weather.Temperature.Metric.Value
    : weather.Temperature.Imperial.Value;
  const tempUnit = settings.temperatureScale === 'Metric' ? '°C' : '°F';

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className={styles.headerIcon}>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span className={styles.label}>Wear today</span>
        </div>
        <span className={styles.temp}>{tempVal}{tempUnit} · {weather.WeatherText}</span>
      </div>

      <div className={styles.strip}>
        {outfit.slots.map((slot, i) => (
          <div key={i} className={styles.pill} style={{ animationDelay: `${i * 0.07}s` }}>
            {slot.article.imageUrl ? (
              <img
                src={slot.article.imageUrl}
                alt={slot.article.name || slot.article.clothingType}
                className={styles.pillImg}
              />
            ) : (
              <span className={styles.pillEmoji}>{ROLE_ICON[slot.role]}</span>
            )}
            <div className={styles.pillInfo}>
              <span className={styles.pillName}>{slot.article.name || slot.article.clothingType}</span>
              {slot.article.color && (
                <span
                  className={styles.colorDot}
                  style={{ background: CSS_COLORS[slot.article.color] ?? '#888' }}
                  title={slot.article.color}
                />
              )}
            </div>
          </div>
        ))}

        {outfit.notes.length > 0 && (
          <div className={`${styles.pill} ${styles.notePill}`}>
            <span className={styles.noteIcon}>💡</span>
            <span className={styles.noteText}>{outfit.notes[0]}</span>
          </div>
        )}
      </div>

      {outfit.headline && (
        <p className={styles.headline}>{outfit.headline}</p>
      )}

      <button className={styles.closetLink} onClick={() => navigate('/closet')}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
          <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Open closet
      </button>
    </div>
  );
};

export default WearTodayStrip;
