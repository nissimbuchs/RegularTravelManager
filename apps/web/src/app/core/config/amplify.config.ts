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

  const config: AmplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: environment.cognito.userPoolId,
        userPoolClientId: environment.cognito.userPoolClientId,
        region: environment.cognito.region
      }
    }
  };

  Amplify.configure(config);
}