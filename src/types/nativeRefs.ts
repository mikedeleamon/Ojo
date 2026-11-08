import type { ComponentRef } from 'react';
import type { ScrollView, View } from 'react-native';

// React Native's strict types make View and ScrollView plain function
// components, so `useRef<View>` no longer names the mounted instance. These do.
export type ViewRef = ComponentRef<typeof View>;
export type ScrollViewRef = ComponentRef<typeof ScrollView>;
