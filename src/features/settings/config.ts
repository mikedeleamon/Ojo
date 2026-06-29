export type SettingsAction =
  | { type: 'navigate'; to: string }
  | { type: 'legal';    doc: 'privacy' | 'terms' }
  | { type: 'external'; url: string };

export interface SettingsItemConfig {
  key:          string;
  label:        string;
  sublabelKey?: 'clothingStyle' | 'location' | 'temperatureScale';
  action:       SettingsAction;
}

export interface SettingsSectionConfig {
  title: string;
  items: SettingsItemConfig[];
}

export const SETTINGS_CONFIG: SettingsSectionConfig[] = [
  {
    title: 'Account',
    items: [
      { key: 'profile',        label: 'Profile',         action: { type: 'navigate', to: '/account/profile' } },
      { key: 'password',       label: 'Password',        action: { type: 'navigate', to: '/account/password' } },
      { key: 'history',        label: 'Outfit History',  action: { type: 'navigate', to: '/account/history' } },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { key: 'outfit-prefs', label: 'Style preference', sublabelKey: 'clothingStyle', action: { type: 'navigate', to: '/account/preferences' } },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { key: 'notifications', label: 'Push Notifications', action: { type: 'navigate', to: '/account/notifications' } },
    ],
  },
  {
    title: 'Trips',
    items: [
      { key: 'trip-mode', label: 'Trip Mode', action: { type: 'navigate', to: '/account/trip-mode' } },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      { key: 'permissions', label: 'Permissions', action: { type: 'navigate', to: '/account/permissions' } },
      { key: 'data-usage',  label: 'Data Usage',  action: { type: 'navigate', to: '/account/data-usage' } },
    ],
  },
  {
    title: 'Legal',
    items: [
      { key: 'privacy', label: 'Privacy Policy',   action: { type: 'legal', doc: 'privacy' } },
      { key: 'terms',   label: 'Terms of Service', action: { type: 'legal', doc: 'terms' } },
    ],
  },
];
