import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as location from 'aws-cdk-lib/aws-location';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as customResources from 'aws-cdk-lib/custom-resources';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as path from 'path';
import { getTestUsersForEnvironment } from './config/test-users';
import { getEnvironmentConfig, EnvironmentConfig } from './config/environment-config';

export interface InfrastructureStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  domainName?: string;
}

export class InfrastructureStack extends cdk.Stack {
  public vpc!: ec2.Vpc;
  public database!: rds.DatabaseInstance;
  public userPool!: cognito.UserPool;
  public userPoolClient!: cognito.UserPoolClient;
  public placeIndex!: location.CfnPlaceIndex;
  public lambdaRole!: iam.Role;
  public lambdaSecurityGroup!: ec2.SecurityGroup;
  public alertsTopic!: sns.Topic;
  public hostedZone?: route53.HostedZone;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const config = getEnvironmentConfig(environment);

    // VPC for RDS and Lambda
    this.vpc = new ec2.Vpc(this, 'RTM-VPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // RDS PostgreSQL with PostGIS
    this.setupDatabase(environment);

    // Amazon Cognito User Pool
    this.setupCognito(environment);

    // AWS Location Service
    this.setupLocationService(environment);

    // IAM Roles and Policies
    this.setupIAMRoles(environment);

    // AWS SES
    this.setupSES(environment, props.domainName);

    // CloudWatch monitoring and alerting
    this.setupMonitoring(environment);

    // Route 53 hosted zone for custom domains
    this.setupHostedZone(environment, config);

    // Environment-specific parameters
    this.setupEnvironmentParameters(environment);

    // Resource tagging
    this.setupResourceTags(environment);
  }

