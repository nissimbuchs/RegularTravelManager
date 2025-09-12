/**
 * Enhanced Sample Data Loading Lambda Function
 *
 * This Lambda function loads sample data for the RegularTravelManager application
 * with dynamic Cognito user creation and management.
 *
 * Key features:
 * - Automatically creates/verifies Cognito users with proper group assignments
 * - Dynamically retrieves real Cognito user IDs instead of hardcoded values
 * - Idempotent operation - safe to run multiple times
 * - Supports all three user roles: administrators, managers, employees
 *
 * Environment Variables Required:
 * - USER_POOL_ID: Cognito User Pool ID for user creation
 *
 * IAM Permissions Required:
 * - cognito-idp:AdminGetUser
 * - cognito-idp:AdminCreateUser
 * - cognito-idp:AdminSetUserPassword
 * - cognito-idp:AdminAddUserToGroup
 * - secretsmanager:GetSecretValue (for database credentials)
 */

const { Client } = require('pg');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Sample users configuration with roles and mock UUIDs for dev environment
const sampleUsers = [
  {
    email: 'admin1@company.ch',
    firstName: 'Hans',
    lastName: 'Zimmermann',
    role: 'administrators',
    mockId: '11111111-1111-1111-1111-111111111111',
  },
  {
    email: 'admin2@company.ch',
    firstName: 'Maria',
    lastName: 'Weber',
    role: 'administrators',
    mockId: '22222222-2222-2222-2222-222222222222',
  },
  {
    email: 'manager1@company.ch',
    firstName: 'Thomas',
    lastName: 'Müller',
    role: 'managers',
    mockId: '33333333-3333-3333-3333-333333333333',
  },
  {
    email: 'manager2@company.ch',
    firstName: 'Sophie',
    lastName: 'Dubois',
    role: 'managers',
    mockId: '44444444-4444-4444-4444-444444444444',
  },
  {
    email: 'employee1@company.ch',
    firstName: 'Anna',
    lastName: 'Schneider',
    role: 'employees',
    mockId: '55555555-5555-5555-5555-555555555555',
  },
  {
    email: 'employee2@company.ch',
    firstName: 'Marco',
    lastName: 'Rossi',
    role: 'employees',
    mockId: '66666666-6666-6666-6666-666666666666',
  },
  {
    email: 'employee3@company.ch',
    firstName: 'Lisa',
    lastName: 'Meier',
    role: 'employees',
    mockId: '77777777-7777-7777-7777-777777777777',
  },
  {
    email: 'employee4@company.ch',
    firstName: 'Pierre',
    lastName: 'Martin',
    role: 'employees',
    mockId: '88888888-8888-8888-8888-888888888888',
  },
  {
    email: 'employee5@company.ch',
    firstName: 'Julia',
    lastName: 'Fischer',
    role: 'employees',
    mockId: '99999999-9999-9999-9999-999999999999',
  },
  {
    email: 'employee6@company.ch',
    firstName: 'Michael',
    lastName: 'Keller',
    role: 'employees',
    mockId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  },
];

async function ensureCognitoUser(cognitoClient, userPoolId, userInfo) {
  const { email, firstName, lastName, role } = userInfo;

  try {
    console.log(`Checking if user ${email} exists in Cognito...`);

    // Check if user exists
    const getUserParams = {
      UserPoolId: userPoolId,
      Username: email,
    };

    try {
      const existingUser = await cognitoClient.adminGetUser(getUserParams).promise();
      console.log(`User ${email} already exists in Cognito`);
      return existingUser.Username; // Return existing Cognito ID
    } catch (err) {
      if (err.code !== 'UserNotFoundException') {
        console.error(`Error checking user ${email}:`, err);
        throw err;
      }
    }

    console.log(`Creating user ${email} in Cognito...`);

    // Create user if doesn't exist
    const createParams = {
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'given_name', Value: firstName },
        { Name: 'family_name', Value: lastName },
        { Name: 'email_verified', Value: 'true' },
      ],
      TemporaryPassword: 'TempPass123!',
      MessageAction: 'SUPPRESS',
    };

    const result = await cognitoClient.adminCreateUser(createParams).promise();
    console.log(`User ${email} created successfully`);

    // Set permanent password
    await cognitoClient
      .adminSetUserPassword({
        UserPoolId: userPoolId,
        Username: result.User.Username,
        Password: 'DevPassword123!',
        Permanent: true,
      })
      .promise();

    // Add to appropriate group
    await cognitoClient
      .adminAddUserToGroup({
        UserPoolId: userPoolId,
        Username: result.User.Username,
        GroupName: role,
      })
      .promise();

    console.log(`User ${email} added to group ${role}`);
    return result.User.Username;
  } catch (error) {
    console.error(`Failed to ensure user ${email}:`, error);
    throw error;
  }
}

