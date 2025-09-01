import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { LocationClient } from '@aws-sdk/client-location';
import { S3Client } from '@aws-sdk/client-s3';
import { getEnvironmentConfig, isLocalDevelopment } from '../config/environment.js';
import { MockLocationClient } from './mock-location-client.js';

export class AWSServiceFactory {
  private static config = getEnvironmentConfig();

  static createCognitoClient(): CognitoIdentityProviderClient {
    const clientConfig: any = {
      region: this.config.AWS_REGION,
    };

    if (this.config.AWS_ENDPOINT_URL) {
      clientConfig.endpoint = this.config.AWS_ENDPOINT_URL;
      clientConfig.credentials = {
        accessKeyId: this.config.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY || 'test'
      };
      // Disable SSL verification for LocalStack
      clientConfig.forcePathStyle = true;
    }

    return new CognitoIdentityProviderClient(clientConfig);
  }


  static createS3Client(): S3Client {
    const clientConfig: any = {
      region: this.config.AWS_REGION,
    };

    if (this.config.AWS_ENDPOINT_URL) {
      clientConfig.endpoint = this.config.AWS_ENDPOINT_URL;
      clientConfig.credentials = {
        accessKeyId: this.config.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: this.config.AWS_SECRET_ACCESS_KEY || 'test'
      };
      clientConfig.forcePathStyle = true; // Required for LocalStack S3
    }

    return new S3Client(clientConfig);
  }

  static createLocationClient(): LocationClient | MockLocationClient {
    // For local development with community edition, use mock implementation
    if (isLocalDevelopment()) {
      return new MockLocationClient();
    }
    
    return new LocationClient({
      region: this.config.AWS_REGION,
    });
  }

}

// Singleton instances for better performance
let cognitoClientInstance: CognitoIdentityProviderClient;
let s3ClientInstance: S3Client;
let locationClientInstance: LocationClient | MockLocationClient;

export function getCognitoClient(): CognitoIdentityProviderClient {
  if (!cognitoClientInstance) {
    cognitoClientInstance = AWSServiceFactory.createCognitoClient();
  }
  return cognitoClientInstance;
}


export function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = AWSServiceFactory.createS3Client();
  }
  return s3ClientInstance;
}

export function getLocationClient(): LocationClient | MockLocationClient {
  if (!locationClientInstance) {
    locationClientInstance = AWSServiceFactory.createLocationClient();
  }
  return locationClientInstance;
}

