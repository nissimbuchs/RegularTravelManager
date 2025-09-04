#!/usr/bin/env tsx

/**
 * Sample Data Validation Script
 * Description: Validates sample data integrity and consistency
 * Version: 1.0
 * Date: 2025-09-04
 */

import { Client } from 'pg';

interface ValidationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

interface DatabaseStats {
  employees: { total: number; admins: number; managers: number; regular: number };
  projects: { total: number; active: number };
  subprojects: { total: number; active: number };
  travelRequests: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    withdrawn: number;
  };
  auditRecords: { statusHistory: number; addressHistory: number };
}

class SampleDataValidator {
  private client: Client;
  private results: ValidationResult[] = [];

  constructor(databaseUrl: string) {
    this.client = new Client({
      connectionString: databaseUrl,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  private addResult(name: string, passed: boolean, message: string, details?: any): void {
    this.results.push({ name, passed, message, details });
  }

  async validateEmployeeHierarchy(): Promise<void> {
    const query = `
      WITH RECURSIVE employee_hierarchy AS (
        -- Base case: employees without managers (top level)
        SELECT id, employee_id, first_name, last_name, manager_id, 0 as level
        FROM employees 
        WHERE manager_id IS NULL
        
        UNION ALL
        
        -- Recursive case: employees with managers
        SELECT e.id, e.employee_id, e.first_name, e.last_name, e.manager_id, eh.level + 1
        FROM employees e
        INNER JOIN employee_hierarchy eh ON e.manager_id = eh.id
      )
      SELECT * FROM employee_hierarchy WHERE level > 5; -- Check for circular references
    `;

    try {
      const result = await this.client.query(query);

      if (result.rows.length > 0) {
        this.addResult(
          'Employee Hierarchy',
          false,
          'Circular reference or excessive hierarchy depth detected',
          result.rows
        );
      } else {
        // Check for orphaned managers
        const orphanCheck = await this.client.query(`
          SELECT e.employee_id, e.first_name, e.last_name, e.manager_id
          FROM employees e
          LEFT JOIN employees m ON e.manager_id = m.id
          WHERE e.manager_id IS NOT NULL AND m.id IS NULL
        `);

        if (orphanCheck.rows.length > 0) {
          this.addResult(
            'Employee Hierarchy',
            false,
            'Orphaned employees found (manager references invalid)',
            orphanCheck.rows
          );
        } else {
          this.addResult(
            'Employee Hierarchy',
            true,
            'Employee hierarchy is valid with no circular references or orphaned records'
          );
        }
      }
    } catch (error) {
      this.addResult('Employee Hierarchy', false, `Validation failed: ${error.message}`);
    }
  }

  async validateGeographicData(): Promise<void> {
    try {
      // Validate employee coordinates (Swiss bounds approximately)
      const employeeCoordCheck = await this.client.query(`
        SELECT employee_id, first_name, last_name, home_city,
               ST_X(home_location) as longitude, ST_Y(home_location) as latitude
        FROM employees
        WHERE ST_X(home_location) < 5.9 OR ST_X(home_location) > 10.5 
           OR ST_Y(home_location) < 45.8 OR ST_Y(home_location) > 47.9
      `);

      if (employeeCoordCheck.rows.length > 0) {
        this.addResult(
          'Employee Geographic Data',
          false,
          'Employee coordinates outside Swiss bounds detected',
          employeeCoordCheck.rows
        );
      } else {
        this.addResult(
          'Employee Geographic Data',
          true,
          'All employee coordinates are within Swiss geographic bounds'
        );
      }

      // Validate subproject coordinates
      const subprojectCoordCheck = await this.client.query(`
        SELECT id, name, city,
               ST_X(location) as longitude, ST_Y(location) as latitude
        FROM subprojects
        WHERE ST_X(location) < 5.9 OR ST_X(location) > 10.5 
           OR ST_Y(location) < 45.8 OR ST_Y(location) > 47.9
      `);

      if (subprojectCoordCheck.rows.length > 0) {
        this.addResult(
          'Subproject Geographic Data',
          false,
          'Subproject coordinates outside Swiss bounds detected',
          subprojectCoordCheck.rows
        );
      } else {
        this.addResult(
          'Subproject Geographic Data',
          true,
          'All subproject coordinates are within Swiss geographic bounds'
        );
      }
    } catch (error) {
      this.addResult(
        'Geographic Data Validation',
        false,
        `Geographic validation failed: ${error.message}`
      );
    }
  }

  async validateDistanceCalculations(): Promise<void> {
    try {
      const distanceCheck = await this.client.query(`
        SELECT 
          tr.id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.home_city as employee_city,
          sp.city as subproject_city,
          tr.calculated_distance_km,
          calculate_travel_distance(e.home_location, sp.location) as recalculated_distance
        FROM travel_requests tr
        JOIN employees e ON tr.employee_id = e.id
        JOIN subprojects sp ON tr.subproject_id = sp.id
      `);

      const inaccurateCalculations = distanceCheck.rows.filter(row => {
        const diff = Math.abs(row.calculated_distance_km - row.recalculated_distance);
        return diff > 0.1; // Allow 100m tolerance
      });

      if (inaccurateCalculations.length > 0) {
        this.addResult(
          'Distance Calculations',
          false,
          'Distance calculation inconsistencies detected',
          inaccurateCalculations
        );
      } else {
        this.addResult(
          'Distance Calculations',
          true,
          'All distance calculations are consistent with PostGIS functions'
        );
      }

      // Validate reasonable distance ranges
      const extremeDistances = distanceCheck.rows.filter(
        row => row.calculated_distance_km < 0 || row.calculated_distance_km > 500
      );

      if (extremeDistances.length > 0) {
        this.addResult(
          'Distance Ranges',
          false,
          'Unreasonable distances detected (negative or >500km within Switzerland)',
          extremeDistances
        );
      } else {
        this.addResult(
          'Distance Ranges',
          true,
          'All distances are within reasonable ranges for Switzerland'
        );
      }
    } catch (error) {
      this.addResult(
        'Distance Calculations',
        false,
        `Distance validation failed: ${error.message}`
      );
    }
  }

  async validateBusinessConstraints(): Promise<void> {
    try {
      // Check cost rate constraints
      const invalidCosts = await this.client.query(`
        SELECT 'projects' as table_name, id, name, default_cost_per_km as cost
        FROM projects 
        WHERE default_cost_per_km <= 0
        UNION ALL
        SELECT 'subprojects' as table_name, id, name, cost_per_km as cost
        FROM subprojects 
        WHERE cost_per_km <= 0
      `);

      if (invalidCosts.rows.length > 0) {
        this.addResult(
          'Cost Rate Constraints',
          false,
          'Invalid cost rates detected (must be > 0)',
          invalidCosts.rows
        );
      } else {
        this.addResult('Cost Rate Constraints', true, 'All cost rates are positive values');
      }

      // Check days per week constraints
      const invalidDays = await this.client.query(`
        SELECT id, days_per_week, justification
        FROM travel_requests
        WHERE days_per_week < 1 OR days_per_week > 7
      `);

      if (invalidDays.rows.length > 0) {
        this.addResult(
          'Days Per Week Constraints',
          false,
          'Invalid days_per_week values detected (must be 1-7)',
          invalidDays.rows
        );
      } else {
        this.addResult(
          'Days Per Week Constraints',
          true,
          'All days_per_week values are within valid range (1-7)'
        );
      }

      // Check allowance calculations
      const invalidAllowances = await this.client.query(`
        SELECT 
          tr.id,
          tr.calculated_distance_km,
          tr.calculated_allowance_chf,
          tr.days_per_week,
          sp.cost_per_km,
          (tr.calculated_distance_km * sp.cost_per_km * tr.days_per_week) as expected_allowance
        FROM travel_requests tr
        JOIN subprojects sp ON tr.subproject_id = sp.id
        WHERE ABS(tr.calculated_allowance_chf - (tr.calculated_distance_km * sp.cost_per_km * tr.days_per_week)) > 0.01
      `);

      if (invalidAllowances.rows.length > 0) {
        this.addResult(
          'Allowance Calculations',
          false,
          'Allowance calculation inconsistencies detected',
          invalidAllowances.rows
        );
      } else {
        this.addResult(
          'Allowance Calculations',
          true,
          'All allowance calculations are mathematically correct'
        );
      }
    } catch (error) {
      this.addResult(
        'Business Constraints',
        false,
        `Business constraint validation failed: ${error.message}`
      );
    }
  }

  async validateForeignKeyIntegrity(): Promise<void> {
    try {
      const checks = [
        {
          name: 'Employee Manager References',
          query: `
            SELECT e.employee_id, e.manager_id
            FROM employees e
            LEFT JOIN employees m ON e.manager_id = m.id
            WHERE e.manager_id IS NOT NULL AND m.id IS NULL
          `,
        },
        {
          name: 'Travel Request Employee References',
          query: `
            SELECT tr.id, tr.employee_id
            FROM travel_requests tr
            LEFT JOIN employees e ON tr.employee_id = e.id
            WHERE e.id IS NULL
          `,
        },
        {
          name: 'Travel Request Manager References',
          query: `
            SELECT tr.id, tr.manager_id
            FROM travel_requests tr
            LEFT JOIN employees m ON tr.manager_id = m.id
            WHERE m.id IS NULL
          `,
        },
        {
          name: 'Travel Request Project References',
          query: `
            SELECT tr.id, tr.project_id
            FROM travel_requests tr
            LEFT JOIN projects p ON tr.project_id = p.id
            WHERE p.id IS NULL
          `,
        },
        {
          name: 'Travel Request Subproject References',
          query: `
            SELECT tr.id, tr.subproject_id
            FROM travel_requests tr
            LEFT JOIN subprojects sp ON tr.subproject_id = sp.id
            WHERE sp.id IS NULL
          `,
        },
        {
          name: 'Subproject Project References',
          query: `
            SELECT sp.id, sp.project_id
            FROM subprojects sp
            LEFT JOIN projects p ON sp.project_id = p.id
            WHERE p.id IS NULL
          `,
        },
      ];

      let allIntegrityChecksPassed = true;

      for (const check of checks) {
        const result = await this.client.query(check.query);
        if (result.rows.length > 0) {
          this.addResult(
            check.name,
            false,
            'Foreign key integrity violations detected',
            result.rows
          );
          allIntegrityChecksPassed = false;
        }
      }

      if (allIntegrityChecksPassed) {
        this.addResult('Foreign Key Integrity', true, 'All foreign key references are valid');
      }
    } catch (error) {
      this.addResult(
        'Foreign Key Integrity',
        false,
        `Foreign key validation failed: ${error.message}`
      );
    }
  }

  async validateAuditTrails(): Promise<void> {
    try {
      // Check that processed requests have status history
      const processedWithoutHistory = await this.client.query(`
        SELECT tr.id, tr.status, tr.processed_at
        FROM travel_requests tr
        LEFT JOIN request_status_history rsh ON tr.id = rsh.travel_request_id
        WHERE tr.status IN ('approved', 'rejected') 
          AND tr.processed_at IS NOT NULL
          AND rsh.travel_request_id IS NULL
      `);

      if (processedWithoutHistory.rows.length > 0) {
        this.addResult(
          'Status History Audit Trail',
          false,
          'Processed requests without status history detected',
          processedWithoutHistory.rows
        );
      } else {
        this.addResult(
          'Status History Audit Trail',
          true,
          'All processed requests have corresponding status history records'
        );
      }

      // Validate status transitions
      const invalidTransitions = await this.client.query(`
        SELECT rsh.travel_request_id, rsh.previous_status, rsh.new_status
        FROM request_status_history rsh
        WHERE (rsh.previous_status, rsh.new_status) NOT IN (
          ('pending', 'approved'),
          ('pending', 'rejected'), 
          ('pending', 'withdrawn'),
          ('approved', 'withdrawn'),
          ('rejected', 'withdrawn')
        )
      `);

      if (invalidTransitions.rows.length > 0) {
        this.addResult(
          'Status Transition Validation',
          false,
          'Invalid status transitions detected',
          invalidTransitions.rows
        );
      } else {
        this.addResult(
          'Status Transition Validation',
          true,
          'All status transitions follow valid business rules'
        );
      }
    } catch (error) {
      this.addResult(
        'Audit Trail Validation',
        false,
        `Audit trail validation failed: ${error.message}`
      );
    }
  }

  async getDataStatistics(): Promise<DatabaseStats> {
    try {
      // Employee statistics
      const employeeStats = await this.client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE employee_id LIKE 'ADM-%') as admins,
          COUNT(*) FILTER (WHERE employee_id LIKE 'MGR-%') as managers,
          COUNT(*) FILTER (WHERE employee_id LIKE 'EMP-%') as regular
        FROM employees
      `);

      // Project statistics
      const projectStats = await this.client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM projects
      `);

      // Subproject statistics
      const subprojectStats = await this.client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM subprojects
      `);

      // Travel request statistics
      const requestStats = await this.client.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'pending') as pending,
          COUNT(*) FILTER (WHERE status = 'approved') as approved,
          COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
          COUNT(*) FILTER (WHERE status = 'withdrawn') as withdrawn
        FROM travel_requests
      `);

      // Audit record statistics
      const auditStats = await this.client.query(`
        SELECT 
          (SELECT COUNT(*) FROM request_status_history) as status_history,
          (SELECT COUNT(*) FROM employee_address_history) as address_history
      `);

      return {
        employees: {
          total: parseInt(employeeStats.rows[0].total),
          admins: parseInt(employeeStats.rows[0].admins),
          managers: parseInt(employeeStats.rows[0].managers),
          regular: parseInt(employeeStats.rows[0].regular),
        },
        projects: {
          total: parseInt(projectStats.rows[0].total),
          active: parseInt(projectStats.rows[0].active),
        },
        subprojects: {
          total: parseInt(subprojectStats.rows[0].total),
          active: parseInt(subprojectStats.rows[0].active),
        },
        travelRequests: {
          total: parseInt(requestStats.rows[0].total),
          pending: parseInt(requestStats.rows[0].pending),
          approved: parseInt(requestStats.rows[0].approved),
          rejected: parseInt(requestStats.rows[0].rejected),
          withdrawn: parseInt(requestStats.rows[0].withdrawn),
        },
        auditRecords: {
          statusHistory: parseInt(auditStats.rows[0].status_history),
          addressHistory: parseInt(auditStats.rows[0].address_history),
        },
      };
    } catch (error) {
      throw new Error(`Statistics gathering failed: ${error.message}`);
    }
  }

