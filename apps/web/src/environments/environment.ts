export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  cognito: {
    // Using deployed AWS Cognito infrastructure
    userPoolId: 'eu-central-1_hp5idXPch',
    userPoolClientId: '7l8903utclpthl3rvubsmnk58f',
    region: 'eu-central-1',
    // Use real Cognito authentication with deployed infrastructure
    useMockAuth: true,
  },
  localstack: {
    endpoint: 'http://localhost:4566',
    region: 'eu-central-1',
  },
};
