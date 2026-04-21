import { SettingsSectionConfig, SettingsAction } from '../config';
import { Settings } from '../../../types';
import SettingsItem from './SettingsItem';
import styles from './SettingsSection.module.css';

interface Props {
  section:   SettingsSectionConfig;
  settings:  Settings;
  onAction:  (action: SettingsAction) => void;
}

/** Derives the display value for a sublabel key from the live settings object. */
const getSublabel = (key: SettingsSectionConfig['items'][0]['sublabelKey'], settings: Settings): string => {
  if (!key) return '';
  if (key === 'temperatureScale') return settings.temperatureScale === 'Imperial' ? '°F' : '°C';
  const value = settings[key];
  return typeof value === 'string' && value.trim() ? value : '';
};

/**
 * One settings group: a muted section title above a frosted card of rows.
 *
 * React Native migration note:
 *   <div className={styles.group}>  → <View style={styles.group}>
 *   <span className={styles.title}> → <Text style={styles.title}>
 */
const SettingsSection = ({ section, settings, onAction }: Props) => (
  <div className={styles.section}>
    <span className={styles.title}>{section.title}</span>

    <div className={styles.group}>
      {section.items.map(item => (
        <SettingsItem
          key={item.key}
          label={item.label}
          sublabel={item.sublabelKey ? getSublabel(item.sublabelKey, settings) : undefined}
          onPress={() => onAction(item.action)}
        />
      ))}
    </div>
  </div>
);

export default SettingsSection;
