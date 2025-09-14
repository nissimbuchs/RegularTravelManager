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
import { ParameterManager, ParameterSets } from './infrastructure/parameter-manager';
import { ExportManager, ExportSets } from './infrastructure/export-manager';
import { AlarmFactory, AlarmSets } from './infrastructure/alarm-factory';
import { PolicyBuilder, PolicySets } from './infrastructure/policy-builder';
import { LogGroupFactory, LogGroupSets } from './infrastructure/log-group-factory';
import {
  CustomResourceBuilder,
  CustomResourceSets,
} from './infrastructure/custom-resource-builder';

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

  // Helper utilities
  private parameterManager!: ParameterManager;
  private exportManager!: ExportManager;
  private alarmFactory!: AlarmFactory;
  private policyBuilder!: PolicyBuilder;
  private logGroupFactory!: LogGroupFactory;
  private customResourceBuilder!: CustomResourceBuilder;

  constructor(scope: Construct, id: string, props: InfrastructureStackProps) {
    super(scope, id, props);

    const { environment } = props;
    const config = getEnvironmentConfig(environment);

    // Initialize helper utilities
    this.initializeHelpers(environment);

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

    // Initialize alarm factory after alerts topic is created
    this.alarmFactory = new AlarmFactory(this, environment, this.alertsTopic);

    // Create CloudWatch alarms using factory
    this.setupCloudWatchAlarms(environment);

    // Route 53 hosted zone for custom domains
    this.setupHostedZone(environment, config);

    // Environment-specific parameters
    this.setupEnvironmentParameters(environment);

    // Resource tagging
    this.setupResourceTags(environment);
  }

  /**
   * Initialize helper utilities
   */
  private initializeHelpers(environment: string) {
    this.parameterManager = new ParameterManager(this, environment);
    this.exportManager = new ExportManager(this, environment);
    this.policyBuilder = new PolicyBuilder(this.region, this.account, environment);
    this.logGroupFactory = new LogGroupFactory(this, environment);
    // CustomResourceBuilder and AlarmFactory will be initialized later when dependencies are ready
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

    // Initialize CustomResourceBuilder now that VPC and security groups are ready
    this.customResourceBuilder = new CustomResourceBuilder(
      this,
      environment,
      this.region,
      this.account,
      this.vpc,
      this.lambdaSecurityGroup
    );

    // Store database connection details using parameter manager
    this.parameterManager.createParameters(ParameterSets.database(this.database));

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

    // Store Cognito configuration using helpers
    this.parameterManager.createParameters(
      ParameterSets.cognito(this.userPool, this.userPoolClient)
    );
    this.exportManager.createExports(ExportSets.cognito(this.userPool, this.userPoolClient));

    // Create test users for non-production environments
    this.setupTestUsers(environment);
  }

  private setupTestUsers(environment: string) {
    const testUsers = getTestUsersForEnvironment(environment);

    if (testUsers.length === 0) {
      console.log(`No test users configured for environment: ${environment}`);
      return;
    }

    // Create user creator custom resource using builder
    const userCreatorConfig = CustomResourceSets.userCreator(
      path.join(__dirname, 'lambda/create-cognito-users.ts'),
      this.userPool,
      this.database,
      this.userPool.userPoolArn
    );

    // Add custom properties
    userCreatorConfig.properties = {
      UserPoolId: this.userPool.userPoolId,
      Users: testUsers,
      DatabaseUrl: this.database.instanceEndpoint.hostname
        ? `postgresql://rtm_admin:[SECRET]@${this.database.instanceEndpoint.hostname}:5432/rtm_database`
        : '',
      DatabaseSecretArn: this.database.secret?.secretArn || '',
      Environment: environment,
      Timestamp: Date.now().toString(),
    };

    this.customResourceBuilder.createCustomResource('userCreator', userCreatorConfig);

    console.log(
      `Configured to create ${testUsers.length} test users for ${environment} environment`
    );
  }

  private setupPostGISExtension(environment: string) {
    // Create PostGIS installer custom resource using builder
    const postgisConfig = CustomResourceSets.postgisInstaller(
      path.join(__dirname, 'lambda/postgis-installer.ts'),
      this.database
    );

    // Add custom properties for PostGIS installation
    postgisConfig.properties = {
      Environment: environment,
      DatabaseEndpoint: this.database.instanceEndpoint.hostname,
      Version: '1.0.0', // Change to force re-installation
    };

    this.customResourceBuilder.createCustomResource('postgisInstaller', postgisConfig);
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

    // Store location service configuration using parameter manager
    this.parameterManager.createParameters(ParameterSets.location(this.placeIndex));
  }

  private setupIAMRoles(environment: string) {
    this.lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      roleName: `rtm-${environment}-lambda-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Add policies using policy builder
    const policies = [
      PolicySets.rds(this.database.instanceResourceId || ''),
      PolicySets.secretsManager(),
      PolicySets.cognito(this.userPool.userPoolArn),
      PolicySets.location(this.placeIndex.attrArn),
      PolicySets.ses(),
      PolicySets.parameterStore(),
    ];

    this.policyBuilder.addPoliciesToRole(this.lambdaRole, policies);
  }

  private setupSES(environment: string, domainName?: string) {
    // Extract domain from environment config if not provided as prop
    const config = getEnvironmentConfig(environment);
    const effectiveDomainName = domainName || config.web.domainName;

    if (effectiveDomainName) {
      // Extract root domain for SES (e.g., 'buchs.be' from 'rtm-staging.buchs.be')
      const domainParts = effectiveDomainName.split('.');
      const rootDomain = domainParts.slice(-2).join('.');

      // Domain identity
      new ses.EmailIdentity(this, 'DomainIdentity', {
        identity: ses.Identity.domain(rootDomain),
      });

      // Create SES exports for DKIM records
      this.exportManager.createExports(ExportSets.ses(rootDomain));

      // Store SES configuration using parameter manager
      this.parameterManager.createParameters(ParameterSets.ses(rootDomain));
    } else {
      console.log('ℹ️ No domain configured for SES, using default configuration');
      // Store default SES configuration for development
      this.parameterManager.createParameters(ParameterSets.ses());
    }
  }

  private setupEnvironmentParameters(environment: string) {
    // Create configuration parameters using parameter manager
    this.parameterManager.createParameters(ParameterSets.config(environment, this.region));
    this.parameterManager.createParameters(ParameterSets.performance(environment));

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
      this.parameterManager.createParameter('databaseReadReplicaEndpoint', {
        section: 'database',
        key: 'read-replica-endpoint',
        value: readReplica.instanceEndpoint.hostname,
        description: 'RDS PostgreSQL read replica endpoint',
      });

      // Add CloudWatch alarms for read replica using alarm factory
      this.alarmFactory.createAlarms(AlarmSets.readReplica(readReplica));
    }
  }

  private setupMonitoring(environment: string) {
    // SNS Topic for alerts
    this.alertsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `rtm-${environment}-alerts`,
      displayName: `RTM ${environment} Alerts`,
    });

    // Store alerts topic ARN and create exports using helpers
    this.parameterManager.createParameters(ParameterSets.monitoring(this.alertsTopic));
    this.exportManager.createExports(ExportSets.monitoring(this.alertsTopic));

    // Create log groups using factory
    this.logGroupFactory.createLogGroups(LogGroupSets.apiGateway());

    // Create alarms using alarm factory (will be initialized after this method)
    // Alarms will be created in a separate method called after alarm factory initialization

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

  /**
   * Setup CloudWatch alarms using alarm factory
   */
  private setupCloudWatchAlarms(environment: string) {
    // Create database alarms
    this.alarmFactory.createAlarms(AlarmSets.database(this.database));

    // Create Cognito alarms
    this.alarmFactory.createAlarms(AlarmSets.cognito(this.userPool));

    // Create Lambda concurrency alarms
    this.alarmFactory.createAlarms(AlarmSets.lambda());
  }

  private setupHostedZone(environment: string, config: EnvironmentConfig) {
    // Skip Route53 hosted zone creation - using external DNS provider with CNAME records
    const hasCustomDomains =
      (config.api.customDomainEnabled || config.web.customDomainEnabled) &&
      (config.api.domainName || config.web.domainName);

    if (hasCustomDomains) {
      const domainName = config.api.domainName || config.web.domainName;
      if (!domainName) {
        console.log('ℹ️ No domain name configured, skipping DNS setup');
        return;
      }
      const domainParts = domainName.split('.');
      const rootDomain = domainParts.slice(-2).join('.'); // Get the last two parts (domain.tld)

      console.log(
        `ℹ️ Custom domains configured for ${rootDomain} - using external DNS with CNAME records`
      );
      console.log(
        `ℹ️ Route53 hosted zone creation skipped - external DNS provider will handle subdomains`
      );

      // Store domain information for reference without creating hosted zone
      this.parameterManager.createParameter('rootDomain', {
        section: 'dns',
        key: 'root-domain',
        value: rootDomain,
        description: 'Root domain name for custom domains (external DNS)',
      });

      this.parameterManager.createParameter('dnsMode', {
        section: 'dns',
        key: 'dns-mode',
        value: 'external',
        description: 'DNS mode: external (CNAME records) vs route53 (hosted zone)',
      });
    } else {
      console.log('ℹ️ Custom domains not enabled, skipping DNS configuration');
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
