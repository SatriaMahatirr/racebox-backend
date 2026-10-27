# Quick Fix Guide - Sistem Garasi Motor

## 🔧 Yang Sudah Diperbaiki

### ✅ Validasi Pemilik Akun
- Request tanpa session valid → Error 401
- Nama motor kosong → Error 400
- Error logging untuk debugging

### ✅ Motor Tidak Masuk Database
- Validasi return value upsert
- Error 500 jika gagal save
- Trim whitespace pada input
- Console logging untuk tracking

### ✅ Monitoring Per Pemilik
- View `garage_owners_summary` di MySQL
- Halaman admin `/admin/garage-owners`
- Filter search by nama/email
- Filter by status (approved/pending/suspended)
- Statistik per pemilik: motor, setup, sesi, top speed

### ✅ Audit Trail
- Tabel `garage_activity_logs`
- Log setiap add/update/delete
- Halaman admin `/admin/garage-logs`
- Statistik aktivitas

## 🚀 Cara Install

### 1. Jalankan Migration
```bash
mysql -u root -p racebox < database/migration-garage-owners.sql
```

### 2. Restart Server
```bash
npm start
```

### 3. Test
- Login admin: http://localhost:3000/admin
- Menu "Garasi / Pemilik"
- Test filter & search
- Test tambah motor baru dari mobile app

## 📁 File yang Diubah

### Backend
- ✏️ `routes/vehicles.js` - Validasi & logging
- ✏️ `routes/admin-web.js` - Route baru
- ✏️ `models/garage-log.js` - NEW
- ✏️ `database/migration-garage-owners.sql` - NEW

### Views
- ✏️ `views/admin/garage-owners.ejs` - NEW
- ✏️ `views/admin/garage-logs.ejs` - NEW
- ✏️ `views/admin/vehicles.ejs` - Update
- ✏️ `views/admin/dashboard.ejs` - Update
- ✏️ `views/admin/partials/nav.ejs` - Update

## 📊 Fitur Baru

1. **Garasi Per Pemilik** (`/admin/garage-owners`)
   - Grouping by owner
   - Stats: motor, setup, sesi, top speed
   - Filter & search real-time

2. **Log Aktivitas** (`/admin/garage-logs`)
   - History add/update/delete
   - Stats aktivitas
   - Audit trail lengkap

3. **Badge Status User**
   - ✓ Approved (hijau)
   - ⏳ Pending (kuning)
   - ⛔ Suspended (merah)

## 🐛 Troubleshooting

**View not found?**
```bash
mysql -u root -p racebox < database/migration-garage-owners.sql
```

**Error 401 saat POST vehicle?**
- Check JWT token
- Check session middleware
- Login ulang

**Motor tidak muncul?**
- Check role user = 'pengguna'
- Check user_id valid
- Check log console

## 📞 Support

Baca dokumentasi lengkap: `docs/GARAGE_SYSTEM_FIX.md`
