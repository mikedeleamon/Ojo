// App entry. Two lines, in this order:
//
// 1. Background task definitions (src/lib/background/tasks.ts). TaskManager
//    only delivers an event to a task defined before it arrives, so these must
//    run when the bundle loads — not when expo-router first renders the root
//    layout, which never happens when iOS wakes the app without a window.
// 2. expo-router's own entry, which registers the app component.
import './src/lib/background/tasks';
import 'expo-router/entry';
