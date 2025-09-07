export const environment = {
  production: true,
  apiUrl: 'https://api.regulartravelmanager.com', // TODO: Update when production API is deployed
  cognito: {
    userPoolId: 'eu-central-1_PRODUCTION_POOL', // TODO: Update when production Cognito is deployed
    userPoolClientId: 'production-client-id', // TODO: Update when production Cognito is deployed
    region: 'eu-central-1',
    useMockAuth: false, // Use real Cognito authentication in production
  },
};
