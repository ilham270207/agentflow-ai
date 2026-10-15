const fs = require("fs");
const count = (s, t) => s.split(t).length - 1;
const jobs = [
  ["public/privasi.html",
   "Anda dapat melakukannya melalui pengaturan akun di dalam aplikasi, termasuk menghapus akun beserta seluruh obrolan dan galeri Anda.",
   'Anda dapat menghapus akun beserta seluruh gambar di Pustaka melalui halaman <a href="/hapus-akun.html">Hapus akun</a>. Jika data akun Anda perlu dikoreksi, hapus akun lalu daftar kembali dengan data yang benar.'],
  ["public/syarat.html",
   "menghapus akun melalui pengaturan akun di dalam aplikasi.",
   'menghapus akun melalui halaman <a href="/hapus-akun.html">Hapus akun</a>.']
];
const files = {};
for (const [f, from] of jobs) {
  files[f] = fs.readFileSync(f, "utf8");
  if (files[f].includes("/hapus-akun.html")) { console.log(f + ": sudah terpasang."); continue; }
  if (count(files[f], from) !== 1) { console.error("GAGAL " + f + ": teks tidak cocok. Tidak ada yang diubah."); process.exit(1); }
}
for (const [f, from, to] of jobs) {
  if (files[f].includes("/hapus-akun.html")) continue;
  fs.writeFileSync(f, files[f].replace(from, () => to));
  console.log(f + ": diperbarui.");
}
