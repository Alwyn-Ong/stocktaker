const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME ?? 'com.anonymous.stocktaker';
const APP_NAME = process.env.APP_NAME ?? 'Stocktaker';
const APP_ICON = process.env.APP_ICON ?? './assets/logo-override.png';

module.exports = {
  expo: {
    name: APP_NAME,
    slug: 'stocktaker',
    version: require('./package.json').version,
    orientation: 'portrait',
    icon: APP_ICON,
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: PACKAGE_NAME,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#1F2933',
        foregroundImage: './assets/logo-override.png',
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
      googleReportFolderId: process.env.GOOGLE_REPORT_FOLDER_ID ?? '',
    },
  },
};