/**
 * Simple migration runner for Lambda
 * Runs SQL migration files in order
 */
async function runMigrations(client) {
  // Create migrations table if it doesn't exist
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(50) PRIMARY KEY,
      filename VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL
    );
  `);

  // List of migration files in order
  const migrationFiles = [
    '001_initial_schema.sql',
    '002_add_cognito_fields.sql',
    '003_distance_calculation_functions.sql',
  ];

  for (const filename of migrationFiles) {
    try {
      const version = filename.replace('.sql', '');

      // Check if migration already executed
      const existingResult = await client.query(
        'SELECT version FROM schema_migrations WHERE version = $1',
        [version]
      );

      if (existingResult.rows.length > 0) {
        console.log(`Migration ${version} already executed, skipping.`);
        continue;
      }

      // Read migration file
      const migrationPath = path.join(__dirname, 'migrations', filename);
      const migrationContent = fs.readFileSync(migrationPath, 'utf8');
      const checksum = Buffer.from(migrationContent).toString('base64').slice(0, 32);

      // Execute migration in transaction
      await client.query('BEGIN');
      try {
        console.log(`Executing migration: ${version} - ${filename}`);
        await client.query(migrationContent);

        // Record migration execution
        await client.query(
          'INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)',
          [version, filename, checksum]
        );

        await client.query('COMMIT');
        console.log(`Migration ${version} completed successfully.`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error(`Failed to execute migration ${filename}:`, error);
      throw error;
    }
  }
}

exports.handler = async event => {
  const secretsManager = new AWS.SecretsManager();
  const cognitoClient = new AWS.CognitoIdentityServiceProvider();

  try {
    console.log('Starting database schema creation and sample data loading process...');
    console.log('Event:', JSON.stringify(event, null, 2));

    // Detect environment - use mock IDs for dev/local environments
    const environment = process.env.RTM_ENVIRONMENT || process.env.ENVIRONMENT || 'dev';
    const useMockIds =
      environment === 'dev' || environment === 'development' || environment === 'local';
    console.log(`Environment: ${environment}, Using mock IDs: ${useMockIds}`);

    // Check if we should clear existing data
    const clearData = event.clearData || event.force || false;

    // Get database credentials based on environment
    const secretId = `rtm-${environment}-db-credentials`;
    console.log(`Loading database credentials from secret: ${secretId}`);
    
    const secret = await secretsManager
      .getSecretValue({
        SecretId: secretId,
      })
      .promise();

    const credentials = JSON.parse(secret.SecretString);

    // Create database client
    const client = new Client({
      host: credentials.host,
      port: credentials.port,
      database: credentials.dbname,
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false },
    });

    console.log('Connecting to database...');
    await client.connect();

    // Clear existing data if requested
    if (clearData) {
      console.log('Clearing existing sample data...');
      try {
        // Clear data in reverse order of dependencies
        await client.query('TRUNCATE TABLE request_status_history CASCADE;');
        await client.query('TRUNCATE TABLE employee_address_history CASCADE;');
        await client.query('TRUNCATE TABLE travel_requests CASCADE;');
        await client.query('TRUNCATE TABLE subprojects CASCADE;');
        await client.query('TRUNCATE TABLE projects CASCADE;');
        await client.query(
          "DELETE FROM employees WHERE employee_id LIKE 'EMP-%' OR employee_id LIKE 'ADM-%' OR employee_id LIKE 'MGR-%';"
        );
        console.log('Existing sample data cleared successfully');
      } catch (clearError) {
        console.log('Warning: Error clearing data (may not exist yet):', clearError.message);
      }
    }

    // Run database migrations to ensure schema exists
    console.log('Running database migrations...');
    await runMigrations(client);
    console.log('Database migrations completed successfully');

    // Load sample data from infrastructure/data directory (single source of truth)
    console.log('Reading sample data template from infrastructure/data/sample-data.sql...');
    const sampleDataPath = path.join(__dirname, 'data/sample-data.sql');
    let sampleDataSQL = fs.readFileSync(sampleDataPath, 'utf8');

    if (useMockIds) {
      console.log(
        'Using mock authentication for dev environment - sample data already contains mock UUIDs'
      );
      // Sample data already contains the correct mock UUIDs, no replacement needed
      for (const userInfo of sampleUsers) {
        console.log(`Mock user: ${userInfo.email} → ${userInfo.mockId} (pre-configured in SQL)`);
      }
    } else {
      console.log('Staging/Production environment detected - using existing Cognito user system');
      console.log('Note: Users should already exist from the user creator function during CDK deployment');
      
      // Get real Cognito user IDs to replace mock UUIDs in sample data
      const userPoolId = process.env.USER_POOL_ID;
      if (userPoolId) {
        console.log('Retrieving real Cognito user IDs for sample data mapping...');
        
        // Create mapping from mock UUIDs to real Cognito IDs
        const userIdMapping = {};
        
        for (const userInfo of sampleUsers) {
          try {
            const getUserParams = {
              UserPoolId: userPoolId,
              Username: userInfo.email,
            };
            
            const existingUser = await cognitoClient.adminGetUser(getUserParams).promise();
            const realCognitoId = existingUser.Username;
            
            userIdMapping[userInfo.mockId] = realCognitoId;
            console.log(`Mapping: ${userInfo.email} → ${userInfo.mockId} → ${realCognitoId}`);
          } catch (err) {
            console.warn(`Could not find user ${userInfo.email} in Cognito:`, err.message);
            // Use mock ID as fallback if user doesn't exist
            userIdMapping[userInfo.mockId] = userInfo.mockId;
          }
        }
        
        // Replace mock UUIDs with real Cognito IDs in sample data
        console.log('Replacing mock UUIDs with real Cognito user IDs...');
        let updatedSampleDataSQL = sampleDataSQL;
        
        for (const [mockId, realId] of Object.entries(userIdMapping)) {
          // Replace all occurrences of mock UUID with real UUID
          const regex = new RegExp(mockId.replace(/-/g, '\\-'), 'g');
          updatedSampleDataSQL = updatedSampleDataSQL.replace(regex, realId);
        }
        
        sampleDataSQL = updatedSampleDataSQL;
        console.log('UUID replacement completed');
      } else {
        console.warn('USER_POOL_ID not available, using sample data as-is with mock UUIDs');
      }
    }

    console.log('Loading sample data...');
    await client.query(sampleDataSQL);

    // Verify data loaded
    console.log('Verifying data loaded...');
    const employeeCount = await client.query('SELECT COUNT(*) as count FROM employees');
    const projectCount = await client.query('SELECT COUNT(*) as count FROM projects');
    const subprojectCount = await client.query('SELECT COUNT(*) as count FROM subprojects');
    const requestCount = await client.query('SELECT COUNT(*) as count FROM travel_requests');

    console.log(`Loaded ${employeeCount.rows[0].count} employees`);
    console.log(`Loaded ${projectCount.rows[0].count} projects`);
    console.log(`Loaded ${subprojectCount.rows[0].count} subprojects`);
    console.log(`Loaded ${requestCount.rows[0].count} travel requests`);

    await client.end();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Sample data loaded successfully with mock UUIDs',
        environment: environment,
        useMockIds: useMockIds,
        employees: employeeCount.rows[0].count,
        projects: projectCount.rows[0].count,
        subprojects: subprojectCount.rows[0].count,
        requests: requestCount.rows[0].count,
        mockUsers: sampleUsers.map(u => u.email),
      }),
    };
  } catch (error) {
    console.error('Error loading sample data:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to load sample data',
        details: error.message,
      }),
    };
  }
};
