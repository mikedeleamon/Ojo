import { useMemo } from 'react';
import { View, Text, GlassCard } from '../../../components/primitives';
import { makeStyles } from './SettingsSection.styles';
import { SettingsSectionConfig, SettingsAction } from '../config';
import { Settings } from '../../../types';
import SettingsItem from './SettingsItem';
import { useTheme } from '../../../theme/ThemeContext';

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

const SettingsSection = ({ section, settings, onAction }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{section.title}</Text>
      <GlassCard style={styles.group}>
        {section.items.map((item, i) => (
          <SettingsItem
            key={item.key}
            label={item.label}
            sublabel={item.sublabelKey ? getSublabel(item.sublabelKey, settings) : undefined}
            onPress={() => onAction(item.action)}
            isFirst={i === 0}
          />
        ))}
      </GlassCard>
    </View>
  );
};

export default SettingsSection;
