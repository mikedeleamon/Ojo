/**
 * Settings configuration.
 * UI renders entirely from this structure — no hardcoded rows anywhere.
 *
 * action types:
 *   navigate — handled differently per layout:
 *              desktop → sets activeScreen state (inline render)
 *              mobile  → pushes /account/<to> route
 *   legal    — opens LegalModal inline
 *   external — opens URL in new tab
 */

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
      { key: 'profile',  label: 'Profile',       action: { type: 'navigate', to: 'profile' } },
      { key: 'password', label: 'Password',      action: { type: 'navigate', to: 'password' } },
      { key: 'history',  label: 'Outfit History', action: { type: 'navigate', to: 'history' } },
    ],
  },
  {
    title: 'Preferences',
    items: [
      {
        key: 'preferences',
        label: 'Style, Location & Weather',
        sublabelKey: 'clothingStyle',
        action: { type: 'navigate', to: 'preferences' },
      },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { key: 'notifications', label: 'Push Notifications', action: { type: 'navigate', to: 'notifications' } },
    ],
  },
  {
    title: 'Privacy & Security',
    items: [
      { key: 'permissions', label: 'Permissions', action: { type: 'navigate', to: 'permissions' } },
      { key: 'data-usage',  label: 'Data Usage',  action: { type: 'navigate', to: 'data-usage' } },
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
