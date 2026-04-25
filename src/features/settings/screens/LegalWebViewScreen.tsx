import { useState } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable, ScrollView } from '../../../components/primitives';
import { WebView } from 'react-native-webview';
import { LegalDocument, EFFECTIVE_DATE, shouldUseIframe } from '../../../config/legal';
import { colors, spacing, radius, fonts, fontSizes } from '../../../theme/tokens';

interface Props {
  doc?:     LegalDocument;  // passed from SettingsScreen inline
  onClose?: () => void;
}

export default function LegalWebViewScreen({ doc, onClose }: Props) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  if (!doc) return null;

  const useWebView = shouldUseIframe(doc.url);

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{doc.title}</Text>
          <Text style={styles.headerSub}>{doc.subtitle} · Effective: {EFFECTIVE_DATE}</Text>
        </View>
        {onClose && (
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close">
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Content */}
      {useWebView ? (
        <>
          {loadState === 'loading' && (
            <View style={styles.center}>
              <ActivityIndicator color={colors.textPrimary} />
              <Text style={styles.loadingText}>Loading document…</Text>
            </View>
          )}
          {loadState === 'error' && (
            <View style={styles.center}>
              <Text style={styles.errorText}>Unable to load document.</Text>
              <Pressable style={styles.retryBtn} onPress={() => setLoadState('loading')}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}
          <WebView
            source={{ uri: doc.url }}
            style={[{ flex: 1 }, loadState !== 'ready' && { height: 0 }]}
            onLoad={() => setLoadState('ready')}
            onError={() => setLoadState('error')}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.inline}>
          {doc.sections.map(section => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.sectionHeading}>{section.heading}</Text>
              {section.body?.map((para, i) => (
                <Text key={i} style={styles.para}>{para}</Text>
              ))}
              {section.bullets?.map((item, i) => (
                <Text key={i} style={styles.bullet}>· {item}</Text>
              ))}
              {section.subsections?.map(sub => (
                <View key={sub.heading} style={styles.subsection}>
                  <Text style={styles.subsectionHeading}>{sub.heading}</Text>
                  {sub.body.map((para, i) => (
                    <Text key={i} style={styles.para}>{para}</Text>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.bgDefault },
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    padding:          spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  headerText:  { flex: 1, gap: 2 },
  headerTitle: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: '600', color: colors.textPrimary },
  headerSub:   { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.textSecondary },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  errorText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary },
  retryBtn:    { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: colors.glassBg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.glassBorder },
  retryText:   { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textPrimary },
  inline:      { padding: spacing.md, paddingBottom: spacing.xl, gap: 24 },
  section:     { gap: 8 },
  sectionHeading: { fontFamily: fonts.body, fontSize: fontSizes.base, fontWeight: '600', color: colors.textPrimary, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.glassBorder },
  subsection:  { marginLeft: 16, gap: 6 },
  subsectionHeading: { fontFamily: fonts.body, fontSize: fontSizes.sm, fontWeight: '600', color: colors.textSecondary },
  para:        { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.7 },
  bullet:      { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: fontSizes.sm * 1.65, paddingLeft: 8 },
});
