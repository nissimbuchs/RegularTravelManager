const { Client } = require('pg');
const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

exports.handler = async (event) => {
    const secretsManager = new AWS.SecretsManager();
    
    try {
        console.log('Starting database schema creation and sample data loading process...');
        
        // Get database credentials
        const secret = await secretsManager.getSecretValue({
            SecretId: 'rtm-dev-db-credentials'
        }).promise();
        
        const credentials = JSON.parse(secret.SecretString);
        
        // Create database client
        const client = new Client({
            host: credentials.host,
            port: credentials.port,
            database: credentials.dbname,
            user: credentials.username,
            password: credentials.password,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log('Connecting to database...');
        await client.connect();
        
        // Create database schema using root schema file
        console.log('Reading database schema from root init-db-schema-only.sql...');
        const schemaPath = path.join(__dirname, 'init-db-schema-only.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Creating database schema...');
        await client.query(schemaSQL);
        
        console.log('Schema created successfully.');
        
        // Load sample data using root sample data file, but with updated Cognito IDs
        console.log('Reading sample data template from root sample-data.sql...');
        const sampleDataPath = path.join(__dirname, 'sample-data.sql');
        let sampleDataSQL = fs.readFileSync(sampleDataPath, 'utf8');
        
        // Update the sample data with actual Cognito User IDs
        console.log('Updating sample data with actual Cognito User IDs...');
        const cognitoIdMappings = {
            'admin1@company.ch': 'e3045872-9071-7099-1de4-44cabca82b9a',
            'admin2@company.ch': 'a3b48892-c081-70bb-c246-dc55b4e5fb4f', 
            'manager1@company.ch': '835458d2-d051-70ad-c9e3-98062e88be60',
            'manager2@company.ch': '03d43822-30c1-70f0-01d8-8cfb15ec481c',
            'employee1@company.ch': '8334c852-b071-7008-2544-3a524de86313',
            'employee2@company.ch': '631408c2-60f1-70c3-e489-394e1c27703d',
            'employee3@company.ch': '13b47862-e041-70f2-a121-32f2bc909a7c'
        };
        
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
                message: 'Sample data loaded successfully using root files',
                employees: employeeCount.rows[0].count,
                projects: projectCount.rows[0].count,
                subprojects: subprojectCount.rows[0].count,
                requests: requestCount.rows[0].count
            })
        };
        
    } catch (error) {
        console.error('Error loading sample data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to load sample data',
                details: error.message
            })
        };
    }
};