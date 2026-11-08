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
  /** The account route open beside the list in two panes. */
  activeRoute?: string;
}

const getSublabel = (
  key: SettingsSectionConfig['items'][0]['sublabelKey'],
  settings: Settings,
): string => {
  if (!key) return '';
  if (key === 'temperatureScale') return settings.temperatureScale === 'Imperial' ? '°F' : '°C';
  if (key === 'clothingStyle') {
    const arr = settings.clothingStyles;
    if (!arr?.length) return settings.clothingStyle ?? '';
    if (arr.length <= 2) return arr.join(', ');
    return `${arr.slice(0, 2).join(', ')} +${arr.length - 2}`;
  }
  const v = settings[key];
  return typeof v === 'string' && v.trim() ? v : '';
};

const isActive = (action: SettingsAction, route?: string) => {
  if (!route) return false;
  if (action.type === 'navigate') return action.to === `/account/${route}`;
  return action.type === 'legal' && route === 'legal';
};

const SettingsSection = ({ section, settings, onAction, activeRoute }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{section.title}</Text>
      <GlassCard style={styles.group}>
        {section.items.map((item, i) => (
          <View key={item.key} style={isActive(item.action, activeRoute) ? { backgroundColor: colors.glassBg } : undefined}>
          <SettingsItem
            label={item.label}
            sublabel={item.sublabel ?? (item.sublabelKey ? getSublabel(item.sublabelKey, settings) : undefined)}
            onPress={() => onAction(item.action)}
            isFirst={i === 0}
          />
          </View>
        ))}
      </GlassCard>
    </View>
  );
};

export default SettingsSection;
