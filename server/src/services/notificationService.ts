/**
 * notificationService.ts
 * ─────────────────────
 * Server-side push notification delivery.
 *
 * Tier 1 — server-sent (requires weather API + closet data):
 *   • Weather Change Alert     — 2pm UTC check; fires when afternoon precip
 *                                moves in unexpectedly
 *   • Closet Gap Nudge         — fires in the user's morning window when the
 *                                forecast calls for gear their closet lacks
 *
 * Tier 2 — client-scheduled locally (history lives in AsyncStorage):
 *   • Weekly Wardrobe Recap    — scheduled by NotificationsScreen
 *   • Morning Outfit Brief     — scheduled by useMorningBriefScheduler
 *   • Temperature Swing Warning — folded into the brief's copy, client-side
 *
 * The Morning Outfit Brief used to send from here and no longer does. It needs
 * the outfit engine (src/lib/outfitEngine.ts) and the user's closet to say
 * anything worth reading, and both live on the client — a server-side brief
 * could only ever describe the weather while calling itself an outfit brief.
 * Do not re-add a brief push here without removing the client scheduler first,
 * or users get two notifications every morning.
 *
 * Cron schedule (all UTC):
 *   0 * * * *   — hourly morning pass (snapshot + gap nudge)
 *   0 14 * * *  — afternoon weather change check
 */

import cron from 'node-cron';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import User from '../models/User';
import Closet from '../models/Closet';
import { getCurrent } from '../lib/weatherKit';

const expo = new Expo();

interface WeatherSnapshot {
  tempF: number;
  hasPrecipitation: boolean;
  weatherText: string;
  windMph: number;
}

async function getCurrentWeather(lat: number, lon: number): Promise<WeatherSnapshot | null> {
  try {
    const w = await getCurrent(lat, lon);
    if (!w) return null;
    return {
      tempF:            w.RealFeelTemperature.Imperial.Value,
      hasPrecipitation: w.HasPrecipitation,
      weatherText:      w.WeatherText,
      windMph:          w.Wind.Speed.Imperial.Value,
    };
  } catch {
    return null;
  }
}

// ─── Message builders ─────────────────────────────────────────────────────────

function tempLabel(tempF: number, scale: string): string {
  if (scale === 'Metric') {
    const c = Math.round((tempF - 32) * 5 / 9);
    return `${c}°C`;
  }
  return `${Math.round(tempF)}°F`;
}

function buildGapMessage(
  city:    string,
  weather: WeatherSnapshot,
  types:   Set<string>,
): { title: string; body: string } | null {
  const cityName = city.split(',')[0].trim();
  const text     = weather.weatherText.toLowerCase();
  const isRain   = weather.hasPrecipitation && !/snow/.test(text);
  const isSnow   = /snow/.test(text);
  const isCold   = weather.tempF < 45;
  const isFreeze = weather.tempF < 32;

  const gaps: string[] = [];

  if ((isRain || isSnow) && !types.has('Jacket') && !types.has('Coat')) {
    gaps.push(isSnow ? 'a winter coat' : 'a rain jacket');
  }
  if (isCold && !types.has('Coat') && !types.has('Jacket')) {
    gaps.push('a warm coat');
  }
  if (isFreeze && !types.has('Boots')) {
    gaps.push('winter boots');
  }

  if (gaps.length === 0) return null;

  const list = gaps.length === 1 ? gaps[0] : gaps.slice(0, -1).join(', ') + ' and ' + gaps.at(-1);
  return {
    title: 'Closet Gap Detected',
    body:  `Today's forecast in ${cityName} calls for ${list}. Consider adding these to your closet.`,
  };
}

function buildWeatherChangeMessage(
  city:         string,
  weather:      WeatherSnapshot,
  scale:        string,
): { title: string; body: string } {
  const cityName = city.split(',')[0].trim();
  const temp     = tempLabel(weather.tempF, scale);
  const text     = weather.weatherText.toLowerCase();

  let body = '';
  if (/snow/.test(text))             body = `Snow is moving into ${cityName} — dress for winter conditions.`;
  else if (weather.hasPrecipitation) body = `Rain is moving into ${cityName}. Grab a jacket if you're heading out.`;
  else                               body = `Weather is shifting in ${cityName} — now ${temp} and ${weather.weatherText}.`;

  return { title: 'Weather Update', body };
}

// ─── Send helpers ─────────────────────────────────────────────────────────────

async function sendPush(
  token: string,
  msg: { title: string; body: string },
  url?: string,
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) {
    console.warn('[notifService] Invalid Expo push token:', token);
    return;
  }
  const message: ExpoPushMessage = {
    to:    token,
    sound: 'default',
    title: msg.title,
    body:  msg.body,
    // `data.url` (an `ojo://…` deep link) is read on tap by NotificationDeepLinkRouter
    // and mapped through the same +native-intent table the widget/local notifs use.
    ...(url ? { data: { url } } : {}),
  };
  try {
    const chunks = expo.chunkPushNotifications([message]);
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const receipt of receipts) {
        if (receipt.status === 'error') {
          console.error('[notifService] Push error:', receipt.message, receipt.details);
        }
      }
    }
  } catch (err) {
    console.error('[notifService] sendPush failed:', err);
  }
}

