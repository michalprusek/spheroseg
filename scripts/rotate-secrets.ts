#!/usr/bin/env ts-node

/**
 * Manual Secret Rotation Script
 * 
 * Usage:
 *   npm run rotate-secrets                    # Rotate all due secrets
 *   npm run rotate-secrets -- --secret JWT_SECRET  # Rotate specific secret
 *   npm run rotate-secrets -- --force         # Force rotation even if not due
 *   npm run rotate-secrets -- --dry-run       # Show what would be rotated
 */

import { program } from 'commander';
import { Redis } from 'ioredis';
import { pool } from '../packages/backend/src/db';
import { 
  initializeSecretRotation, 
  getSecretRotationManager 
} from '../packages/backend/src/utils/secretRotation';
import { 
  getValidatedRotationConfig,
  secretRotationConfig 
} from '../packages/backend/src/config/secretRotation.config';
import logger from '../packages/backend/src/utils/logger';

// Parse command line arguments
program
  .option('-s, --secret <name>', 'Rotate specific secret')
  .option('-f, --force', 'Force rotation even if not due')
  .option('-d, --dry-run', 'Show what would be rotated without making changes')
  .option('-e, --emergency', 'Emergency rotation (shorter grace period)')
  .option('--list', 'List all secrets and their rotation status')
  .option('--validate', 'Validate secret rotation configuration')
  .parse(process.argv);

const options = program.opts();

async function main() {
  let redis: Redis | null = null;
  
  try {
    // Initialize Redis connection
    redis = new Redis({
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password: process.env['REDIS_PASSWORD'],
    });

    // Initialize rotation manager
    const rotationManager = initializeSecretRotation(redis);

    // Register all secrets from configuration
    const configs = getValidatedRotationConfig();
    for (const config of configs) {
      // Adjust for emergency rotation if requested
      if (options.emergency) {
        config.gracePeriodHours = Math.min(config.gracePeriodHours, 4);
      }
      rotationManager.registerSecret(config);
    }

    if (options.validate) {
      // Validate all secrets
      console.log('Validating secret rotation configuration...');
      const validation = await rotationManager.validateSecrets();
      
      if (validation.valid) {
        console.log('✅ All secrets are properly configured');
      } else {
        console.error('❌ Validation errors found:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }
      return;
    }

    if (options.list) {
      // List all secrets and their status
      console.log('\nSecret Rotation Status:');
      console.log('======================\n');
      
      const status = await rotationManager.getRotationStatus();
      
      for (const item of status) {
        console.log(`Secret: ${item.secret.name}`);
        console.log(`  Type: ${item.secret.type}`);
        console.log(`  Rotation Interval: ${item.secret.rotationIntervalDays} days`);
        console.log(`  Grace Period: ${item.secret.gracePeriodHours} hours`);
        console.log(`  Active Version: ${item.activeVersion || 'None'}`);
        
        if (item.schedule) {
          console.log(`  Last Rotation: ${item.schedule.lastRotation || 'Never'}`);
          console.log(`  Next Rotation: ${item.schedule.nextRotation}`);
          console.log(`  Rotation Count: ${item.schedule.rotationCount}`);
          
          const isOverdue = item.schedule.nextRotation < new Date();
          if (isOverdue) {
            console.log(`  ⚠️  Status: OVERDUE`);
          } else {
            console.log(`  ✅ Status: On Schedule`);
          }
        } else {
          console.log(`  ⚠️  No rotation schedule found`);
        }
        
        console.log('');
      }
      return;
    }

    if (options.secret) {
      // Rotate specific secret
      const secretConfig = configs.find(c => c.name === options.secret);
      if (!secretConfig) {
        console.error(`❌ Secret "${options.secret}" not found in configuration`);
        console.error(`Available secrets: ${configs.map(c => c.name).join(', ')}`);
        process.exit(1);
      }

      if (options.dryRun) {
        console.log(`Would rotate secret: ${options.secret}`);
        console.log(`  Type: ${secretConfig.type}`);
        console.log(`  Grace Period: ${secretConfig.gracePeriodHours} hours`);
        return;
      }

      console.log(`Rotating secret: ${options.secret}...`);
      const result = await rotationManager.rotateSecret(options.secret);
      
      if (result.success) {
        console.log(`✅ Successfully rotated ${result.secretName}`);
        console.log(`  Old Version: ${result.oldVersion}`);
        console.log(`  New Version: ${result.newVersion}`);
        console.log(`  Grace Period Ends: ${result.gracePeriodEnds}`);
      } else {
        console.error(`❌ Failed to rotate ${result.secretName}: ${result.error}`);
        process.exit(1);
      }
    } else {
      // Rotate all due secrets
      console.log('Checking for secrets due for rotation...\n');
      
      const status = await rotationManager.getRotationStatus();
      const dueSecrets = [];
      
      for (const item of status) {
        if (options.force || !item.schedule || item.schedule.nextRotation < new Date()) {
          dueSecrets.push(item.secret.name);
        }
      }
      
      if (dueSecrets.length === 0) {
        console.log('✅ No secrets are due for rotation');
        return;
      }
      
      console.log(`Found ${dueSecrets.length} secret(s) due for rotation:`);
      dueSecrets.forEach(name => console.log(`  - ${name}`));
      console.log('');
      
      if (options.dryRun) {
        console.log('Dry run mode - no changes will be made');
        return;
      }
      
      // Rotate each due secret
      for (const secretName of dueSecrets) {
        console.log(`\nRotating ${secretName}...`);
        const result = await rotationManager.rotateSecret(secretName);
        
        if (result.success) {
          console.log(`✅ Successfully rotated ${result.secretName}`);
        } else {
          console.error(`❌ Failed to rotate ${result.secretName}: ${result.error}`);
        }
      }
    }
    
    // Generate summary report
    if (!options.dryRun && !options.validate && !options.list) {
      console.log('\n📊 Rotation Summary:');
      console.log('==================');
      
      // Query recent rotations from audit table
      const recentRotations = await pool.query(`
        SELECT secret_name, status, COUNT(*) as count
        FROM secret_rotation_audit
        WHERE rotated_at >= NOW() - INTERVAL '1 hour'
        GROUP BY secret_name, status
        ORDER BY secret_name
      `);
      
      if (recentRotations.rows.length > 0) {
        recentRotations.rows.forEach(row => {
          const emoji = row.status === 'success' ? '✅' : '❌';
          console.log(`${emoji} ${row.secret_name}: ${row.count} rotation(s) - ${row.status}`);
        });
      } else {
        console.log('No rotations performed in the last hour');
      }
    }

  } catch (error) {
    logger.error('Secret rotation script failed', { error });
    console.error('❌ Script failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    // Cleanup
    if (redis) {
      redis.disconnect();
    }
    await pool.end();
  }
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});