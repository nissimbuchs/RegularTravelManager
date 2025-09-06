export const environment = {
  production: true,
  apiUrl: 'https://a8xznik0n8.execute-api.eu-central-1.amazonaws.com/dev',
  cognito: {
    userPoolId: 'eu-central-1_hp5idXPch', // Actual deployed user pool
    userPoolClientId: '7l8903utclpthl3rvubsmnk58f', // Actual deployed client
    region: 'eu-central-1', // AWS region
    useMockAuth: true, // Use mock auth to work with bypassed authorizer
  },
};
