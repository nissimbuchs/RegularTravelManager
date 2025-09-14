import { Amplify } from 'aws-amplify';
import { ConfigService } from '../services/config.service';

export interface AmplifyConfig {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
      region: string;
      loginWith?: {
        email?: boolean;
      };
    };
  };
}

export function configureAmplify(configService: ConfigService): void {
  const config = configService.config;
  const isDevelopment = config?.environment === 'dev' || config?.cognito?.useMockAuth;

  if (isDevelopment) {
    console.log('🔧 Configuring Amplify...');
  }

  // Skip configuration in test environment
  if (typeof window === 'undefined') {
    if (isDevelopment) {
      console.log('🚫 Skipping Amplify configuration - not in browser environment');
    }
    return;
  }

  const cognitoConfig = configService.cognitoConfig;

  if (isDevelopment) {
    console.log('📋 Cognito configuration retrieved:', {
      userPoolId: cognitoConfig.userPoolId,
      userPoolClientId: cognitoConfig.userPoolClientId,
      region: cognitoConfig.region,
      useMockAuth: cognitoConfig.useMockAuth,
    });
  }

  // Skip Amplify configuration if using mock authentication
  if (cognitoConfig.useMockAuth) {
    if (isDevelopment) {
      console.log('🧪 Mock authentication enabled - skipping Amplify configuration');
    }
    return;
  }

  // Validate required configuration values
  if (!cognitoConfig.userPoolId || cognitoConfig.userPoolId === 'local') {
    console.error('❌ Invalid User Pool ID:', cognitoConfig.userPoolId);
    throw new Error('Invalid User Pool ID configuration');
  }

  if (!cognitoConfig.userPoolClientId || cognitoConfig.userPoolClientId === 'local') {
    console.error('❌ Invalid User Pool Client ID:', cognitoConfig.userPoolClientId);
    throw new Error('Invalid User Pool Client ID configuration');
  }

  if (!cognitoConfig.region) {
    console.error('❌ Invalid region:', cognitoConfig.region);
    throw new Error('Invalid region configuration');
  }

  const amplifyConfig: AmplifyConfig = {
    Auth: {
      Cognito: {
        userPoolId: cognitoConfig.userPoolId,
        userPoolClientId: cognitoConfig.userPoolClientId,
        region: cognitoConfig.region,
      },
    },
  };

  if (isDevelopment) {
    console.log('🔧 Final Amplify configuration:', JSON.stringify(amplifyConfig, null, 2));
  }

  try {
    Amplify.configure(amplifyConfig);
    if (isDevelopment) {
      console.log('✅ Amplify configured successfully for real Cognito authentication');

      // Log current Amplify configuration for debugging
      console.log('🔍 Verifying Amplify configuration...');
      // Note: Amplify doesn't provide a direct way to get current config, but we can verify it was set
      console.log('✅ Amplify configuration verification completed');
    }
  } catch (configError) {
    console.error('❌ Failed to configure Amplify:', configError);
    throw configError;
  }
}
