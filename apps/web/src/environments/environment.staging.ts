export const environment = {
  production: true,
  apiUrl: 'https://api-staging.regulartravelmanager.com', // TODO: Update when staging API is deployed
  cognito: {
    userPoolId: 'eu-central-1_STAGING_POOL', // TODO: Update when staging Cognito is deployed
    userPoolClientId: 'staging-client-id', // TODO: Update when staging Cognito is deployed
    region: 'eu-central-1',
    useMockAuth: false, // Use real Cognito authentication in staging
  },
};
