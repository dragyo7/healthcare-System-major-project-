const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/.env') });
const db = require(path.join(__dirname, '../Portal Major P/Bhumi/Doctor portal/backend/src/config/db'));

async function cleanup() {
  console.log('=== SAFE DATABASE BACKUP & TRANSIENT TEST DATA CLEANUP ===\n');

  const dumpPath = path.join(__dirname, 'pre_cleanup_backup.sql');
  const mysqldumpExe = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';

  // 1. Mandatory Pre-cleanup Backup
  console.log(`[1/3] Creating mandatory pre-cleanup backup to ${dumpPath}...`);
  const dumpCmd = `"${mysqldumpExe}" -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} --host=127.0.0.1 rag_healthcare --result-file="${dumpPath}"`;
  execSync(dumpCmd, { stdio: 'pipe' });
  console.log('      ✓ Backup created successfully.\n');

  // 2. Identify transient test users
  console.log('[2/3] Identifying transient timestamped test accounts...');
  const [transientUsers] = await db.execute(`
    SELECT user_id, email, full_name 
    FROM users 
    WHERE email LIKE '%_17918%' 
       OR email LIKE 'testpatient_%' 
       OR email LIKE 'sec_verify_%' 
       OR email LIKE 'concurrent_%' 
       OR email LIKE 'synthetic_pat_%'
       OR email LIKE 'self_reg_pat_%'
       OR email LIKE 'pooja_browser_test%'
  `);

  console.log(`      Found ${transientUsers.length} transient test user accounts to prune.`);
  if (transientUsers.length === 0) {
    console.log('      No transient accounts to prune. Database is already clean.');
    process.exit(0);
  }

  const userIds = transientUsers.map(u => u.user_id);
  console.log('      Target User IDs:', userIds.join(', '));

  // 3. Transactional cleanup of child records and users
  console.log('\n[3/3] Executing transactional pruning of transient test records...');
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    const placeholders = userIds.map(() => '?').join(',');

    // Delete activations
    const [actRes] = await connection.execute(
      `DELETE FROM account_activations WHERE user_id IN (${placeholders})`,
      userIds
    );
    console.log(`      Deleted ${actRes.affectedRows} transient account activations.`);

    // Delete patients
    const [patRes] = await connection.execute(
      `DELETE FROM patients WHERE user_id IN (${placeholders})`,
      userIds
    );
    console.log(`      Deleted ${patRes.affectedRows} transient patient records.`);

    // Delete users
    const [userRes] = await connection.execute(
      `DELETE FROM users WHERE user_id IN (${placeholders})`,
      userIds
    );
    console.log(`      Deleted ${userRes.affectedRows} transient user accounts.`);

    await connection.commit();
    console.log('\n>>> CLEANUP TRANSACTION COMMITTED SUCCESSFULLY! <<<');

    // Verify canonical accounts remain intact
    const [canonicalUsers] = await db.execute("SELECT user_id, email, role, full_name FROM users ORDER BY user_id");
    console.log('\nPreserved Canonical Accounts:');
    for (const u of canonicalUsers) {
      console.log(`  • ID ${u.user_id} [${u.role}]: ${u.email} (${u.full_name})`);
    }

  } catch (err) {
    await connection.rollback();
    console.error('Cleanup failed, rolled back:', err);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

cleanup().catch(err => {
  console.error(err);
  process.exit(1);
});
