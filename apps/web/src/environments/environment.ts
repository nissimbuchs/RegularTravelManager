export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  cognito: {
    // LocalStack Community edition - using mock authentication for development
    userPoolId: 'local-pool-id',
    userPoolClientId: 'local-client-id',
    region: 'eu-central-1',
    domain: 'localhost.localstack.cloud',
    // Use mock authentication in community edition
    useMockAuth: true,
  },
  localstack: {
    endpoint: 'http://localhost:4566',
    region: 'eu-central-1',
  },
};
