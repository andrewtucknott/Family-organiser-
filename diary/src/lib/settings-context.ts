import { createContext, useContext } from 'react'
import { DEFAULT_SETTINGS, type Settings } from './types'

type Ctx = {
  settings: Settings
  saveSettings: (next: Settings) => Promise<void>
}

export const SettingsContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  saveSettings: async () => {},
})

export function useSettings() {
  return useContext(SettingsContext)
}
