# RaceBox Backend + Admin Web

Backend RaceBox memakai Express + MySQL dengan struktur sederhana **Models + Routes + Views** (tanpa folder controllers).

## Fitur
- REST API untuk auth, kendaraan, setup, race session, telemetry.
- Role hanya `pengguna` dan `admin`.
- Admin API di `/api/admin/*`.
- **Admin Web UI** di `/admin` dengan login admin.
- Dashboard statistik pengguna, kendaraan, sesi race, telemetry.
- Daftar pengguna, kendaraan, sesi race, detail race + telemetry.
- Schema database non-destruktif: tidak ada `DROP TABLE`, `TRUNCATE`, atau reset data.

## Menjalankan

1. Pastikan MySQL XAMPP aktif.
2. Import `database/schema.sql` di phpMyAdmin. Script memakai `CREATE TABLE IF NOT EXISTS`.
3. `cp .env.example .env`, lalu isi kredensial MySQL dan secret.
4. `npm install`
5. `npm run create-admin`
6. `npm run dev`
7. API: `http://localhost:3000/api/health`
8. Admin Web: `http://localhost:3000/admin/login`

### Admin default dari script
Script akan meminta nama, email, dan password saat dijalankan. Password tidak disimpan dalam bentuk plaintext.

### Flutter
- Android emulator: `API_BASE_URL=http://10.0.2.2:3000`
- HP fisik: `API_BASE_URL=http://IP-LAN-PC:3000`
- Flutter tetap memakai Drift/SQLite sebagai cache/offline storage dan dapat sinkron ke API.
