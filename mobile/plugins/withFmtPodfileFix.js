/**
 * Expo config plugin: fix `fmt::basic_format_string ... consteval` error
 * on Xcode 26 by forcing only the `fmt` pod to compile as C++17.
 *
 * Source: https://bleepingswift.com/blog/fmt-consteval-error-xcode-26-4-react-native
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# >>> withFmtPodfileFix";

const FIX_SNIPPET = `
  ${MARKER}
  installer.pods_project.targets.each do |target|
    if ['fmt', 'glog', 'RCT-Folly'].include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
      end
    end
  end
  # <<< withFmtPodfileFix
`;

function patchPodfile(podfile) {
  if (podfile.includes(MARKER)) return podfile;

  // Inject right after `react_native_post_install(installer, ...)`.
  const rnPostInstallRegex = /react_native_post_install\([^)]*\)\s*\n/;
  const match = podfile.match(rnPostInstallRegex);
  if (match) {
    const idx = match.index + match[0].length;
    return podfile.slice(0, idx) + FIX_SNIPPET + podfile.slice(idx);
  }

  // Fallback: inject before the first `end` after `post_install do |installer|`
  const postInstallStart = podfile.indexOf("post_install do |installer|");
  if (postInstallStart !== -1) {
    const endIdx = podfile.indexOf("\nend", postInstallStart);
    if (endIdx !== -1) {
      return podfile.slice(0, endIdx) + FIX_SNIPPET + podfile.slice(endIdx);
    }
  }

  // Last resort: append a brand new post_install block.
  return podfile + `\n\npost_install do |installer|${FIX_SNIPPET}end\n`;
}

function withFmtPodfileFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      if (!fs.existsSync(podfilePath)) return cfg;
      const original = fs.readFileSync(podfilePath, "utf-8");
      const patched = patchPodfile(original);
      if (patched !== original) {
        fs.writeFileSync(podfilePath, patched);
        console.log("[withFmtPodfileFix] Podfile patched ✓");
      }
      return cfg;
    },
  ]);
}

module.exports = withFmtPodfileFix;
