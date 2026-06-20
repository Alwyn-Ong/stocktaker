module.exports = {
  expo: {
    name: 'stocktaker',
    slug: 'stocktaker',
    version: '1.0.0',
    scheme: 'stocktaker',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
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
      package: process.env.ANDROID_PACKAGE_NAME ?? 'com.anonymous.stocktaker',
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-camera', 'expo-sharing', 'expo-web-browser', 'expo-secure-store'],
    extra: {
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
      googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID ?? '',
      googleMasterSheetId: process.env.GOOGLE_MASTER_SHEET_ID ?? '',
    },
  },
};
