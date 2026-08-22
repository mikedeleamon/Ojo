/**
 * Root-level error boundary. Renders a recoverable fallback when any child
 * throws during render, instead of letting the app crash to a blank screen.
 *
 * The render path stays dep-free (no theme/context) so it can draw even when
 * the crash happened inside a provider higher up the tree. Sentry is imported
 * but only touched in componentDidCatch, never during render, so a broken
 * provider still can't stop the fallback from appearing.
 */

import { Component, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Sentry from '@sentry/react-native';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // These are the crashes Apple never sees. A render error caught here does
    // not terminate the process, so it produces no native crash report — the
    // user just gets the fallback below. Sentry is the only way we hear about
    // it, which is why this reports before it logs.
    Sentry.captureException(error, {
      contexts: { react: { componentStack: info?.componentStack ?? undefined } },
      tags: { boundary: 'root' },
    });
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          Ojo hit an unexpected error. Tap below to try again.
        </Text>
        {__DEV__ && (
          <Text style={styles.devDetail} numberOfLines={6}>
            {error.message}
          </Text>
        )}
        <Pressable
          style={styles.button}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0F172A',
  },
  title: {
    color: 'rgba(255,255,255,0.97)',
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  devDetail: {
    color: 'rgba(252,165,165,0.85)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Courier',
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  buttonText: {
    color: 'rgba(255,255,255,0.97)',
    fontSize: 15,
    fontWeight: '500',
  },
});
