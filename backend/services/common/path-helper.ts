/**
 * Path Helper Utility
 * 
 * Centralized path building for service-to-service HTTP communication.
 * Ensures consistent path construction based on service configuration.
 * 
 * Services WITH /api global prefix:
 * - Seat Service (port 3003)
 * - Reservation Service (port 3004)
 * - Payment Service (port 3005)
 * - Ticket Service (port 3006)
 * - Notification Service (port 3007)
 * 
 * Services WITHOUT /api global prefix:
 * - Auth Service (port 3001)
 * - Event Service (port 3002)
 */

export const SERVICES_WITH_API_PREFIX = [
  'seat',
  'reservation',
  'payment',
  'ticket',
  'notification',
] as const;

export type ServiceWithApiPrefix = typeof SERVICES_WITH_API_PREFIX[number];

/**
 * Builds the correct path for a service endpoint
 * @param serviceName - Name of the service (e.g., 'seat', 'auth', 'event')
 * @param endpoint - The endpoint path (e.g., '/seats/lock', '/auth/register')
 * @returns The complete path with /api prefix if needed
 */
export function buildServicePath(
  serviceName: string,
  endpoint: string
): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // Check if service uses /api prefix
  const hasApiPrefix = SERVICES_WITH_API_PREFIX.includes(
    serviceName.toLowerCase() as ServiceWithApiPrefix
  );
  
  if (hasApiPrefix) {
    // Service has /api prefix, so path should be /api/...
    return `/api${normalizedEndpoint}`;
  } else {
    // Service has no prefix, use endpoint as-is
    return normalizedEndpoint;
  }
}

/**
 * Helper to build paths for specific services
 */
/**
 * Helper to build paths for specific services
 */
export const ServicePaths = {
  // Auth Service (no /api prefix)
  auth: (endpoint: string) => buildServicePath('auth', endpoint),
  
  // Event Service (no /api prefix)
  event: (endpoint: string) => buildServicePath('event', endpoint),
  
  // Seat Service (has /api prefix)
  seat: (endpoint: string) => buildServicePath('seat', endpoint),
  
  // Reservation Service (has /api prefix)
  reservation: (endpoint: string) => buildServicePath('reservation', endpoint),
  
  // Payment Service (has /api prefix)
  payment: (endpoint: string) => buildServicePath('payment', endpoint),
  
  // Ticket Service (has /api prefix)
  ticket: (endpoint: string) => buildServicePath('ticket', endpoint),
  
  // Notification Service (has /api prefix)
  notification: (endpoint: string) => buildServicePath('notification', endpoint),
};
