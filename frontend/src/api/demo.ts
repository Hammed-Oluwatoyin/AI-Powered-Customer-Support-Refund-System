import { apiRequest } from './client.ts'
import type { DemoScenario } from './types.ts'

export function fetchScenarios(): Promise<DemoScenario[]> {
  return apiRequest<DemoScenario[]>('/demo/scenarios')
}
