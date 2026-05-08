export type HealthState = 'ok' | 'degraded' | 'down';

export interface HealthCheckResponse {
  status: HealthState;
  service: string;
  version: string;
  timestamp: string;
  dependencies: {
    database: HealthState;
  };
}
