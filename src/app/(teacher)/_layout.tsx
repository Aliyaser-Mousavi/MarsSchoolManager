/**
 * Mars School Manager - Teacher Workflow Layout
 */

import React from 'react';
import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export default function TeacherLayout() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = Colors[isDark ? 'dark' : 'light'];

  return (
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
        name="classes"
        options={{
          title: 'صنوف و مضامین تدریسی',
          headerBackTitle: 'برگشت',
        }}
      />
      <Stack.Screen
        name="marks-entry"
        options={{
          title: 'ورود سریع نمرات',
          headerBackTitle: 'صنوف',
        }}
      />
      <Stack.Screen
        name="import-package"
        options={{
          title: 'دریافت و تطبیق بسته نمرات',
          headerBackTitle: 'برگشت',
        }}
      />
    </Stack>
  );
}

