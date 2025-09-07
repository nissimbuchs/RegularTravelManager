import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// CloudFormation Custom Resource event types
interface CustomResourceEvent {
  RequestType: 'Create' | 'Update' | 'Delete';
  ResponseURL: string;
  StackId: string;
  RequestId: string;
  ResourceType: string;
  LogicalResourceId: string;
  ResourceProperties: {
    Environment: string;
    WebBucketName: string;
    Region: string;
  };
}

interface CustomResourceResponse {
  Status: 'SUCCESS' | 'FAILED';
  Reason?: string;
  PhysicalResourceId: string;
  StackId: string;
  RequestId: string;
  LogicalResourceId: string;
  Data?: Record<string, any>;
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'eu-central-1',
});

const ssmClient = new SSMClient({
  region: process.env.AWS_REGION || 'eu-central-1',
});

export const handler = async (event: CustomResourceEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  const response: CustomResourceResponse = {
    Status: 'SUCCESS',
    PhysicalResourceId: `web-config-${event.RequestId}`,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
  };

  try {
    const { RequestType, ResourceProperties } = event;
    const { Environment, WebBucketName, Region } = ResourceProperties;

    if (RequestType === 'Create' || RequestType === 'Update') {
      await generateAndUploadConfig(Environment, WebBucketName, Region);
      response.Data = {
        Message: `Successfully generated web config for ${Environment}`,
        ConfigPath: `/assets/config/config.json`,
      };
    } else if (RequestType === 'Delete') {
      // For delete, we typically don't remove config as it may break the app
      console.log('Delete request received - keeping config file intact');
      response.Data = {
        Message: 'Delete request processed - config file preserved',
      };
    }
  } catch (error) {
    console.error('Error processing request:', error);
    response.Status = 'FAILED';
    response.Reason = error instanceof Error ? error.message : String(error);
  }

  // Send response to CloudFormation
  await sendResponse(event.ResponseURL, response);
};

async function generateAndUploadConfig(
  environment: string,
  bucketName: string,
  region: string
): Promise<void> {
  console.log(`Generating web config for environment: ${environment}`);

  try {
    // Fetch configuration values from SSM
    const apiUrl = await getSSMParameter(`/rtm/${environment}/api/base-url`);
    const userPoolId = await getSSMParameter(`/rtm/${environment}/cognito/user-pool-id`);
    const clientId = await getSSMParameter(`/rtm/${environment}/cognito/client-id`);

    // Generate configuration object
    const config = {
      apiUrl: apiUrl,
      cognito: {
        userPoolId: userPoolId,
        userPoolClientId: clientId,
        region: region,
        useMockAuth: false,
      },
      environment: environment,
    };

    console.log('Generated config:', {
      apiUrl: config.apiUrl,
      userPoolId: config.cognito.userPoolId,
      environment: config.environment,
    });

    // Upload to S3
    const configJson = JSON.stringify(config, null, 2);

    const uploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: 'assets/config/config.json',
      Body: configJson,
      ContentType: 'application/json',
      CacheControl: 'no-cache', // Ensure config is always fresh
    });

    await s3Client.send(uploadCommand);
    console.log(`Successfully uploaded config.json to S3 bucket: ${bucketName}`);

    // Also upload environment-specific config file
    const envUploadCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: `assets/config/config.${environment}.json`,
      Body: configJson,
      ContentType: 'application/json',
      CacheControl: 'no-cache',
    });

    await s3Client.send(envUploadCommand);
    console.log(`Successfully uploaded config.${environment}.json to S3 bucket: ${bucketName}`);
  } catch (error) {
    console.error('Failed to generate/upload config:', error);
    throw error;
  }
}

async function getSSMParameter(parameterName: string): Promise<string> {
  try {
    const command = new GetParameterCommand({
      Name: parameterName,
    });

    const response = await ssmClient.send(command);
    const value = response.Parameter?.Value;

    if (!value) {
      throw new Error(`Parameter ${parameterName} has no value`);
    }

    console.log(`Retrieved parameter ${parameterName}: ${value}`);
    return value;
  } catch (error) {
    console.error(`Failed to get SSM parameter ${parameterName}:`, error);
    throw error;
  }
}

async function sendResponse(responseUrl: string, response: CustomResourceResponse): Promise<void> {
  const responseBody = JSON.stringify(response);
  console.log('Sending response:', responseBody);

  try {
    const fetch = (await import('node-fetch')).default;
    const result = await fetch(responseUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': '',
        'Content-Length': responseBody.length.toString(),
      },
      body: responseBody,
    });

    console.log('Response sent successfully:', result.status);
  } catch (error) {
    console.error('Failed to send response:', error);
    throw error;
  }
}
