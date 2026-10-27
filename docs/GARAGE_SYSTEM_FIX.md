# Perbaikan Sistem Garasi Motor - RaceBox

## Masalah yang Diperbaiki

### 1. **Validasi Pemilik Akun Tidak Valid**
**Masalah:** Route API `/vehicles` POST dan PUT tidak memvalidasi dengan benar apakah user yang mengirim request memiliki session yang valid.

**Solusi:**
- Menambahkan validasi `req.user.sub` di awal setiap request
- Mengembalikan error 401 jika session tidak valid atau expired
- Menambahkan error logging untuk debugging

**File yang diubah:**
- `routes/vehicles.js` - POST dan PUT handler

### 2. **Motor Kadang Tidak Masuk ke Database**
**Masalah:** Ketika pengguna menambahkan motor baru, kadang data tidak tersimpan tanpa ada pesan error yang jelas.

**Solusi:**
- Menambahkan validasi return value dari `M.upsert()`
- Mengembalikan error 500 dengan pesan jelas jika gagal menyimpan
- Menambahkan `console.error()` untuk logging error
- Trim input `name` untuk menghindari whitespace yang tidak valid
- Menambahkan validasi lebih ketat untuk nama motor

**File yang diubah:**
- `routes/vehicles.js` - POST dan PUT handler
- `models/vehicle.js` - (tidak perlu diubah, sudah baik)

### 3. **Monitoring Sulit - Tidak Ada View Per Pemilik**
**Masalah:** Admin sulit memonitor garasi motor karena tidak ada pengelompokan berdasarkan pemilik akun.

**Solusi:**
- Membuat MySQL VIEW `garage_owners_summary` untuk summary per pemilik
- Membuat halaman admin baru `/admin/garage-owners` untuk melihat garasi per pemilik
- Menambahkan filter search dan status di halaman garasi per pemilik
- Menambahkan statistik per pemilik: jumlah motor, setup, sesi, dan top speed
- Membuat tabel `garage_activity_logs` untuk audit trail (opsional)

**File baru:**
- `database/migration-garage-owners.sql` - SQL migration script
- `views/admin/garage-owners.ejs` - Halaman garasi per pemilik
- `database/add-garage-owner-view.sql` - View definition (backup)

**File yang diubah:**
- `routes/admin-web.js` - Menambahkan route `/admin/garage-owners`
- `views/admin/partials/nav.ejs` - Menambahkan menu navigasi baru
- `views/admin/dashboard.ejs` - Menambahkan link ke halaman garasi per pemilik
- `views/admin/vehicles.ejs` - Update judul dan link, tambah badge status user

## Cara Menjalankan Migration

### 1. Jalankan Migration SQL
```bash
# Masuk ke MySQL
mysql -u root -p

# Jalankan migration script
source database/migration-garage-owners.sql
```

Atau menggunakan aplikasi database client:
```sql
-- Copy paste isi file database/migration-garage-owners.sql
-- Jalankan di database 'racebox'
```

### 2. Restart Backend Server
```bash
# Stop server yang sedang berjalan
# Ctrl+C

# Jalankan ulang
npm start
# atau
node app.js
```

### 3. Test Fitur Baru

#### A. Test Garasi Per Pemilik
1. Login ke admin panel: `http://localhost:3000/admin`
2. Klik menu "Garasi / Pemilik" di navbar
3. Lihat daftar pemilik dengan statistik mereka
4. Test filter search dengan nama/email
5. Test filter status (approved/pending/suspended)

#### B. Test Validasi Motor Baru
1. Login ke aplikasi mobile atau gunakan Postman
2. POST `/api/vehicles` dengan data motor baru
3. Verifikasi motor masuk ke database
4. Coba POST tanpa token/session yang valid → harus error 401
5. Coba POST dengan nama kosong → harus error 400

#### C. Test View Semua Motor
1. Klik menu "Semua Motor" di navbar
2. Perhatikan badge status user (✓ approved, ⏳ pending, ⛔ suspended)
3. Klik "Per Pemilik" untuk pindah ke view garasi per pemilik

