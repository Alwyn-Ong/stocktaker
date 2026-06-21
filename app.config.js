const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME ?? 'com.anonymous.stocktaker';
const APP_NAME = process.env.APP_NAME ?? 'Stocktaker';
const APP_ICON = process.env.APP_ICON ?? './assets/icon.png';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'stocktaker',
    version: '1.0.0',
    orientation: 'portrait',
    icon: APP_ICON,
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: PACKAGE_NAME,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
      package: PACKAGE_NAME,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-camera', 'expo-sharing', '@react-native-google-signin/google-signin'],
    extra: {
      appName: APP_NAME,
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
      googleMasterSheetId: process.env.GOOGLE_MASTER_SHEET_ID ?? '',
    },
  },
};