  private setupDatabase(environment: string) {
    // Database credentials
    const dbCredentials = new secretsmanager.Secret(this, 'DBCredentials', {
      secretName: `rtm-${environment}-db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'rtm_admin' }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\',
        passwordLength: 32,
      },
    });

    // Database parameter group - PostGIS extension will be installed after deployment
    const parameterGroup = new rds.ParameterGroup(this, 'DBParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
    });

    // Database security group
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for RDS PostgreSQL instance',
      allowAllOutbound: false,
    });

    this.database = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType:
        environment === 'production'
          ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
          : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(dbCredentials),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [dbSecurityGroup],
      parameterGroup,
      databaseName: 'rtm_database',
      backupRetention: environment === 'production' ? cdk.Duration.days(7) : cdk.Duration.days(1),
      deleteAutomatedBackups: environment !== 'production',
      deletionProtection: environment === 'production',
      enablePerformanceInsights: environment === 'production',
    });

    // Lambda security group
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda functions to connect to database
    dbSecurityGroup.addIngressRule(
      this.lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda functions to connect to PostgreSQL'
    );

    // Store database connection details
    new ssm.StringParameter(this, 'DatabaseEndpoint', {
      parameterName: `/rtm/${environment}/database/endpoint`,
      stringValue: this.database.instanceEndpoint.hostname,
    });

    new ssm.StringParameter(this, 'DatabasePort', {
      parameterName: `/rtm/${environment}/database/port`,
      stringValue: this.database.instanceEndpoint.port.toString(),
    });

    // PostGIS Extension Installation
    this.setupPostGISExtension(environment);
  }

  private setupCognito(environment: string) {
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `rtm-${environment}-users`,
      signInAliases: {
        email: true,
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // User groups
    new cognito.CfnUserPoolGroup(this, 'EmployeesGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'employees',
      description: 'Regular employees who can submit travel requests',
    });

    new cognito.CfnUserPoolGroup(this, 'ManagersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'managers',
      description: 'Managers who can approve travel requests',
    });

    new cognito.CfnUserPoolGroup(this, 'AdministratorsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'administrators',
      description: 'Administrators with full system access including project and user management',
    });

    // User pool client
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `rtm-${environment}-web-client`,
      authFlows: {
        userPassword: true, // ALLOW_USER_PASSWORD_AUTH
        userSrp: true, // ALLOW_USER_SRP_AUTH
        // Refresh tokens are enabled by default when other auth flows are enabled
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      // No OAuth configuration needed for direct authentication
    });

    // Store Cognito configuration
    new ssm.StringParameter(this, 'UserPoolId', {
      parameterName: `/rtm/${environment}/cognito/user-pool-id`,
      stringValue: this.userPool.userPoolId,
    });

    new ssm.StringParameter(this, 'UserPoolClientId', {
      parameterName: `/rtm/${environment}/cognito/client-id`,
      stringValue: this.userPoolClient.userPoolClientId,
    });

    // Export for cross-stack references
    new cdk.CfnOutput(this, 'UserPoolIdOutput', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `rtm-${environment}-user-pool-id`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientIdOutput', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `rtm-${environment}-user-pool-client-id`,
    });

    // Create test users for non-production environments
    this.setupTestUsers(environment);
  }

  private setupTestUsers(environment: string) {
    const testUsers = getTestUsersForEnvironment(environment);

    if (testUsers.length === 0) {
      console.log(`No test users configured for environment: ${environment}`);
      return;
    }

    // Create Lambda function for user creation
    const userCreatorFunction = new lambdaNodejs.NodejsFunction(this, 'UserCreatorFunction', {
      functionName: `rtm-${environment}-user-creator`,
      entry: path.join(__dirname, 'lambda/create-cognito-users.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_18_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 256,
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.lambdaSecurityGroup],
      environment: {
        // AWS_REGION is automatically set by Lambda runtime
      },
      bundling: {
        externalModules: ['@aws-sdk/*'],
        nodeModules: ['node-fetch', 'pg'],
      },
    });

    // Grant permissions to manage Cognito users
    userCreatorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:AdminGetUser',
          'cognito-idp:ListUsers',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // Grant permissions to access database secrets
    userCreatorFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:rtm-${environment}-db-credentials*`,
        ],
      })
    );

    // VPC permissions are automatically added when Lambda is configured with VPC

    // Create log group for user creator provider
    const userCreatorLogGroup = new logs.LogGroup(this, 'UserCreatorProviderLogs', {
      logGroupName: `/aws/lambda/rtm-${environment}-user-creator-provider`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Custom Resource to trigger user creation
    const userCreatorProvider = new customResources.Provider(this, 'UserCreatorProvider', {
      onEventHandler: userCreatorFunction,
      logGroup: userCreatorLogGroup,
    });

    const userCreatorResource = new cdk.CustomResource(this, 'UserCreatorResource', {
      serviceToken: userCreatorProvider.serviceToken,
      properties: {
        UserPoolId: this.userPool.userPoolId,
        Users: testUsers,
        DatabaseUrl: this.database.instanceEndpoint.hostname 
          ? `postgresql://rtm_admin:[SECRET]@${this.database.instanceEndpoint.hostname}:5432/rtm_database`
          : '',
        DatabaseSecretArn: this.database.secret?.secretArn || '',
        Environment: environment,
        // Add a timestamp to force updates when needed
        Timestamp: Date.now().toString(),
      },
    });

    // Ensure Custom Resource runs after all dependencies are ready
    userCreatorResource.node.addDependency(this.userPool);
    userCreatorResource.node.addDependency(this.database);

    console.log(
      `Configured to create ${testUsers.length} test users for ${environment} environment`
    );
  }

  private setupPostGISExtension(environment: string) {
    // Create Lambda function to install PostGIS extension
    const postgisInstallerFunction = new lambdaNodejs.NodejsFunction(this, 'PostGISInstallerFunction', {
      functionName: `rtm-${environment}-postgis-installer`,
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'postgisInstaller',
      entry: path.join(__dirname, 'lambda/postgis-installer.ts'),
      timeout: cdk.Duration.minutes(5),
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [this.lambdaSecurityGroup],
      environment: {
        RTM_ENVIRONMENT: environment,
        DB_HOST: this.database.instanceEndpoint.hostname,
        DB_PORT: this.database.instanceEndpoint.port.toString(),
        DB_NAME: 'rtm_database',
      },
      bundling: {
        externalModules: ['pg-native'],
      },
    });

    // Grant access to database credentials
    postgisInstallerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:rtm-${environment}-db-credentials*`,
        ],
      })
    );

    // Create log group for PostGIS installer
    const postgisInstallerLogGroup = new logs.LogGroup(this, 'PostGISInstallerProviderLogs', {
      logGroupName: `/aws/lambda/rtm-${environment}-postgis-installer-provider`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create Custom Resource Provider
    const postgisProvider = new customResources.Provider(this, 'PostGISInstallerProvider', {
      onEventHandler: postgisInstallerFunction,
      logGroup: postgisInstallerLogGroup,
    });

    // Create Custom Resource to install PostGIS
    const postgisResource = new cdk.CustomResource(this, 'PostGISInstallerResource', {
      serviceToken: postgisProvider.serviceToken,
      properties: {
        Environment: environment,
        DatabaseEndpoint: this.database.instanceEndpoint.hostname,
        // Change this value to force re-installation if needed
        Version: '1.0.0',
      },
    });

    // Ensure PostGIS installation happens after database is ready
    postgisResource.node.addDependency(this.database);
  }

  private setupLocationService(environment: string) {
    this.placeIndex = new location.CfnPlaceIndex(this, 'PlaceIndex', {
      indexName: `rtm-${environment}-places`,
      dataSource: 'Here',
      dataSourceConfiguration: {
        intendedUse: 'Storage',
      },
      description: 'Place index for geocoding Swiss and European addresses',
    });

    new ssm.StringParameter(this, 'PlaceIndexName', {
      parameterName: `/rtm/${environment}/location/place-index-name`,
      stringValue: this.placeIndex.indexName,
    });
  }

  private setupIAMRoles(environment: string) {
    this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `rtm-${environment}-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // RDS access policy
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rds-db:connect'],
        resources: [
          `arn:aws:rds-db:${this.region}:${this.account}:dbuser:${this.database.instanceResourceId}/rtm_admin`,
        ],
      })
    );

    // Secrets Manager access
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:rtm-${environment}-db-credentials*`,
        ],
      })
    );

    // Cognito access policy
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminListGroupsForUser',
          'cognito-idp:AdminUpdateUserAttributes',
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminAddUserToGroup',
          'cognito-idp:ListUsers',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );

    // Location Service access policy
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['geo:SearchPlaceIndexForText', 'geo:SearchPlaceIndexForPosition'],
        resources: [this.placeIndex.attrArn],
      })
    );

    // SES access policy
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: [`arn:aws:ses:${this.region}:${this.account}:identity/*`],
      })
    );

    // Parameter Store access
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ssm:GetParameter', 'ssm:GetParameters'],
        resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/rtm/${environment}/*`],
      })
    );
  }

  private setupSES(environment: string, domainName?: string) {
    if (domainName) {
      // Domain identity
      new ses.EmailIdentity(this, 'DomainIdentity', {
        identity: ses.Identity.domain(domainName),
      });

      new ssm.StringParameter(this, 'SESDomain', {
        parameterName: `/rtm/${environment}/ses/domain`,
        stringValue: domainName,
      });

      // Output DNS records for manual setup
      new cdk.CfnOutput(this, 'SESDomainDKIMRecords', {
        description: 'DKIM records to add to DNS',
        value: 'Check AWS Console for DKIM records',
      });
    }

    // Email templates can be created here or via Lambda
    new ssm.StringParameter(this, 'SESFromEmail', {
      parameterName: `/rtm/${environment}/ses/from-email`,
      stringValue: domainName ? `noreply@${domainName}` : 'test@example.com',
    });
  }

  private setupEnvironmentParameters(environment: string) {
    // Application configuration
    new ssm.StringParameter(this, 'Environment', {
      parameterName: `/rtm/${environment}/config/environment`,
      stringValue: environment,
    });

    new ssm.StringParameter(this, 'Region', {
      parameterName: `/rtm/${environment}/config/region`,
      stringValue: this.region,
    });

    // Performance and scaling settings
    const performanceConfig: Record<string, Record<string, number>> = {
      dev: {
        lambdaTimeout: 30,
        lambdaMemory: 512,
        lambdaReservedConcurrency: 10,
        dbConnections: 5,
      },
      staging: {
        lambdaTimeout: 30,
        lambdaMemory: 1024,
        lambdaReservedConcurrency: 50,
        dbConnections: 10,
      },
      production: {
        lambdaTimeout: 30,
        lambdaMemory: 1024,
        lambdaReservedConcurrency: 200,
        dbConnections: 20,
      },
    };

    const config = performanceConfig[environment];
    if (config) {
      Object.entries(config).forEach(([key, value]: [string, number]) => {
        new ssm.StringParameter(this, `Config${key.charAt(0).toUpperCase() + key.slice(1)}`, {
          parameterName: `/rtm/${environment}/config/${key}`,
          stringValue: value.toString(),
        });
      });
    }

    // Auto-scaling configuration for production
    if (environment === 'production') {
      // Add read replica for RDS in production for better read performance
      const readReplica = new rds.DatabaseInstanceReadReplica(this, 'DatabaseReadReplica', {
        sourceDatabaseInstance: this.database,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
        vpc: this.vpc,
        autoMinorVersionUpgrade: true,
        deletionProtection: true,
        enablePerformanceInsights: true,
      });

      // Store read replica endpoint
      new ssm.StringParameter(this, 'DatabaseReadReplicaEndpoint', {
        parameterName: `/rtm/${environment}/database/read-replica-endpoint`,
        stringValue: readReplica.instanceEndpoint.hostname,
      });

      // Add CloudWatch alarms for read replica
      const readReplicaCpuAlarm = new cloudwatch.Alarm(this, 'DBReadReplicaCpuAlarm', {
        alarmName: `rtm-${environment}-db-read-replica-high-cpu`,
        alarmDescription: 'RDS read replica high CPU utilization',
        metric: readReplica.metricCPUUtilization({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 3,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      readReplicaCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

      const replicationLagAlarm = new cloudwatch.Alarm(this, 'DBReplicationLagAlarm', {
        alarmName: `rtm-${environment}-db-replication-lag`,
        alarmDescription: 'RDS read replica replication lag',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/RDS',
          metricName: 'ReadReplicaLag',
          dimensionsMap: {
            DBInstanceIdentifier: readReplica.instanceIdentifier,
          },
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 300, // 5 minutes in seconds
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      replicationLagAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));
    }
  }

  private setupMonitoring(environment: string) {
    // SNS Topic for alerts
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `rtm-${environment}-alerts`,
      displayName: `RTM ${environment} Alerts`,
    });

    // Store alerts topic ARN
    new ssm.StringParameter(this, 'AlertsTopicArn', {
      parameterName: `/rtm/${environment}/monitoring/alerts-topic-arn`,
      stringValue: this.alertsTopic.topicArn,
    });

    // Export for cross-stack references
    new cdk.CfnOutput(this, 'AlertsTopicArnOutput', {
      value: this.alertsTopic.topicArn,
      description: 'SNS Topic ARN for alerts',
      exportName: `rtm-${environment}-alerts-topic-arn`,
    });

    // CloudWatch Log Groups
    new logs.LogGroup(this, 'APIGatewayLogGroup', {
      logGroupName: `/aws/apigateway/rtm-${environment}-api`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // RDS Alarms
    const dbCpuAlarm = new cloudwatch.Alarm(this, 'DBCpuAlarm', {
      alarmName: `rtm-${environment}-db-high-cpu`,
      alarmDescription: 'RDS high CPU utilization',
      metric: this.database.metricCPUUtilization({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 80 : 90,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    const dbConnectionsAlarm = new cloudwatch.Alarm(this, 'DBConnectionsAlarm', {
      alarmName: `rtm-${environment}-db-high-connections`,
      alarmDescription: 'RDS high connection count',
      metric: this.database.metricDatabaseConnections({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 15 : 8, // Based on our configuration
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbConnectionsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    const dbFreeSpaceAlarm = new cloudwatch.Alarm(this, 'DBFreeSpaceAlarm', {
      alarmName: `rtm-${environment}-db-low-free-space`,
      alarmDescription: 'RDS low free storage space',
      metric: this.database.metricFreeStorageSpace({
        statistic: 'Average',
        period: cdk.Duration.minutes(15),
      }),
      threshold: 2 * 1024 * 1024 * 1024, // 2GB in bytes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dbFreeSpaceAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    // Cognito Alarms
    const cognitoThrottleAlarm = new cloudwatch.Alarm(this, 'CognitoThrottleAlarm', {
      alarmName: `rtm-${environment}-cognito-throttling`,
      alarmDescription: 'Cognito API throttling',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Cognito',
        metricName: 'UserPoolRequestThrottled',
        dimensionsMap: {
          UserPool: this.userPool.userPoolId,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 5 : 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cognitoThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    // Lambda concurrency monitoring (will be configured when Lambda functions are added)
    const lambdaConcurrencyMetric = new cloudwatch.Metric({
      namespace: 'AWS/Lambda',
      metricName: 'ConcurrentExecutions',
      statistic: 'Maximum',
      period: cdk.Duration.minutes(1),
    });

    const lambdaConcurrencyAlarm = new cloudwatch.Alarm(this, 'LambdaConcurrencyAlarm', {
      alarmName: `rtm-${environment}-lambda-high-concurrency`,
      alarmDescription: 'Lambda high concurrency usage',
      metric: lambdaConcurrencyMetric,
      threshold: environment === 'production' ? 800 : 100,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaConcurrencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    // CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'MonitoringDashboard', {
      dashboardName: `rtm-${environment}-monitoring`,
    });

    // RDS metrics widget
    const rdsWidgets = [
      new cloudwatch.GraphWidget({
        title: 'RDS CPU & Connections',
        left: [this.database.metricCPUUtilization()],
        right: [this.database.metricDatabaseConnections()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'RDS Storage',
        left: [this.database.metricFreeStorageSpace()],
        width: 12,
      }),
    ];

    dashboard.addWidgets(...rdsWidgets);
  }

  private setupHostedZone(environment: string, config: EnvironmentConfig) {
    // Only create hosted zone if custom domains are enabled for staging/production
    const shouldCreateHostedZone = (config.api.customDomainEnabled || config.web.customDomainEnabled) && 
                                   (config.api.domainName || config.web.domainName);

    if (shouldCreateHostedZone) {
      // Extract root domain from either API or web domain
      const domainName = config.api.domainName || config.web.domainName;
      if (!domainName) {
        throw new Error('Domain name is required when custom domain is enabled');
      }
      
      const domainParts = domainName.split('.');
      const rootDomain = domainParts.slice(-2).join('.'); // Get the last two parts (domain.tld)

      console.log(`Creating hosted zone for root domain: ${rootDomain}`);

      // Create hosted zone for the root domain
      this.hostedZone = new route53.HostedZone(this, 'RootDomainHostedZone', {
        zoneName: rootDomain,
        comment: `Hosted zone for ${rootDomain} - managed by RTM ${environment} infrastructure`,
      });

      // Export hosted zone ID and domain name for cross-stack access
      new cdk.CfnOutput(this, 'HostedZoneId', {
        value: this.hostedZone.hostedZoneId,
        description: 'Route 53 Hosted Zone ID',
        exportName: `rtm-${environment}-hosted-zone-id`,
      });

      new cdk.CfnOutput(this, 'HostedZoneName', {
        value: rootDomain,
        description: 'Route 53 Hosted Zone Domain Name',
        exportName: `rtm-${environment}-hosted-zone-name`,
      });

      new cdk.CfnOutput(this, 'HostedZoneNameServers', {
        value: cdk.Fn.join(',', this.hostedZone.hostedZoneNameServers || []),
        description: 'Route 53 Name Servers (configure these at your domain registrar)',
        exportName: `rtm-${environment}-name-servers`,
      });

      // Store hosted zone configuration in SSM
      new ssm.StringParameter(this, 'HostedZoneDomain', {
        parameterName: `/rtm/${environment}/dns/root-domain`,
        stringValue: rootDomain,
      });

      new ssm.StringParameter(this, 'HostedZoneIdParam', {
        parameterName: `/rtm/${environment}/dns/hosted-zone-id`,
        stringValue: this.hostedZone.hostedZoneId,
      });

      console.log(`✅ Hosted zone created for ${rootDomain} - configure name servers at domain registrar`);
    } else {
      console.log('ℹ️ Custom domains not enabled, skipping hosted zone creation');
    }
  }

  private setupResourceTags(environment: string) {
    const tags = {
      Project: 'RegularTravelManager',
      Environment: environment,
      ManagedBy: 'CDK',
      CostCenter: 'IT-Operations',
    };

    Object.entries(tags).forEach(([key, value]) => {
      cdk.Tags.of(this).add(key, value);
    });
  }
}
