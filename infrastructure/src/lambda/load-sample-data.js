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

// Sample users configuration with roles
const sampleUsers = [
  {
    email: 'admin1@company.ch',
    firstName: 'Hans',
    lastName: 'Zimmermann',
    role: 'administrators',
  },
  {
    email: 'admin2@company.ch',
    firstName: 'Maria',
    lastName: 'Weber',
    role: 'administrators',
  },
  {
    email: 'manager1@company.ch',
    firstName: 'Thomas',
    lastName: 'Müller',
    role: 'managers',
  },
  {
    email: 'manager2@company.ch',
    firstName: 'Sophie',
    lastName: 'Dubois',
    role: 'managers',
  },
  {
    email: 'employee1@company.ch',
    firstName: 'Anna',
    lastName: 'Schneider',
    role: 'employees',
  },
  {
    email: 'employee2@company.ch',
    firstName: 'Marco',
    lastName: 'Rossi',
    role: 'employees',
  },
  {
    email: 'employee3@company.ch',
    firstName: 'Lisa',
    lastName: 'Meier',
    role: 'employees',
  },
  {
    email: 'employee4@company.ch',
    firstName: 'Pierre',
    lastName: 'Martin',
    role: 'employees',
  },
  {
    email: 'employee5@company.ch',
    firstName: 'Julia',
    lastName: 'Fischer',
    role: 'employees',
  },
  {
    email: 'employee6@company.ch',
    firstName: 'Michael',
    lastName: 'Keller',
    role: 'employees',
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

    // Get database credentials
    const secret = await secretsManager
      .getSecretValue({
        SecretId: 'rtm-dev-db-credentials',
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

    // Run database migrations to ensure schema exists
    console.log('Running database migrations...');
    await runMigrations(client);
    console.log('Database migrations completed successfully');

    // Load sample data from infrastructure/data directory (single source of truth)
    console.log('Reading sample data template from infrastructure/data/sample-data.sql...');
    const sampleDataPath = path.join(__dirname, 'data/sample-data.sql');
    let sampleDataSQL = fs.readFileSync(sampleDataPath, 'utf8');

    // Create/verify Cognito users and get their actual IDs
    console.log('Creating/verifying Cognito users and retrieving actual User IDs...');
    const userPoolId = process.env.USER_POOL_ID;
    if (!userPoolId) {
      throw new Error('USER_POOL_ID environment variable not set');
    }

    const cognitoIdMappings = {};
    for (const userInfo of sampleUsers) {
      try {
        const cognitoUserId = await ensureCognitoUser(cognitoClient, userPoolId, userInfo);
        cognitoIdMappings[userInfo.email] = cognitoUserId;
        console.log(`Mapped ${userInfo.email} → ${cognitoUserId}`);
      } catch (error) {
        console.error(`Failed to create/verify user ${userInfo.email}:`, error);
        throw error;
      }
    }

    // Replace the cognito_user_id values in the sample data
    for (const [email, cognitoId] of Object.entries(cognitoIdMappings)) {
      // Replace the cognito_user_id values (they appear as email in the original)
      sampleDataSQL = sampleDataSQL.replace(new RegExp(`'${email}'`, 'g'), `'${cognitoId}'`);
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
        message: 'Sample data loaded successfully with dynamic Cognito users',
        cognitoUsers: Object.keys(cognitoIdMappings).length,
        employees: employeeCount.rows[0].count,
        projects: projectCount.rows[0].count,
        subprojects: subprojectCount.rows[0].count,
        requests: requestCount.rows[0].count,
        cognitoMappings: Object.keys(cognitoIdMappings),
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