  async runAllValidations(): Promise<{
    results: ValidationResult[];
    stats: DatabaseStats;
    passed: boolean;
  }> {
    console.log('🔍 Starting comprehensive sample data validation...\n');

    await this.validateEmployeeHierarchy();
    await this.validateGeographicData();
    await this.validateDistanceCalculations();
    await this.validateBusinessConstraints();
    await this.validateForeignKeyIntegrity();
    await this.validateAuditTrails();

    const stats = await this.getDataStatistics();
    const passed = this.results.every(result => result.passed);

    return { results: this.results, stats, passed };
  }

  printResults(results: ValidationResult[], stats: DatabaseStats, passed: boolean): void {
    console.log('📊 Database Statistics:');
    console.log(`  👑 Admin Users: ${stats.employees.admins}`);
    console.log(`  👨‍💼 Managers: ${stats.employees.managers}`);
    console.log(`  👥 Regular Employees: ${stats.employees.regular}`);
    console.log(`  📁 Total Employees: ${stats.employees.total}\n`);

    console.log(`  🏢 Projects: ${stats.projects.total} (${stats.projects.active} active)`);
    console.log(
      `  📍 Subprojects: ${stats.subprojects.total} (${stats.subprojects.active} active)\n`
    );

    console.log(`  ✈️  Travel Requests: ${stats.travelRequests.total}`);
    console.log(`    - Pending: ${stats.travelRequests.pending}`);
    console.log(`    - Approved: ${stats.travelRequests.approved}`);
    console.log(`    - Rejected: ${stats.travelRequests.rejected}`);
    console.log(`    - Withdrawn: ${stats.travelRequests.withdrawn}\n`);

    console.log(`  📜 Audit Records:`);
    console.log(`    - Status History: ${stats.auditRecords.statusHistory}`);
    console.log(`    - Address History: ${stats.auditRecords.addressHistory}\n`);

    console.log('🧪 Validation Results:');
    console.log('='.repeat(80));

    for (const result of results) {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);

      if (!result.passed && result.details) {
        console.log('   Details:', JSON.stringify(result.details, null, 2));
      }
    }

    console.log('='.repeat(80));

    if (passed) {
      console.log(
        '🎉 All validations passed! Sample data is consistent and ready for development.'
      );
    } else {
      console.log('⚠️  Some validations failed. Please review and fix the issues above.');
    }
  }
}

// Main execution
async function main() {
  const databaseUrl =
    process.env.DATABASE_URL || 'postgresql://nissim:devpass123@localhost:5432/travel_manager_dev';

  console.log('🔗 Connecting to database:', databaseUrl.replace(/:[^:@]*@/, ':****@'));

  const validator = new SampleDataValidator(databaseUrl);

  try {
    await validator.connect();
    const { results, stats, passed } = await validator.runAllValidations();
    validator.printResults(results, stats, passed);

    process.exit(passed ? 0 : 1);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  } finally {
    await validator.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
}

export { SampleDataValidator, ValidationResult, DatabaseStats };
