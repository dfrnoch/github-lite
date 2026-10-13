#!/usr/bin/env bash
# Builds and installs the "GitHub Lite Redirect" Safari extension.
# Safari loads web extensions only from inside a signed macOS app, so this
# wraps src/ with Apple's converter, builds it with xcodebuild, and installs
# the app to ~/Applications. Then enable it in Safari → Settings → Extensions.
#
# Signed with your "Apple Development" identity: Safari lists development-signed
# extensions, but hides Developer ID builds until they're notarized.
# Usage: ./build.sh  or  TEAM_ID=XXXXXXXXXX ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

APP_NAME="GitHub Lite Redirect"
BUNDLE_ID="dev.frnoch.github-lite-redirect"
BUILD_DIR="$(pwd)/build"
DEV_CERT="$(security find-identity -v -p codesigning | grep -o '"Apple Development: [^"]*"' | head -1 | tr -d '"')"
TEAM_ID="${TEAM_ID:-$(security find-certificate -c "$DEV_CERT" -p | openssl x509 -noout -subject | sed -E 's/.*OU=([A-Z0-9]{10}).*/\1/')}"

rm -rf "$BUILD_DIR"
xcrun safari-web-extension-converter src \
  --project-location "$BUILD_DIR" \
  --app-name "$APP_NAME" \
  --bundle-identifier "$BUNDLE_ID" \
  --macos-only --swift --no-open --no-prompt --force

# The converter derives the app's bundle id from its name; make it the prefix
# of the extension's id, which Xcode requires.
PBXPROJ="$BUILD_DIR/$APP_NAME/$APP_NAME.xcodeproj/project.pbxproj"
perl -pi -e "s/PRODUCT_BUNDLE_IDENTIFIER = \"?(?![^;]*\.Extension)[^;]*;/PRODUCT_BUNDLE_IDENTIFIER = $BUNDLE_ID;/" "$PBXPROJ"

xcodebuild \
  -project "$BUILD_DIR/$APP_NAME/$APP_NAME.xcodeproj" \
  -scheme "$APP_NAME" \
  -configuration Release \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGN_STYLE=Manual \
  CODE_SIGN_IDENTITY="Apple Development" \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  ENABLE_HARDENED_RUNTIME=YES \
  -quiet build

APP="$BUILD_DIR/DerivedData/Build/Products/Release/$APP_NAME.app"
mkdir -p "$HOME/Applications"
rm -rf "$HOME/Applications/$APP_NAME.app"
cp -R "$APP" "$HOME/Applications/"
codesign --verify --deep --strict "$HOME/Applications/$APP_NAME.app"
echo "Installed: $HOME/Applications/$APP_NAME.app"

# Launching the app once registers the extension with Safari.
open "$HOME/Applications/$APP_NAME.app"
