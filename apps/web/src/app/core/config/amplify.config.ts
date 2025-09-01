import { Amplify } from 'aws-amplify';
import { environment } from '../../../environments/environment';

export interface AmplifyConfig {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
      region: string;
    };
  };
}

export function configureAmplify(): void {
  // Skip configuration in test environment
  if (typeof window === 'undefined') {
    return;
  }

  // Skip Amplify configuration if using mock authentication
  if (environment.cognito.useMockAuth) {
    console.log('🧪 Mock authentication enabled - skipping Amplify configuration');
    return;
  }

  const config: AmplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: environment.cognito.userPoolId,
        userPoolClientId: environment.cognito.userPoolClientId,
        region: environment.cognito.region,
      },
    },
  };

  Amplify.configure(config);
  console.log('✅ Amplify configured for real Cognito authentication');
}
