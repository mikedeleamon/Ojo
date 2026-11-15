// Adds Ojo's Siri / Shortcuts intents to the main app target, so a clean
// `expo prebuild` keeps them:
//   - native/siri/OjoAppIntents.swift: the "What should I wear" intents and the
//     App Shortcuts phrases. App Shortcuts must live in the main app, not the
//     widget extension.
//   - targets/ojo-widget/Snapshot.swift: the widget's snapshot model, compiled
//     into the app too so both read snapshot.json the same way.
// Both stay outside ios/ and are referenced by path, so there's one copy of each.
const path = require('path');
const { withXcodeProjectBeta } = require('@bacons/apple-targets/build/with-bacons-xcode');

// Relative to ios/, which is where the "Ojo" group's paths start.
const FILES = ['../native/siri/OjoAppIntents.swift', '../targets/ojo-widget/Snapshot.swift'];

module.exports = function withSiriShortcuts(config) {
  return withXcodeProjectBeta(config, (config) => {
    const project = config.modResults.rootObject;
    const target = project.props.targets.find(
      (t) => t.props.productType === 'com.apple.product-type.application',
    );
    if (!target) throw new Error('withSiriShortcuts: no application target.');

    const group = project.props.mainGroup
      .getChildGroups()
      .find((g) => g.getDisplayName() === target.props.name);
    if (!group) throw new Error(`withSiriShortcuts: no "${target.props.name}" group.`);

    const phase = target.getSourcesBuildPhase();
    for (const rel of FILES) {
      let ref = group.props.children.find((c) => c.props.path === rel);
      if (!ref) {
        ref = group.createFile({
          path: rel,
          name: path.basename(rel),
          sourceTree: '<group>',
          lastKnownFileType: 'sourcecode.swift',
        });
      }
      phase.ensureFile({ fileRef: ref });
    }
    return config;
  });
};