## Struktur Database Baru

### View: `garage_owners_summary`
Kolom:
- `user_id` - ID pemilik akun
- `owner_name` - Nama pemilik
- `owner_email` - Email pemilik
- `owner_status` - Status akun (approved/pending/suspended)
- `owner_role` - Role user
- `total_vehicles` - Jumlah motor di garasi
- `total_setups` - Jumlah setup yang dibuat
- `total_races` - Jumlah sesi pengujian
- `best_top_speed` - Top speed tertinggi
- `first_vehicle_added` - Tanggal motor pertama ditambahkan
- `last_vehicle_added` - Tanggal motor terakhir ditambahkan
- `last_race_date` - Tanggal sesi terakhir

### Tabel: `garage_activity_logs` (Opsional)
Untuk audit trail aktivitas garasi:
- `id` - Primary key
- `user_id` - ID user yang melakukan aksi
- `vehicle_id` - ID motor (nullable)
- `action` - Jenis aksi (vehicle_added, vehicle_updated, dll)
- `details` - JSON detail tambahan
- `created_at` - Timestamp

## Fitur Tambahan yang Ditambahkan

### 1. Filter & Search di Garasi Per Pemilik
- Search by nama atau email pemilik (real-time)
- Filter by status akun (approved/pending/suspended)
- JavaScript filtering di client-side untuk performa cepat

### 2. Badge Status User
- ✓ (hijau) = Approved
- ⏳ (kuning) = Pending
- ⛔ (merah) = Suspended

### 3. Statistik Per Pemilik
Setiap pemilik menampilkan:
- Jumlah motor di garasi
- Jumlah setup yang dibuat
- Total sesi pengujian
- Top speed terbaik

### 4. Navigasi yang Diperbaiki
- Menu utama: Dashboard, Garasi/Pemilik, Semua Motor, Sesi, Pengguna, Approval
- Breadcrumb yang jelas
- Link switching antara view "per pemilik" dan "semua motor"

## Testing Checklist

- [ ] Migration SQL berhasil dijalankan tanpa error
- [ ] View `garage_owners_summary` bisa diquery
- [ ] Halaman `/admin/garage-owners` bisa diakses
- [ ] Filter search bekerja dengan baik
- [ ] Filter status bekerja dengan baik
- [ ] POST `/api/vehicles` dengan session valid berhasil
- [ ] POST `/api/vehicles` tanpa session valid gagal dengan 401
- [ ] POST `/api/vehicles` dengan nama kosong gagal dengan 400
- [ ] Motor yang ditambahkan muncul di halaman garasi
- [ ] Badge status user muncul dengan benar
- [ ] Navigasi menu baru berfungsi
- [ ] Mobile responsive layout berfungsi

## Troubleshooting

### Error: View 'garage_owners_summary' doesn't exist
**Solusi:** Jalankan migration SQL script lagi
```bash
mysql -u root -p racebox < database/migration-garage-owners.sql
```

### Error: Cannot read property 'sub' of undefined
**Solusi:** User belum login atau session expired. Pastikan middleware auth berjalan dengan baik.

### Motor tidak muncul di garasi per pemilik
**Solusi:** 
1. Cek apakah role user = 'pengguna' (bukan 'admin')
2. Cek apakah motor memiliki user_id yang valid
3. Jalankan query manual:
```sql
SELECT * FROM garage_owners_summary WHERE user_id = 'USER_ID_DISINI';
```

### Halaman error 500 saat akses /admin/garage-owners
**Solusi:**
1. Cek log error di console
2. Pastikan view sudah dibuat
3. Cek connection database
4. Restart backend server

## Kontak & Support

Jika ada masalah atau pertanyaan, silakan:
1. Cek log error di console backend
2. Cek log MySQL query
3. Review kembali migration script
4. Pastikan semua file ter-update dengan benar

---
**Updated:** 2024
**Version:** 2.0 - Garage Owner Management System
