
import { useAppNavigation } from '../../../hooks/useAppNavigation';
import { View, Text, Pressable } from '../../../components/primitives';
import styles from './ScreenShell.module.css';

interface Props {
  title:     string;
  children:  React.ReactNode;
  embedded?: boolean;
}

/**
 * React Native migration:
 *   Delete this component entirely.
 *   React Navigation provides the header via Stack.Screen options:
 *
 *   <Stack.Screen
 *     name="Profile"
 *     component={ProfileScreen}
 *     options={{ title: 'Profile', headerBackTitle: '' }}
 *   />
 */
const ScreenShell = ({ title, children, embedded = false }: Props) => {
  const nav = useAppNavigation();

  return (
    <View style={`${styles.root} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <View style={styles.header}>
          <Pressable
            onPress={() => nav.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Back"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Pressable>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
      <View style={`${styles.content} ${embedded ? styles.embeddedContent : ''}`}>
        {children}
      </View>
    </View>
  );
};

export default ScreenShell;
