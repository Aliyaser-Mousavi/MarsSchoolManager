/**
 * Mars School Manager - Root Application Layout
 * Provides ThemeProvider, DatabaseProvider, and Stack Navigation
 */

import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { DatabaseProvider } from '@/providers/DatabaseProvider';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DarkTheme : DefaultTheme;
  const colors = Colors[isDark ? 'dark' : 'light'];

  return (
    <ThemeProvider value={theme}>
      <DatabaseProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerTitleStyle: {
              fontWeight: '700',
            },
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'مدیریت مکتب مارس',
              headerShown: true,
            }}
          />
        </Stack>
      </DatabaseProvider>
    </ThemeProvider>
  );
}
