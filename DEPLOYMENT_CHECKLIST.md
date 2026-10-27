# Deployment Checklist - Perbaikan Sistem Garasi

## Pre-Deployment

### 1. Backup Database
```bash
mysqldump -u root -p racebox > backup_racebox_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Stop Running Server
```bash
# Ctrl+C pada terminal yang menjalankan server
# Atau
pm2 stop racebox  # Jika menggunakan PM2
```

## Deployment Steps

### 3. Jalankan Migration SQL
```bash
# Option A: Via command line
mysql -u root -p racebox < database/migration-garage-owners.sql

# Option B: Via MySQL Workbench / phpMyAdmin
# - Buka file database/migration-garage-owners.sql
# - Copy paste dan execute di database racebox
```

### 4. Verifikasi Migration
```sql
-- Login ke MySQL
mysql -u root -p racebox

-- Check view
SELECT COUNT(*) FROM garage_owners_summary;

-- Check table
SHOW TABLES LIKE 'garage_activity_logs';

-- Check indexes
SHOW INDEX FROM vehicles;
```

Expected results:
- View `garage_owners_summary` exists
- Table `garage_activity_logs` exists
- Indexes on vehicles table complete

### 5. Update Code
All files already updated:
- ✅ routes/vehicles.js
- ✅ routes/admin-web.js
- ✅ models/garage-log.js
- ✅ views/admin/garage-owners.ejs
- ✅ views/admin/garage-logs.ejs
- ✅ views/admin/vehicles.ejs
- ✅ views/admin/dashboard.ejs
- ✅ views/admin/partials/nav.ejs

### 6. Test Node.js Syntax
```bash
node -c routes/vehicles.js
node -c routes/admin-web.js
node -c models/garage-log.js
```

All should return no errors.

### 7. Start Server
```bash
# Development
npm start

# Production with PM2
pm2 restart racebox
pm2 logs racebox  # Monitor logs
```

## Post-Deployment Testing

### 8. Test Admin Panel

#### A. Test Garasi Per Pemilik
- [ ] Login admin: http://localhost:3000/admin
- [ ] Klik "Garasi / Pemilik" di navbar
- [ ] Verifikasi data owner muncul
- [ ] Test search by nama
- [ ] Test search by email
- [ ] Test filter status (approved/pending/suspended)
- [ ] Klik expand owner untuk lihat detail motor

#### B. Test Semua Motor
- [ ] Klik "Semua Motor" di navbar
- [ ] Verifikasi badge status user muncul
- [ ] Link "Per Pemilik" berfungsi

#### C. Test Log Aktivitas
- [ ] Klik menu drawer → "Log Aktivitas Garasi"
- [ ] Verifikasi statistik muncul
- [ ] Verifikasi log table muncul

### 9. Test API Endpoints

#### A. Test POST Vehicle (Valid)
```bash
# Dapatkan token dari login
TOKEN="your_jwt_token_here"

curl -X POST http://localhost:3000/api/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Motor Deployment",
    "type": "Sport",
    "customCc": 150,
    "weightKg": 130
  }'
```

Expected: Status 201, motor tersimpan

#### B. Test POST Vehicle (Invalid - No Token)
```bash
curl -X POST http://localhost:3000/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Motor"}'
```

Expected: Status 401

#### C. Test POST Vehicle (Invalid - Empty Name)
```bash
curl -X POST http://localhost:3000/api/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": ""}'
```

Expected: Status 400

### 10. Test Mobile App
- [ ] Login dari mobile app
- [ ] Buka menu Garasi
- [ ] Tambah motor baru
- [ ] Verifikasi muncul di admin panel
- [ ] Verifikasi log aktivitas tercatat

### 11. Test Logging
```bash
# Monitor server logs
tail -f logs/app.log  # atau sesuai logging config

# Atau jika menggunakan PM2
pm2 logs racebox
```

Perhatikan:
- [ ] No error saat POST vehicle
- [ ] Activity log tercatat
- [ ] No database connection errors

## Rollback Plan (If Needed)

### If Migration Failed
```bash
# Restore dari backup
mysql -u root -p racebox < backup_racebox_YYYYMMDD_HHMMSS.sql

# Drop view dan table jika perlu
mysql -u root -p racebox -e "DROP VIEW IF EXISTS garage_owners_summary;"
mysql -u root -p racebox -e "DROP TABLE IF EXISTS garage_activity_logs;"
```

### If Code Failed
```bash
# Revert via git
git checkout HEAD -- routes/vehicles.js
git checkout HEAD -- routes/admin-web.js
# ... etc

# Restart server
npm start
```

## Monitoring Checklist

### First 24 Hours
- [ ] Monitor error logs
- [ ] Check activity log table growth
- [ ] Check user feedback
- [ ] Monitor database performance
- [ ] Check API response times

### First Week
- [ ] Review log aktivitas
- [ ] Check filter performance
- [ ] Gather admin feedback
- [ ] Check mobile app stability
- [ ] Review database query performance

## Performance Notes

### Database Queries
- View `garage_owners_summary` uses LEFT JOIN - optimal for small-medium datasets
- Indexes added on vehicles(user_id, created_at) for performance
- Activity logs limited to 200 most recent by default

### Potential Optimizations
If performance issues:
1. Add Redis cache for owner summary
2. Paginate activity logs
3. Add composite indexes if needed
4. Consider materialized view for large datasets

## Contact & Issues

If issues occur:
1. Check server logs: `pm2 logs racebox`
2. Check MySQL error log: `/var/log/mysql/error.log`
3. Review migration script: `database/migration-garage-owners.sql`
4. Check documentation: `docs/GARAGE_SYSTEM_FIX.md`

## Success Criteria

✅ All tests passing
✅ No errors in logs
✅ Users can add vehicles
✅ Admin can see garage per owner
✅ Activity logs recording correctly
✅ Filters working properly
✅ Mobile app stable

---

**Deployed by:** _________________
**Date:** _________________
**Environment:** [ ] Development  [ ] Staging  [ ] Production
**Backup file:** _________________
