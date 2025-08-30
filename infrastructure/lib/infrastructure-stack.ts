import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as location from 'aws-cdk-lib/aws-location';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface InfrastructureStackProps extends cdk.StackProps {
  environment: 'dev' | 'staging' | 'production';
  domainName?: string;
}

export class InfrastructureStack extends cdk.Stack {
  public vpc!: ec2.Vpc;
  public database!: rds.DatabaseInstance;
  public userPool!: cognito.UserPool;
  public userPoolClient!: cognito.UserPoolClient;
  public api!: apigateway.RestApi;
  public placeIndex!: location.CfnPlaceIndex;
  public lambdaRole!: iam.Role;
  public alertsTopic!: sns.Topic;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { environment } = props;

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

    // API Gateway
    this.setupAPIGateway(environment);

    // AWS SES
    this.setupSES(environment, props.domainName);

    // CloudWatch monitoring and alerting
    this.setupMonitoring(environment);

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

    // Store database connection details
    new ssm.StringParameter(this, 'DatabaseEndpoint', {
      parameterName: `/rtm/${environment}/database/endpoint`,
      stringValue: this.database.instanceEndpoint.hostname,
    });

    new ssm.StringParameter(this, 'DatabasePort', {
      parameterName: `/rtm/${environment}/database/port`,
      stringValue: this.database.instanceEndpoint.port.toString(),
    });
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

    // User pool client
    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: `rtm-${environment}-web-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
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

  private setupAPIGateway(environment: string) {
    this.api = new apigateway.RestApi(this, 'API', {
      restApiName: `rtm-${environment}-api`,
      description: `RegularTravelManager API - ${environment}`,
      defaultCorsPreflightOptions: {
        allowOrigins:
          environment === 'production'
            ? ['https://travel.company.com'] // Replace with actual domain
            : apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
      deployOptions: {
        stageName: environment,
        tracingEnabled: true,
        loggingLevel:
          environment === 'production'
            ? apigateway.MethodLoggingLevel.ERROR
            : apigateway.MethodLoggingLevel.OFF,
        dataTraceEnabled: false,
        metricsEnabled: true,
      },
    });

    // API resources will be added by Lambda functions
    const apiV1 = this.api.root.addResource('api').addResource('v1');

    // Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [this.userPool],
      authorizerName: `rtm-${environment}-authorizer`,
      identitySource: 'method.request.header.Authorization',
    });

    // Health check endpoint (no auth required)
    const healthResource = apiV1.addResource('health');
    healthResource.addMethod('GET');

    // Example protected endpoint that uses the authorizer
    const protectedResource = apiV1.addResource('protected');
    protectedResource.addMethod('GET', undefined, {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Store API configuration
    new ssm.StringParameter(this, 'APIGatewayId', {
      parameterName: `/rtm/${environment}/api/gateway-id`,
      stringValue: this.api.restApiId,
    });

    new ssm.StringParameter(this, 'APIGatewayURL', {
      parameterName: `/rtm/${environment}/api/base-url`,
      stringValue: this.api.url,
    });
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

    // CloudWatch Log Groups
    new logs.LogGroup(this, 'APIGatewayLogGroup', {
      logGroupName: `/aws/apigateway/rtm-${environment}-api`,
      retention:
        environment === 'production' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      removalPolicy:
        environment === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // API Gateway Alarms
    const apiGateway4xxAlarm = new cloudwatch.Alarm(this, 'APIGateway4xxAlarm', {
      alarmName: `rtm-${environment}-api-4xx-errors`,
      alarmDescription: 'API Gateway 4xx errors',
      metric: this.api.metricClientError({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 10 : 50,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiGateway4xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    const apiGateway5xxAlarm = new cloudwatch.Alarm(this, 'APIGateway5xxAlarm', {
      alarmName: `rtm-${environment}-api-5xx-errors`,
      alarmDescription: 'API Gateway 5xx errors',
      metric: this.api.metricServerError({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 5 : 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiGateway5xxAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

    const apiGatewayLatencyAlarm = new cloudwatch.Alarm(this, 'APIGatewayLatencyAlarm', {
      alarmName: `rtm-${environment}-api-high-latency`,
      alarmDescription: 'API Gateway high latency',
      metric: this.api.metricLatency({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: environment === 'production' ? 2000 : 5000, // milliseconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiGatewayLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(this.alertsTopic));

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

    // API Gateway metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [this.api.metricCount()],
        right: [this.api.metricLatency()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [this.api.metricClientError(), this.api.metricServerError()],
        width: 12,
      })
    );

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
