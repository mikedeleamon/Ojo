import { View, Text } from '../../../components/primitives';
import { styles } from './SettingsSection.styles';
import { SettingsSectionConfig, SettingsAction } from '../config';
import { Settings } from '../../../types';
import SettingsItem from './SettingsItem';

interface Props {
  section:  SettingsSectionConfig;
  settings: Settings;
  onAction: (action: SettingsAction) => void;
}

const getSublabel = (
  key: SettingsSectionConfig['items'][0]['sublabelKey'],
  settings: Settings,
): string => {
  if (!key) return '';
  if (key === 'temperatureScale') return settings.temperatureScale === 'Imperial' ? '°F' : '°C';
  const v = settings[key];
  return typeof v === 'string' && v.trim() ? v : '';
};

const SettingsSection = ({ section, settings, onAction }: Props) => (
  <View style={styles.section}>
    <Text style={styles.title}>{section.title}</Text>
    <View style={styles.group}>
      {section.items.map(item => (
        <SettingsItem
          key={item.key}
          label={item.label}
          sublabel={item.sublabelKey ? getSublabel(item.sublabelKey, settings) : undefined}
          onPress={() => onAction(item.action)}
        />
      ))}
    </View>
  </View>
);

export default SettingsSection;
