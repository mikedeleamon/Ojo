/**
 * recapDemo — the spec's sample week, in engine shape ({ cards, meta }), for
 * design iteration and screenshots. Reachable only in dev via
 * `/account/recap?demo=1`. Color names are canonical-cased so recapSwatchHex
 * resolves them (the spec's lowercase tokens would fall back to neutral).
 */

import { RecapCard, RecapWeekMeta } from '../../lib/recapEngine';

const day = (initial: string, date: string, colors: string[]) => ({ initial, date, colors });

const meta: RecapWeekMeta = {
  weekLabel: 'Week 28 · 2026',
  dateRange: 'Jul 6–12',
  weekStamp: '2026 — W28',
  outfitsThisWeek: 20,
  daysLogged: 7,
  daily: [
    day('M', '2026-07-06', ['Blue', 'Blue', 'Black']),
    day('T', '2026-07-07', ['Blue', 'Cream', 'Blue']),
    day('W', '2026-07-08', ['Blue', 'Black']),
    day('T', '2026-07-09', ['Blue', 'Blue', 'Blue']),
    day('F', '2026-07-10', ['Cream', 'Black', 'Blue']),
    day('S', '2026-07-11', ['Blue', 'Blue', 'Black']),
    day('S', '2026-07-12', ['Blue', 'Cream', 'Blue']),
  ],
  palette: [
    { name: 'Blue', count: 19 },
    { name: 'Black', count: 13 },
    { name: 'Cream', count: 6 },
    { name: 'Olive', count: 4 },
  ],
  allTime: { count: 50, milestone: 50 },
};

const cards: RecapCard[] = [
  {
    templateId: 'hero_week', section: 'opener',
    headline: 'Your week, worn well.',
    body: 'Seven days, 20 looks. Your closet showed up — here\'s how it read.',
    stat: { value: '20', label: 'outfits this week' },
  },
  {
    templateId: 'color_story', section: 'color',
    headline: 'All signs point to Blue.',
    body: '19 of 20 outfits leaned Blue. At this point it\'s a personality trait.',
    stat: { value: '19/20', label: 'outfits' },
    colorNames: ['Blue'],
  },
  {
    templateId: 'mvp_item', section: 'items',
    headline: 'MVP: your Black Adidas.',
    body: '13 appearances in seven days — someone\'s earning their hanger space.',
    stat: { value: '13', label: 'wears this week' },
  },
  {
    templateId: 'milestone', section: 'habits',
    headline: 'That\'s 50 outfits.',
    body: 'Most people can\'t name 50 outfits they\'ve worn. You have receipts.',
    stat: { value: '50', label: 'outfits, all-time' },
  },
  {
    templateId: 'trip_week', section: 'context',
    headline: 'You packed. It worked.',
    body: '2 looks logged on your Arlington trip — planned before you even left.',
    stat: { value: '2', label: 'outfits in Arlington' },
  },
  {
    templateId: 'share_cta', section: 'closer', cta: 'share',
    headline: 'That was your week.',
    body: 'Share it, or let next week top it.',
  },
];

export const DEMO_RECAP: { cards: RecapCard[]; meta: RecapWeekMeta } = { cards, meta };
