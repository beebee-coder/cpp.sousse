"use client";

import { useMemo } from 'react';
import { procedureTranslations } from '@/lib/i18n/procedures';

export function useTranslation(): (key: string, ...args: any[]) => string {
  return useMemo(() => {
    return (key: string, ...args: any[]): string => {
      const keys = key.split('.');
      let value: any = procedureTranslations;

      for (const k of keys) {
        value = value?.[k];
      }

      if (typeof value === 'function') {
        return value(...args);
      }

      if (typeof value === 'string') {
        return value;
      }

      console.warn(`Translation missing for key: ${key}`);
      return key;
    };
  }, []);
}
