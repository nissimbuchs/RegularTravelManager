import { Amplify } from 'aws-amplify';
import { ConfigService } from '../services/config.service';

export interface AmplifyConfig {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
      region: string;
    };
  };
}

export function configureAmplify(configService: ConfigService): void {
  // Skip configuration in test environment
  if (typeof window === 'undefined') {
    return;
  }

  const cognitoConfig = configService.cognitoConfig;

  // Skip Amplify configuration if using mock authentication
  if (cognitoConfig.useMockAuth) {
    console.log('🧪 Mock authentication enabled - skipping Amplify configuration');
    return;
  }

  const config: AmplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: cognitoConfig.userPoolId,
        userPoolClientId: cognitoConfig.userPoolClientId,
        region: cognitoConfig.region,
      },
    },
  };

  Amplify.configure(config);
  console.log('✅ Amplify configured for real Cognito authentication');
}
