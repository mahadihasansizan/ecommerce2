import React, { createContext, useContext } from 'react';

export type InitialData = Record<string, any>;

const InitialDataContext = createContext<InitialData>({});

export function InitialDataProvider({
  data,
  children,
}: {
  data: InitialData;
  children: React.ReactNode;
}) {
  return (
    <InitialDataContext.Provider value={data}>
      {children}
    </InitialDataContext.Provider>
  );
}

export function useSSRData<T = any>(key: string): T | undefined {
  const contextData = useContext(InitialDataContext);

  if (typeof window !== 'undefined') {
    const globalData = (window as any).__INITIAL_DATA__ || {};
    return (contextData && key in contextData ? contextData[key] : undefined) ??
      (key in globalData ? globalData[key] : undefined);
  }

  return contextData && key in contextData ? (contextData[key] as T) : undefined;
}

export function serializeInitialData(data: InitialData) {
  const safe = JSON.stringify(data || {}).replace(/</g, '\\u003c');
  return `<script>window.__INITIAL_DATA__=${safe};</script>`;
}
