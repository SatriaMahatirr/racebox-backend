const db = require('../models/db');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING RACEBOX REGISTRATION APPROVAL TEST SUITE');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log('  ✓ PASS:', message);
      passed++;
    } else {
      console.error('  ✕ FAIL:', message);
      failed++;
    }
  }

  // Clean up any previous test accounts
  await db.query("DELETE FROM registration_approval_logs WHERE user_id IN (SELECT id FROM users WHERE email IN ('testrider@racebox.local', 'spammer@racebox.local'))");
  await db.query("DELETE FROM users WHERE email IN ('testrider@racebox.local', 'spammer@racebox.local')");

  // TEST 1: Register new user -> Must be pending, no tokens issued
  console.log('\n[TEST 1] Register new user');
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Budi Santoso',
      email: 'testrider@racebox.local',
      password: 'password123',
      role: 'admin', // Attack attempt: try to escalate role
      status: 'approved' // Attack attempt: try to self-approve
    })
  });
  const regData = await regRes.json();
  assert(regRes.status === 201, 'Registration returns HTTP 201');
  assert(regData.success === true, 'Response success is true');
  assert(regData.data.status === 'pending', 'User status in response is pending');
  assert(!regData.data.accessToken, 'Access token is NOT provided for pending user');

  // Verify DB directly
  const [[dbUser]] = await db.query("SELECT * FROM users WHERE email = 'testrider@racebox.local'");
  assert(dbUser && dbUser.status === 'pending', 'Database status is strictly pending');
  assert(dbUser.role === 'pengguna', 'Role escalation prevented; role is pengguna');

  // TEST 2: Login as pending user -> Must return HTTP 403 with ACCOUNT_PENDING
  console.log('\n[TEST 2] Login as pending user');
  const loginPendingRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testrider@racebox.local', password: 'password123' })
  });
  const loginPendingData = await loginPendingRes.json();
  assert(loginPendingRes.status === 403, 'Login returns HTTP 403 Forbidden');
  assert(loginPendingData.code === 'ACCOUNT_PENDING', 'Error code is ACCOUNT_PENDING');
  assert(loginPendingData.status === 'pending', 'Returned status is pending');

  // TEST 3: Check public status API
  console.log('\n[TEST 3] Check registration status API');
  const statusRes = await fetch(`${baseUrl}/api/auth/status?email=testrider@racebox.local`);
  const statusData = await statusRes.json();
  assert(statusRes.status === 200, 'Status endpoint returns HTTP 200');
  assert(statusData.data.status === 'pending', 'Status endpoint returns pending status');

  // TEST 4: Admin Web Login & Approve user
  console.log('\n[TEST 4] Admin approval flow');
  const adminParams = new URLSearchParams({ email: 'admin@racebox.local', password: 'admin123' });
  const adminLoginRes = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: adminParams.toString(),
    redirect: 'manual'
  });
  const adminCookie = adminLoginRes.headers.get('set-cookie');
  assert(!!adminCookie, 'Admin login succeeded and session cookie obtained');

  // Approve testrider
  const approveRes = await fetch(`${baseUrl}/admin/approvals/${dbUser.id}/approve`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie },
    redirect: 'manual'
  });
  assert(approveRes.status === 302, 'Approval request redirects (HTTP 302)');

  // Verify in DB
  const [[dbApprovedUser]] = await db.query("SELECT * FROM users WHERE email = 'testrider@racebox.local'");
  assert(dbApprovedUser.status === 'approved', 'Database user status updated to approved');
  assert(!!dbApprovedUser.approved_at, 'approved_at timestamp is set');
  assert(!!dbApprovedUser.approved_by, 'approved_by admin ID is recorded');

  // Verify audit log
  const [[approvalLog]] = await db.query("SELECT * FROM registration_approval_logs WHERE user_id = ? ORDER BY id DESC LIMIT 1", [dbUser.id]);
  assert(approvalLog && approvalLog.action === 'approved', 'Audit log created with action: approved');

  // TEST 5: Login as approved user -> Must SUCCEED
  console.log('\n[TEST 5] Login as approved user');
  const loginApprovedRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testrider@racebox.local', password: 'password123' })
  });
  const loginApprovedData = await loginApprovedRes.json();
  assert(loginApprovedRes.status === 200, 'Login returns HTTP 200 OK');
  assert(loginApprovedData.success === true, 'Login success is true');
  assert(!!loginApprovedData.data.accessToken, 'Access token is issued');
  const riderToken = loginApprovedData.data.accessToken;

  // TEST 6: Access protected endpoint with valid approved token
  console.log('\n[TEST 6] Access protected API (/api/auth/me) with token');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${riderToken}` }
  });
  const meData = await meRes.json();
  assert(meRes.status === 200, '/api/auth/me returns HTTP 200');
  assert(meData.data.user.email === 'testrider@racebox.local', 'Returned profile matches rider email');

  // TEST 7: Register spammer & Reject flow with reason
  console.log('\n[TEST 7] Register and reject flow');
  const spammerReg = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Spam Account',
      email: 'spammer@racebox.local',
      password: 'password123'
    })
  });
  const spammerData = await spammerReg.json();
  const spammerId = spammerData.data.user.id;

  // Reject spammer via admin
  const rejectParams = new URLSearchParams({ reason: 'Identitas tidak valid dan terdeteksi bot spam.' });
  const rejectRes = await fetch(`${baseUrl}/admin/approvals/${spammerId}/reject`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: rejectParams.toString(),
    redirect: 'manual'
  });
  assert(rejectRes.status === 302, 'Admin rejection redirects (HTTP 302)');

  const [[dbSpammer]] = await db.query("SELECT * FROM users WHERE id = ?", [spammerId]);
  assert(dbSpammer.status === 'rejected', 'Database spammer status is rejected');
  assert(dbSpammer.rejection_reason === 'Identitas tidak valid dan terdeteksi bot spam.', 'Rejection reason is stored');

  // Spammer attempts login -> 403 ACCOUNT_REJECTED
  const spammerLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'spammer@racebox.local', password: 'password123' })
  });
  const spammerLoginData = await spammerLoginRes.json();
  assert(spammerLoginRes.status === 403, 'Rejected user login returns HTTP 403');
  assert(spammerLoginData.code === 'ACCOUNT_REJECTED', 'Error code is ACCOUNT_REJECTED');
  assert(spammerLoginData.rejectionReason.includes('Identitas tidak valid'), 'Rejection reason returned to user');

  // TEST 8: Suspend user & Instant token revocation check
  console.log('\n[TEST 8] Suspend user and token invalidation');
  const suspendParams = new URLSearchParams({ reason: 'Investigasi kecurangan waktu drag.' });
  await fetch(`${baseUrl}/admin/approvals/${dbUser.id}/suspend`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: suspendParams.toString(),
    redirect: 'manual'
  });

  // Rider tries to use previously valid token!
  const suspendedMeRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${riderToken}` }
  });
  assert(suspendedMeRes.status === 403, 'Old JWT token is immediately BLOCKED (HTTP 403) when user is suspended');

  // Reactivate user
  await fetch(`${baseUrl}/admin/approvals/${dbUser.id}/reactivate`, {
    method: 'POST',
    headers: { 'Cookie': adminCookie },
    redirect: 'manual'
  });
  const reactivatedMeRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${riderToken}` }
  });
  assert(reactivatedMeRes.status === 200, 'User token works again after reactivation');

  // TEST 9: Admin Approvals Page Render
  console.log('\n[TEST 9] Render /admin/approvals Web Page');
  const approvalsPageRes = await fetch(`${baseUrl}/admin/approvals`, {
    headers: { 'Cookie': adminCookie }
  });
  const approvalsPageHtml = await approvalsPageRes.text();
  assert(approvalsPageRes.status === 200, '/admin/approvals returns HTTP 200');
  assert(approvalsPageHtml.includes('Persetujuan Pendaftaran Pengguna'), 'Page contains correct title');
  assert(approvalsPageHtml.includes('MENUNGGU VERIFIKASI'), 'Page contains stats cards');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
  else process.exit(0);
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
