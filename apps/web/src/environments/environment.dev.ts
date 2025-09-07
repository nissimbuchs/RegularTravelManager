export const environment = {
  production: true,
  apiUrl: 'https://17on7usyre.execute-api.eu-central-1.amazonaws.com/dev',
  cognito: {
    userPoolId: 'eu-central-1_Sj67j0X0j', // Actual deployed user pool
    userPoolClientId: '2flsscfk0cpb1bs7m8pfr7usml', // Actual deployed client
    region: 'eu-central-1', // AWS region
    useMockAuth: false, // dont use mock auth to work with bypassed authorizer
  },
};