// ─── Morning check (every hour) ───────────────────────────────────────────────

async function runMorningCheck(): Promise<void> {
  const currentUTCHour = new Date().getUTCHours();

  // Selection is no longer keyed on morningBriefEnabled. That flag used to gate
  // this whole pass, which meant the closet gap nudge silently required the
  // brief to be on — two independent toggles, one secretly depending on the
  // other. The brief itself now lives client-side (src/lib/notifications.ts ·
  // scheduleMorningBriefs), so there is nothing here for it to gate.
  //
  // Both consumers of this pass are selected: the gap nudge sends from here, and
  // weather-change users need `lastMorningSnapshot` written even though their
  // push goes out in runAfternoonCheck — without the snapshot that check has no
  // baseline to compare against and degrades to "is it raining right now".
  //
  // `morningBriefHourUTC` stays the timing source: it's the hour the user chose
  // to hear from Ojo in the morning, so the nudge rides along with it rather
  // than introducing a second hour setting nobody set.
  const users = await User.find({
    pushToken: { $exists: true, $ne: null },
    'notificationSettings.morningBriefHourUTC': currentUTCHour,
    $or: [
      { 'notificationSettings.closetGapEnabled':  true },
      { 'notificationSettings.weatherChangeEnabled': true },
    ],
  }).lean();

  if (users.length === 0) return;

  for (const user of users) {
    const city = user.settings?.location;
    const lat  = user.settings?.lat;
    const lon  = user.settings?.lon;
    // Without coords we can't call WeatherKit. The client is responsible for
    // geocoding `location` and PATCHing lat/lon up; users on old clients (no
    // coords yet) get skipped until they re-save their location.
    if (!city || typeof lat !== 'number' || typeof lon !== 'number') continue;

    const weather = await getCurrentWeather(lat, lon);
    if (!weather) continue;

    await User.findByIdAndUpdate(user._id, {
      lastMorningSnapshot: { hasPrecipitation: weather.hasPrecipitation, tempF: weather.tempF, recordedAt: new Date() },
    });

    const ns = user.notificationSettings;

    // Closet gap nudge (optional, same morning window)
    if (ns?.closetGapEnabled) {
      const closets = await Closet.find({ userId: user._id }).lean();
      const articleTypes = new Set(
        closets.flatMap(c => c.articles.map((a: any) => a.clothingType as string)),
      );
      const gapMsg = buildGapMessage(city, weather, articleTypes);
      if (gapMsg) await sendPush(user.pushToken!, gapMsg, 'ojo://closet');
    }
  }
}

// ─── Afternoon weather change check (14:00 UTC daily) ─────────────────────────

const MS_24H = 24 * 60 * 60 * 1_000;

async function runAfternoonCheck(): Promise<void> {
  const users = await User.find({
    pushToken:                                  { $exists: true, $ne: null },
    'notificationSettings.weatherChangeEnabled': true,
  }).lean();

  if (users.length === 0) return;

  for (const user of users) {
    const city = user.settings?.location;
    const lat  = user.settings?.lat;
    const lon  = user.settings?.lon;
    if (!city || typeof lat !== 'number' || typeof lon !== 'number') continue;

    const weather = await getCurrentWeather(lat, lon);
    if (!weather) continue;

    const snap  = user.lastMorningSnapshot;
    const scale = user.settings?.temperatureScale ?? 'Imperial';

    // Only use morning snapshot if it was recorded today (within 24 h)
    const morning = snap && (Date.now() - new Date(snap.recordedAt).getTime() < MS_24H)
      ? snap
      : null;

    const precipChanged = morning
      ? !morning.hasPrecipitation && weather.hasPrecipitation
      : weather.hasPrecipitation;

    const tempDropped = morning
      ? morning.tempF - weather.tempF >= 15
      : false;

    if (precipChanged || tempDropped) {
      const msg = buildWeatherChangeMessage(city, weather, scale);
      await sendPush(user.pushToken!, msg, 'ojo://outfit');
    }
  }
}

// ─── Service entry point ──────────────────────────────────────────────────────

export function startNotificationService(): void {
  // Every hour at :00 — morning brief + gap nudge
  cron.schedule('0 * * * *', () => {
    runMorningCheck().catch(err =>
      console.error('[notifService] morningCheck error:', err),
    );
  });

  // 2pm UTC daily — weather change alert
  cron.schedule('0 14 * * *', () => {
    runAfternoonCheck().catch(err =>
      console.error('[notifService] afternoonCheck error:', err),
    );
  });

  console.log('[notifService] Notification service started');
}
