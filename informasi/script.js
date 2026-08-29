// Pastikan URL ini persis sama dengan GAS_URL yang ada di file script.js Anda!



function showLoading(show) {
    document.getElementById('loadingScreen').style.display = show ? 'flex' : 'none';
}

// Deklarasi variabel global untuk menyimpan data di memori
let GLOBAL_DATA_SANTRI = [];
let JADWAL_MAPEL = {};

// 1. Panggil data saat halaman pertama kali dibuka
document.addEventListener("DOMContentLoaded", () => {
    rotasiKutipan();
    setInterval(rotasiKutipan, 12000);
    muatDataAwalAdmin(); // <-- Fungsi baru ditambahkan di sini
});

// 2. Fungsi untuk memuat data santri dan mapel di latar belakang
function muatDataAwalAdmin() {
    showLoading(true);
    const fdSantri = new URLSearchParams(); fdSantri.append('action', 'getSantri');
    const fdMapel = new URLSearchParams(); fdMapel.append('action', 'getAllMapel');

    Promise.all([
        gasFetch({ method: 'POST', body: fdSantri }).then(r => r.json()),
        gasFetch({ method: 'POST', body: fdMapel }).then(r => r.json())
    ])
    .then(([responseSantri, responseMapel]) => {
        showLoading(false);
        if (responseMapel.status === 'success') JADWAL_MAPEL = responseMapel.data;
        if (responseSantri.status === 'success') {
            GLOBAL_DATA_SANTRI = responseSantri.data;
            buatDropdownKelas(); // Buat daftar kelas
        } else {
            Swal.fire('Error', 'Gagal memuat data santri.', 'error');
        }
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Koneksi Gagal', 'Gagal terhubung ke database cloud.', 'error');
    });
}

// 3. Fungsi membuat daftar kelas unik
// 3. Fungsi membuat daftar kelas unik dengan pembatas dan filter alumni
function buatDropdownKelas() {
    const selKelas = document.getElementById('pilihKelasAdmin');
    selKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';

    // 1. Ekstrak kelas unik dan BUANG kelas Alumni / Lulus / DO
    const kelasUnik = [...new Set(GLOBAL_DATA_SANTRI.map(s => s.kelas))]
        .filter(k => {
            if (!k) return false;
            const kLower = String(k).toLowerCase();
            return !kLower.includes('lulus') && !kLower.includes('alumni') && !kLower.includes('diberhentikan');
        })
        .sort();

    // 2. Siapkan wadah untuk mengelompokkan berdasarkan tingkatan
    let kelompokKelas = {};
    let bobotJenjang = { "TK / RA": 1, "IBTIDAIYAH": 2, "SANAWIYAH": 3, "ALIYAH": 4 };

    // 3. Masukkan kelas ke kelompoknya masing-masing
    kelasUnik.forEach(k => {
        let strK = String(k).trim();
        let kUpper = strK.toUpperCase();
        let kategori = "LAINNYA";

        if (kUpper.includes('TK') || kUpper.includes('RA')) kategori = "TK / RA";
        else if (kUpper.includes('IBT') || kUpper.includes('IBTIDAIYAH')) kategori = "IBTIDAIYAH";
        else if (kUpper.includes('SANA') || kUpper.includes('SANAWIYAH') || kUpper.includes('MTS')) kategori = "SANAWIYAH";
        else if (kUpper.includes('ALIYAH') || kUpper.includes('MA')) kategori = "ALIYAH";
        else kategori = strK.split(/[\s-]+/)[0].toUpperCase();

        if (!kelompokKelas[kategori]) kelompokKelas[kategori] = [];
        kelompokKelas[kategori].push(strK);
    });

    // 4. Urutkan kategori dan masukkan ke dropdown menggunakan <optgroup> (Pembatas)
    let kategoriUrut = Object.keys(kelompokKelas).sort((a, b) => (bobotJenjang[a] || 99) - (bobotJenjang[b] || 99));

    kategoriUrut.forEach(kategori => {
        // Membuat pembatas yang tidak bisa diklik
        let optgroup = document.createElement('optgroup');
        optgroup.label = `━━━ TINGKAT ${kategori} ━━━`; 

        kelompokKelas[kategori].forEach(kelas => {
            let option = document.createElement('option');
            option.value = kelas;
            option.text = kelas;
            optgroup.appendChild(option);
        });

        selKelas.appendChild(optgroup);
    });
}

// 4. Fungsi memunculkan nama santri saat kelas dipilih
function isiDropdownSantri() {
    const kelasTerpilih = document.getElementById('pilihKelasAdmin').value;
    const selSantri = document.getElementById('pilihSantriAdmin');
    
    if (!kelasTerpilih) {
        selSantri.innerHTML = '<option value="">-- Pilih Kelas Dahulu --</option>';
        selSantri.disabled = true;
        return;
    }

    // Filter santri berdasarkan kelas, lalu urutkan sesuai abjad
    const santriKelas = GLOBAL_DATA_SANTRI.filter(s => s.kelas === kelasTerpilih).sort((a,b) => a.nama.localeCompare(b.nama));
    
    selSantri.innerHTML = '<option value="">-- Pilih Nama Santri --</option>';
    santriKelas.forEach(s => {
        selSantri.innerHTML += `<option value="${s.nis}">${s.nama} (${s.nis})</option>`;
    });
    selSantri.disabled = false; // Aktifkan dropdown santri
}

// 5. Fungsi Utama saat tombol diclik (Sangat Cepat karena data sudah di RAM)
function tarikDataDariDatabase() {
    const inputNis = document.getElementById('pilihSantriAdmin').value;
    const containerHasil = document.getElementById('hasilDataOrtu');

    if (!inputNis) {
        return Swal.fire('Perhatian', 'Silakan pilih Nama Santri terlebih dahulu.', 'warning');
    }

    showLoading(true);

    // Langsung cari santri dari memori, tidak perlu fetch lagi
    const santriTerpilih = GLOBAL_DATA_SANTRI.find(s => s.nis.toString() === inputNis.toString());

    // Pasang Identitas
    document.getElementById('ortuNamaSantri').innerText = santriTerpilih.nama;
    document.getElementById('ortuNisSantri').innerText = santriTerpilih.nis;
    document.getElementById('ortuKelasSantri').innerText = santriTerpilih.kelas;
    
    document.getElementById('ortuJkSantri').innerText = santriTerpilih.jk ? santriTerpilih.jk : '-';
    let namaAyah = santriTerpilih.ayah ? santriTerpilih.ayah : '-';
    let namaIbu = santriTerpilih.ibu ? santriTerpilih.ibu : '-';
    document.getElementById('ortuNamaOrtu').innerText = namaAyah + " & " + namaIbu;
    document.getElementById('ortuAlamatSantri').innerText = santriTerpilih.alamat ? santriTerpilih.alamat : '-';

    // Panggil fungsi riwayat SPP
    muatRiwayatSpp(santriTerpilih.nis);

    // Hanya perlu menarik Data Nilai & Pengaturan (karena sering berubah)
    const fdNilai = new URLSearchParams();
    fdNilai.append('action', 'getDataNilai');
    fdNilai.append('kelas', santriTerpilih.kelas);

    const fdPengaturan = new URLSearchParams();
    fdPengaturan.append('action', 'getPengaturan');
    fdPengaturan.append('kelas', santriTerpilih.kelas);

    Promise.all([
        gasFetch({ method: 'POST', body: fdNilai }).then(r => r.json()),
        gasFetch({ method: 'POST', body: fdPengaturan }).then(r => r.json())
    ])
    .then(([responseNilai, responsePengaturan]) => {
        showLoading(false);
        if (responseNilai.status !== 'success') {
            return Swal.fire('Informasi', 'Nilai akademik kelas ini belum di-input guru.', 'info');
        }

        let statusRilis = 'Sembunyi';
        let detailRapor = {}; 

        if (responsePengaturan.status === 'success') {
            if (responsePengaturan.umum && responsePengaturan.umum.status_rilis) {
                statusRilis = responsePengaturan.umum.status_rilis;
            }
            if (responsePengaturan.detail) {
                detailRapor = responsePengaturan.detail;
            }
        }

        // Lanjut ke proses render tabel
        prosesDanTampilkanData(inputNis, santriTerpilih.kelas, responseNilai.headers, responseNilai.data, statusRilis, detailRapor);
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Koneksi Gagal', 'Gagal memuat nilai dari server.', 'error');
    });
}

function eksekusiTarikData(inputNis, inputTgl, isAdminBypass) {
    showLoading(true);
    const containerHasil = document.getElementById('hasilDataOrtu');

    let ejaanTglLahir = "";
    if (!isAdminBypass) {
        // Hanya konversi tanggal jika bukan mode admin
        const objekTanggal = new Date(inputTgl);
        const opsiFormat = { day: 'numeric', month: 'long', year: 'numeric' };
        ejaanTglLahir = objekTanggal.toLocaleDateString('id-ID', opsiFormat).toLowerCase();
    }

    // Siapkan 2 penarik data secara bersamaan (Data Santri & Data Master Mapel)
    const fdSantri = new URLSearchParams(); fdSantri.append('action', 'getSantri');
    const fdMapel = new URLSearchParams(); fdMapel.append('action', 'getAllMapel');

    Promise.all([
        gasFetch({ method: 'POST', body: fdSantri }).then(r => r.json()),
        gasFetch({ method: 'POST', body: fdMapel }).then(r => r.json())
    ])
    .then(([responseSantri, responseMapel]) => {
        if (responseMapel.status === 'success') JADWAL_MAPEL = responseMapel.data;
        if (responseSantri.status !== 'success') throw new Error("Gagal mengambil master data.");

        // PENCARIAN SANTRI DENGAN LOGIKA BYPASS
        const santriTerpilih = responseSantri.data.find(s => {
            const matchNis = s.nis.toString() === inputNis.toString();
            if (isAdminBypass) {
                return matchNis; // Mode Admin: Cukup NIS yang cocok
            } else {
                return matchNis && s.ttl.toLowerCase().includes(ejaanTglLahir); // Mode Ortu: NIS + TTL
            }
        });

        if (!santriTerpilih) {
            showLoading(false);
            containerHasil.classList.add('hidden');
            return Swal.fire('Data Tidak Ditemukan', isAdminBypass ? 'NIS tidak terdaftar di sistem.' : 'Nomor NIS atau Tanggal Lahir santri salah.', 'error');
        }

        // Pasang Identitas
        document.getElementById('ortuNamaSantri').innerText = santriTerpilih.nama;
        document.getElementById('ortuNisSantri').innerText = santriTerpilih.nis;
        document.getElementById('ortuKelasSantri').innerText = santriTerpilih.kelas;
        
        document.getElementById('ortuJkSantri').innerText = santriTerpilih.jk ? santriTerpilih.jk : '-';
        let namaAyah = santriTerpilih.ayah ? santriTerpilih.ayah : '-';
        let namaIbu = santriTerpilih.ibu ? santriTerpilih.ibu : '-';
        document.getElementById('ortuNamaOrtu').innerText = namaAyah + " & " + namaIbu;
        document.getElementById('ortuAlamatSantri').innerText = santriTerpilih.alamat ? santriTerpilih.alamat : '-';

        // Panggil fungsi riwayat SPP
        muatRiwayatSpp(santriTerpilih.nis);

        // Tarik Data Nilai & Pengaturan
        const fdNilai = new URLSearchParams();
        fdNilai.append('action', 'getDataNilai');
        fdNilai.append('kelas', santriTerpilih.kelas);

        const fdPengaturan = new URLSearchParams();
        fdPengaturan.append('action', 'getPengaturan');
        fdPengaturan.append('kelas', santriTerpilih.kelas);

        return Promise.all([
            gasFetch({ method: 'POST', body: fdNilai }).then(r => r.json()),
            gasFetch({ method: 'POST', body: fdPengaturan }).then(r => r.json())
        ])
        .then(([responseNilai, responsePengaturan]) => {
            showLoading(false);
            if (responseNilai.status !== 'success') {
                return Swal.fire('Informasi', 'Data identitas benar, namun nilai kelas belum di-input guru.', 'info');
            }

            let statusRilis = 'Sembunyi';
            let detailRapor = {}; 

            if (responsePengaturan.status === 'success') {
                if (responsePengaturan.umum && responsePengaturan.umum.status_rilis) {
                    statusRilis = responsePengaturan.umum.status_rilis;
                }
                if (responsePengaturan.detail) {
                    detailRapor = responsePengaturan.detail;
                }
            }

            prosesDanTampilkanData(inputNis, santriTerpilih.kelas, responseNilai.headers, responseNilai.data, statusRilis, detailRapor);
        });
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Koneksi Gagal', 'Gagal memuat informasi database dari server cloud.', 'error');
        console.error(err);
    });
}

function prosesDanTampilkanData(nis, kelas, headers, rows, statusRilis, detailRapor) {
    const containerHasil = document.getElementById('hasilDataOrtu');
    const tbodyNilai = document.getElementById('bodyTabelNilaiOrtu');
    tbodyNilai.innerHTML = '';

    // PERBAIKAN: Mencegah error jika Guru belum membuat database nilai sama sekali
    let barisSantri = undefined;
    if (headers && headers.length > 0) {
        const idxNis = headers.findIndex(h => h && h.toString().toUpperCase().includes('NIS'));
        if (idxNis > -1) {
            barisSantri = rows.find(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());
        }
    }

    if (!barisSantri) {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nilai akademik semester ini belum dirilis guru kelas.</td></tr>';
        document.getElementById('ortuSakit').innerText = '0';
        document.getElementById('ortuIzin').innerText = '0';
        document.getElementById('ortuAlpa').innerText = '0';
        containerHasil.classList.remove('hidden');
        return;
    }

    let dataMap = {};
    headers.forEach((h, i) => { dataMap[h.toLowerCase()] = barisSantri[i]; });

    // SET ABSENSI
    // ==============================================================
    // SET KEPRIBADIAN & ABSENSI BARU DARI MENU PENGATURAN
    // ==============================================================
    
    // Ambil data detail santri spesifik berdasarkan NIS
    let detSantri = { akhlaq: '-', kerajinan: '-', disiplin: '-', rapi: '-', sakit: '0', izin: '0', alpa: '0', catatan: '-', keputusan: '-' };
    if (detailRapor && detailRapor[nis]) {
        detSantri = detailRapor[nis];
    }

    // Tampilkan data Absensi
    document.getElementById('ortuSakit').innerText = detSantri.sakit || '0';
    document.getElementById('ortuIzin').innerText = detSantri.izin || '0';
    document.getElementById('ortuAlpa').innerText = detSantri.alpa || '0';

    // Tampilkan data Kepribadian & Catatan Wali Kelas
    // Tampilkan data Kepribadian & Catatan Wali Kelas
    let elAkhlaq = document.getElementById('ortuAkhlaq');
    if (elAkhlaq) { 
        elAkhlaq.innerText = (detSantri.akhlaq || '-').toString().toUpperCase();
        document.getElementById('ortuRajin').innerText = (detSantri.kerajinan || '-').toString().toUpperCase();
        document.getElementById('ortuDisiplin').innerText = (detSantri.disiplin || '-').toString().toUpperCase();
        document.getElementById('ortuRapi').innerText = (detSantri.rapi || '-').toString().toUpperCase();
        
        // Ubah juga Keputusan Akhir agar kapital semua
        document.getElementById('ortuKeputusan').innerText = (detSantri.keputusan || '-').toString().toUpperCase();
        
       // Catatan Wali Kelas sesuai aslinya
        let teksCatatan = detSantri.catatan ? detSantri.catatan.toString() : "-";
        document.getElementById('ortuCatatan').innerText = teksCatatan;
    }
    // ==============================================================

    // CEK STATUS RILIS NILAI
    if (statusRilis === 'Sembunyi') {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-gray-500"><i class="fas fa-lock text-4xl mb-3 block text-gray-300"></i>Nilai akademik semester ini belum dirilis oleh madrasah.<br><span class="text-xs">Silakan cek kembali secara berkala.</span></td></tr>';
        containerHasil.classList.remove('hidden');
        return; // Hentikan proses merender angka nilai
    }

  // ==========================================
    // LOGIKA RENDER NILAI DENGAN KATEGORI A B C
    // ==========================================
    let adaNilai = false;
    const dataMapel = JADWAL_MAPEL[kelas] || { tulis: [], praktek: [], baca: [] };

    // Fungsi kecil pembantu untuk merender 1 baris mapel (ditambah parameter nomor)
    function getBarisHTML(mapel, isGrouped, nomor = '') {
        const skor = dataMap[mapel.toLowerCase()] || '-';
        let kategori = '-';

        if (skor !== '-') {
            const numSkor = parseFloat(skor);
            if (numSkor >= 85) kategori = '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-xs font-bold">A</span>';
            else if (numSkor >= 75) kategori = '<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold">B</span>';
            else if (numSkor >= 65) kategori = '<span class="bg-orange-100 text-orange-700 px-2.5 py-1 rounded text-xs font-bold">C</span>';
            else kategori = '<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">D</span>';
        }

        let prefix = isGrouped ? `<span class="text-gray-500 mr-2 font-bold inline-block w-4 text-right">${nomor}.</span>` : '';
        let padding = isGrouped ? 'pl-4' : '';

        // Penambahan class 'whitespace-nowrap' pada elemen <td> pertama
        return `
            <tr class="hover:bg-gray-50/80 transition-all">
                <td class="p-3 font-semibold text-gray-700 uppercase text-xs ${padding} whitespace-nowrap">${prefix}${mapel}</td>
                <td class="p-3 text-center font-black text-base ${parseFloat(skor) < 75 ? 'text-red-500' : 'text-emerald-600'}">${skor}</td>
                <td class="p-3 text-center">${kategori}</td>
            </tr>
        `;
    }

    // Cek apakah ini kelas Ibtidaiyah/Sanawiyah yang mapelnya sudah dikategorikan di Pengaturan
    if (!kelas.includes('TK') && (dataMapel.tulis.length > 0 || dataMapel.praktek.length > 0 || dataMapel.baca.length > 0)) {
        
        // KATEGORI A: TERTULIS (Ditambah whitespace-nowrap)
        if (dataMapel.tulis && dataMapel.tulis.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-emerald-50/50"><td colspan="3" class="p-2.5 font-bold text-emerald-800 text-xs border-y border-emerald-100 whitespace-nowrap"><i class="fas fa-pen-alt mr-2 text-emerald-600"></i>A. UJIAN TERTULIS</td></tr>`;
            dataMapel.tulis.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }
        
        // KATEGORI B: PRAKTEK (Ditambah whitespace-nowrap)
        if (dataMapel.praktek && dataMapel.praktek.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-blue-50/50"><td colspan="3" class="p-2.5 font-bold text-blue-800 text-xs border-y border-blue-100 whitespace-nowrap"><i class="fas fa-praying-hands mr-2 text-blue-600"></i>B. UJIAN PRAKTEK</td></tr>`;
            dataMapel.praktek.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }
        
        // KATEGORI C: MEMBACA (Ditambah whitespace-nowrap)
        if (dataMapel.baca && dataMapel.baca.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-purple-50/50"><td colspan="3" class="p-2.5 font-bold text-purple-800 text-xs border-y border-purple-100 whitespace-nowrap"><i class="fas fa-book-open mr-2 text-purple-600"></i>C. UJIAN MEMBACA</td></tr>`;
            dataMapel.baca.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }

   } else {
        // Mode Khusus (Untuk TK) - Agregasi Semua Hari/Baris
        let subjekTK = [];
        let grandTotal = 0;
        let mapelCount = 0;

        const idxNis = headers.findIndex(h => h && h.toString().toUpperCase().includes('NIS'));
        const idxM1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 1' || h.toString().toLowerCase() === 'm1'));
        const idxN1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 1' || h.toString().toLowerCase() === 'n1'));
        const idxM2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 2' || h.toString().toLowerCase() === 'm2'));
        const idxN2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 2' || h.toString().toLowerCase() === 'n2'));
        const idxM3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 3' || h.toString().toLowerCase() === 'm3'));
        const idxN3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 3' || h.toString().toLowerCase() === 'n3'));

        // 1. Tarik SEMUA baris milik anak ini (Bukan cuma baris pertama)
        const semuaBarisSantriTK = rows.filter(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());

        // 2. Kumpulkan semua mata pelajaran dari berbagai hari
        semuaBarisSantriTK.forEach(row => {
            const extractData = (iM, iN) => {
                if (iM > -1 && iN > -1) {
                    let mapel = row[iM];
                    let nilai = row[iN];
                    if (mapel && mapel !== '-' && mapel.toString().trim() !== '') {
                        subjekTK.push({ namaMapel: mapel, skor: nilai });
                        let num = parseFloat(nilai);
                        if (!isNaN(num)) {
                            grandTotal += num;
                            mapelCount++;
                        }
                    }
                }
            };
            extractData(idxM1, idxN1);
            extractData(idxM2, idxN2);
            extractData(idxM3, idxN3);
        });

        // 3. Cetak ke tabel HTML Portal Ortu
        let noUrutTK = 1;
        subjekTK.forEach(item => {
            let kategori = '-';
            let warnaTeksAngka = 'text-gray-500';
            
            if (item.skor && item.skor !== '-') {
                const numSkor = parseFloat(item.skor);
                if (!isNaN(numSkor)) {
                    if (numSkor >= 90) kategori = '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-xs font-bold">A</span>';
                    else if (numSkor >= 80) kategori = '<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold">B</span>';
                    else if (numSkor >= 70) kategori = '<span class="bg-orange-100 text-orange-700 px-2.5 py-1 rounded text-xs font-bold">C</span>';
                    else kategori = '<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">D</span>';
                    warnaTeksAngka = numSkor < 75 ? 'text-red-500' : 'text-emerald-600';
                }
            }

            tbodyNilai.innerHTML += `
                <tr class="hover:bg-gray-50/80 transition-all">
                    <td class="p-3 font-semibold text-gray-700 uppercase text-xs pl-4 whitespace-nowrap">
                        <span class="text-gray-500 mr-2 font-bold inline-block w-4 text-right">${noUrutTK}.</span>${item.namaMapel}
                    </td>
                    <td class="p-3 text-center font-black text-base ${warnaTeksAngka}">${item.skor || '-'}</td>
                    <td class="p-3 text-center">${kategori}</td>
                </tr>
            `;
            noUrutTK++;
            adaNilai = true;
        });

        // 4. Paksa perhitungan Total dan Rata-Rata TK menggunakan angka gabungan
        setTimeout(() => {
            document.getElementById('ortuTotalNilai').innerText = grandTotal;
            document.getElementById('ortuRataRata').innerText = mapelCount > 0 ? (grandTotal / mapelCount).toFixed(1) : "0.0";
        }, 50);
    }

    if (!adaNilai) {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada komponen mapel terinput.</td></tr>';
        document.getElementById('footerTabelNilaiOrtu').classList.add('hidden');
    } else {
        // ==========================================
        // LOGIKA TAMPILKAN TOTAL, RATA-RATA & RANKING
        // ==========================================
        const footerTabel = document.getElementById('footerTabelNilaiOrtu');
        if(footerTabel) footerTabel.classList.remove('hidden');

      // 1. Ambil Total dan Hitung Ulang Rata-rata (Anti-Bug Tanggal)
        let stringTotal = dataMap['total nilai'] || dataMap['total'] || '-';
        let numTotal = parseFloat(stringTotal);
        
        document.getElementById('ortuTotalNilai').innerText = stringTotal;
        
        let rataBenar = '-';
        if (stringTotal !== '-' && !isNaN(numTotal)) {
            if (!kelas.includes('TK')) {
                let jmlMapel = (JADWAL_MAPEL[kelas] && JADWAL_MAPEL[kelas].semua) ? JADWAL_MAPEL[kelas].semua.length : 0;
                if (jmlMapel > 0) {
                    rataBenar = (numTotal / jmlMapel).toFixed(1);
                } else {
                    // Tarik dari database jika mapel kosong
                    let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                    rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
                }
            } else {
                // Khusus TK
                let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
            }
        }
        document.getElementById('ortuRataRata').innerText = rataBenar;

       // 2. Hitung Peringkat Kelas secara dinamis (Perbaikan Deduplikasi & TK)
        const idxTotal = headers.findIndex(h => h.toString().toLowerCase() === 'total nilai' || h.toString().toLowerCase() === 'total');
        const idxNis = headers.findIndex(h => h.toString().toLowerCase() === 'nis');
        
        let rank = '-';
        let jmlSantri = 0;
        
        if (idxNis > -1) {
            let rekapNilai = new Map();

            if (kelas.includes('TK')) {
                const idxN1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 1' || h.toString().toLowerCase() === 'n1'));
                const idxN2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 2' || h.toString().toLowerCase() === 'n2'));
                const idxN3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 3' || h.toString().toLowerCase() === 'n3'));

                rows.forEach(r => {
                    let nisSiswa = r[idxNis] ? r[idxNis].toString().replace(/'/g, "").trim() : null;
                    if (!nisSiswa) return;
                    
                    let totalBaris = 0;
                    [idxN1, idxN2, idxN3].forEach(idx => {
                        if (idx > -1 && r[idx] && r[idx] !== '-' && !isNaN(parseFloat(r[idx]))) {
                            totalBaris += parseFloat(r[idx]);
                        }
                    });

                    if (rekapNilai.has(nisSiswa)) {
                        rekapNilai.set(nisSiswa, rekapNilai.get(nisSiswa) + totalBaris);
                    } else {
                        rekapNilai.set(nisSiswa, totalBaris);
                    }
                });
            } else if (idxTotal > -1) {
                rows.forEach(r => {
                    let nisSiswa = r[idxNis] ? r[idxNis].toString().replace(/'/g, "").trim() : null;
                    if (nisSiswa && r[idxTotal] !== "" && !isNaN(parseFloat(r[idxTotal]))) {
                        if (!rekapNilai.has(nisSiswa)) {
                            rekapNilai.set(nisSiswa, parseFloat(r[idxTotal]));
                        }
                    }
                });
            }

            let santriDinilai = Array.from(rekapNilai, ([nisSiswa, total]) => ({ nis: nisSiswa, total: total }));
                
            // 1. Urutkan berdasarkan total nilai terbesar
            santriDinilai.sort((a, b) => b.total - a.total);
            jmlSantri = santriDinilai.length; 
            
            // 2. Terapkan Logika Ranking Kembar (Tied Ranks)
            let rankAktual = 1;
            for (let k = 0; k < santriDinilai.length; k++) {
                if (k > 0 && santriDinilai[k].total === santriDinilai[k-1].total) {
                    santriDinilai[k].rank = rankAktual; // Ranking sama jika nilai sama
                } else {
                    rankAktual = k + 1; // Lompat ke ranking semestinya
                    santriDinilai[k].rank = rankAktual;
                }
            }
            
            // 3. Cari ranking untuk santri yang sedang dicek oleh Orang Tua
            let santriIni = santriDinilai.find(s => s.nis === nis.toString().trim());
            if (santriIni) {
                rank = santriIni.rank;
            }
        }
        
        document.getElementById('ortuRanking').innerText = rank;
        document.getElementById('ortuJumlahSantri').innerText = jmlSantri;
    }

    containerHasil.classList.remove('hidden');
}

// FORMAT RUPIAH KHUSUS PORTAL ORTU
function formatRp(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

// ==========================================
// FUNGSI TARIK DATA RIWAYAT SPP KHUSUS ORTU
// ==========================================
function muatRiwayatSpp(nisSantri) {
    const wadah = document.getElementById('wadahSppOrtu');
    const elTagihan = document.getElementById('ortuTagihanSpp');
    const elSisa = document.getElementById('ortuSisaSpp');
    
    wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-4"><i class="fas fa-spinner fa-spin mr-1"></i> Memuat data...</div>';
    if (elTagihan) elTagihan.innerText = '-';
    if (elSisa) elSisa.innerText = '-';
    
    const fdSpp = new URLSearchParams();
    fdSpp.append('action', 'getSppSantri');
    fdSpp.append('nis', nisSantri);

    const fdSetting = new URLSearchParams();
    fdSetting.append('action', 'getSettingSpp');

    // Tarik data Riwayat Anak dan Pengaturan Harga Madrasah secara bersamaan
    Promise.all([
        gasFetch( { method: 'POST', body: fdSpp }).then(r => r.json()),
        gasFetch( { method: 'POST', body: fdSetting }).then(r => r.json())
    ])
    .then(([resSpp, resSetting]) => {
        wadah.innerHTML = ''; 
        
        // Kalkulasi Tagihan Berdasarkan Setting Master
        let totalTagihan = 0;
        if (resSetting && resSetting.status === 'success') {
            let nominal = parseFloat(resSetting.nominal) || 0;
            let bulan = parseFloat(resSetting.bulan) || 0;
            totalTagihan = nominal * bulan;
        }

        let totalTerbayar = 0;

        if (resSpp.status === 'success' && resSpp.data.length > 0) {
            resSpp.data.forEach(item => {
                let nom = parseFloat(item.nominal) || 0;
                totalTerbayar += nom;

                let warnaTeks = item.status === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600';
                let warnaBg = item.status === 'LUNAS' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100';

                wadah.innerHTML += `
                    <div class="flex justify-between items-center p-2.5 rounded-lg border text-xs ${warnaBg} mb-2 shadow-sm">
                        <div>
                            <span class="font-bold text-gray-700 block mb-0.5">${item.keterangan}</span>
                            <span class="font-semibold text-blue-600">${formatRp(nom)}</span>
                        </div>
                        <span class="font-bold px-2 py-1 bg-white rounded-md ${warnaTeks} border shadow-sm">${item.status}</span>
                    </div>
                `;
            });
        } else {
            wadah.innerHTML = `<div class="text-center text-xs text-gray-400 py-4 italic">Belum ada riwayat pembayaran yang tercatat.</div>`;
        }

        // Hitung Sisa Tunggakan (Sisa = Total Tagihan - Total Terbayar)
        let sisaTunggakan = Math.max(0, totalTagihan - totalTerbayar);
        
        if (elTagihan) elTagihan.innerText = formatRp(totalTagihan);
        if (elSisa) {
            if (sisaTunggakan === 0) {
                elSisa.innerHTML = '<i class="fas fa-check-circle mr-1"></i> LUNAS';
                elSisa.className = "text-sm font-black text-emerald-600";
            } else {
                elSisa.innerText = formatRp(sisaTunggakan);
                elSisa.className = "text-sm font-black text-red-500";
            }
        }
    }).catch(e => {
        wadah.innerHTML = `<div class="text-center text-xs text-red-400 py-4">Gagal terhubung ke database.</div>`;
    });
}



// =========================================================
// ROTASI QUOTES WALI SANTRI
// =========================================================
const daftarKutipan = [
    // --- Tentang Madrasah Darussalam ---
    "Madrasah Darussalam, oase ilmu di gurun zaman, tempat menanam benih-benih takwa.",
    "Di bawah panji Darussalam, generasi Rabbani ditempa untuk menjadi penerus perjuangan umat.",
    "Di sini, ilmu dunawi berpadu dengan hikmah ukhrawi dalam simfoni pendidikan yang harmonis.",
    "Cahaya ilmu memancar dari setiap bilik Darussalam, menerangi jiwa para santri.",
    "Darussalam, lebih dari sekadar sekolah, ini adalah keluarga besar yang saling menguatkan dalam kebaikan.",
    "Semoga Allah selalu meridhoi setiap langkah dan usaha Madrasah Darussalam.",
    "Terpancarlah cahaya kebenaran dari setiap sudut Darussalam, rumah ilmu dan akhlak mulia.",
    "Di Darussalam, kami mendidik hati dan akal, mencetak generasi yang cerdas dan saleh.",
    "Keberkahan mengalir dari doa-doa para Kyai dan Guru Darussalam yang tak pernah putus.",
    "Darussalam, benteng akidah di tengah badai zaman, penjaga tradisi dan nilai luhur.",
    "Setiap santri yang melangkah keluar adalah duta kebaikan, membawa nama harum Madrasah Darussalam.",
    
    // --- Tentang Peran Wali Santri ---
    "Wali Santri adalah mitra sejati Madrasah, pilar pendukung yang tak ternilai harganya.",
    "Kerjasama harmonis antara wali santri dan asatidz adalah kunci kesuksesan pendidikan santri.",
    "Doa ibu dan bapak di rumah adalah kekuatan utama yang membimbing langkah para santri di Madrasah.",
    "Wali Santri yang cerdas memahami bahwa pendidikan anak adalah investasi terbaik untuk dunia dan akhirat.",
    "Bersama, kita bahu-membahu membangun peradaban dari dalam keluarga, dengan Darussalam sebagai pilar utama.",
    "Keikhlasan dan dukungan wali santri adalah bahan bakar yang menggerakkan roda kemajuan Madrasah Darussalam.",
    "Hadirnya wali santri di setiap momen penting memperkuat semangat dan tekad Madrasah.",
    "Jadikan rumah sebagai madrasah pertama bagi anak-anak, dan percayakan Darussalam sebagai pilar utama.",
    "Mari kita jaga marwah dan nama baik Madrasah Darussalam, demi kebaikan bersama.",
    "Wali Santri yang solid, Madrasah yang hebat, Santri yang saleh.",
    "Terima kasih, wali santri, atas kepercayaan dan dukungan yang tak terhingga.",

    // --- Hubungan Alumni, Santri, Wali Santri dengan Guru ---
    "Alumni Darussalam adalah cerminan dari didikan luhur para asatidz dan Kyai.",
    "Tali silaturahmi tak pernah putus antara alumni, santri, wali santri, dan guru, dalam satu keluarga besar.",
    "Santri menghormati guru, alumni mengenang guru, wali santri mempercayai guru.",
    "Di mana pun alumni berada, nama guru selalu tertanam di dada, sebagai pedoman hidup.",
    "Keberhasilan alumni adalah kebanggaan dan bukti berkah dari ilmu yang diajarkan oleh para asatidz.",
    "Santri teladan adalah cermin bakti wali santri kepada para guru dan Madrasah.",
    "Hormatilah guru, maka ilmu akan berkah dan hidup akan terarah menuju keridhaan Allah.",
    "Dukungan wali santri kepada guru, demi kemaslahatan bersama para santri dan kemajuan Madrasah.",
    "Jaringan alumni yang kuat, saling dukung demi kemajuan almamater dan peradaban umat.",
    "Guru adalah pelita yang menerangi jalan, alumni adalah cahaya yang menyinari dunia, santri adalah generasi penerus perjuangan.",
    "Saling mendoakan dalam kebaikan, itulah kuncinya."
];

function rotasiKutipan() {
    const elemenKutipan = document.getElementById('kutipanTeks');
    if (!elemenKutipan) return;

    // Hilangkan teks (fade out)
    elemenKutipan.style.opacity = 0;
    
    setTimeout(() => {
        // Pilih angka acak dari 0 sampai 32
        const indeksAcak = Math.floor(Math.random() * daftarKutipan.length);
        
        // Ubah teks
        elemenKutipan.innerText = `"${daftarKutipan[indeksAcak]}"`;
        
        // Tampilkan teks kembali (fade in)
        elemenKutipan.style.opacity = 1;
    }, 500); // Waktu 500ms ini menyesuaikan dengan durasi animasi di HTML (duration-500)
}

// Jalankan ketika halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    rotasiKutipan();
    // Ganti kutipan otomatis setiap 10 detik (12000 milidetik)
    setInterval(rotasiKutipan, 12000);
});

// =========================================================
// SCRIPT UNTUK EFEK GESER WIDGET WA (DRAG & DROP)
// =========================================================
const waWidget = document.getElementById('wa-widget');
const waLink = document.getElementById('wa-link');

if (waWidget && waLink) {
    let isDragging = false;
    let isMoved = false; 
    let startX, startY;

    // --- KUNCI UTAMANYA: Matikan drag bawaan browser agar logo bisa ditarik bebas ---
    waWidget.addEventListener('dragstart', function(e) {
        e.preventDefault();
    });

    // --- FUNGSI UNTUK DESKTOP (MOUSE) ---
    waWidget.addEventListener('mousedown', function(e) {
        isDragging = true;
        isMoved = false;
        startX = e.clientX - waWidget.getBoundingClientRect().left;
        startY = e.clientY - waWidget.getBoundingClientRect().top;
        waWidget.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        isMoved = true; 
        e.preventDefault(); 
        
        let newX = e.clientX - startX;
        let newY = e.clientY - startY;

        // Membatasi agar logo tidak keluar dari batas layar
        newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));

        waWidget.style.left = newX + 'px';
        waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto'; 
        waWidget.style.right = 'auto';  
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        waWidget.style.cursor = 'grab';
    });

    // --- FUNGSI UNTUK HP / SMARTPHONE (TOUCH) ---
    waWidget.addEventListener('touchstart', function(e) {
        isDragging = true;
        isMoved = false;
        let touch = e.touches[0];
        startX = touch.clientX - waWidget.getBoundingClientRect().left;
        startY = touch.clientY - waWidget.getBoundingClientRect().top;
    }, {passive: false});

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        isMoved = true;
        e.preventDefault(); 
        let touch = e.touches[0];
        
        let newX = touch.clientX - startX;
        let newY = touch.clientY - startY;

        // Membatasi agar logo tidak keluar dari batas layar HP
        newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));

        waWidget.style.left = newX + 'px';
        waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto';
        waWidget.style.right = 'auto';
    }, {passive: false});

    document.addEventListener('touchend', function() {
        isDragging = false;
    });

    // --- PENCEGAH KLIK TIDAK SENGAJA ---
    waLink.addEventListener('click', function(e) {
        if (isMoved) {
            e.preventDefault(); 
        }
    });
}

// =========================================================
// KONTROL PENUH PAPAN PENGUMUMAN (MODE ADMIN)
// =========================================================

// 1. Membuka layar pop-up dan menarik daftar pengumuman
function bukaModalPengumumanAdmin() {
    const modal = document.getElementById('modalKelolaPengumuman');
    const content = document.getElementById('modalKelolaPengumumanContent');
    if (modal && content) {
        modal.classList.remove('hidden');
        
        // Memasukkan state (riwayat semu) ke memori HP agar tombol Back terdeteksi
        history.pushState({ modalAdminTerbuka: true }, null, location.href);
        
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            content.classList.remove('scale-95');
            content.classList.add('scale-100');
        }, 10);
        muatListPengumumanAdmin();
    }
}

// 2. Menutup layar pop-up (Ditambah parameter deteksi tombol Back)
function tutupModalPengumumanAdmin(dariTombolBack = false) {
    const modal = document.getElementById('modalKelolaPengumuman');
    const content = document.getElementById('modalKelolaPengumumanContent');
    if (modal && content) {
        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        setTimeout(() => {
            modal.classList.add('hidden');
            resetFormPengumuman(); // Bersihkan form saat ditutup
        }, 300);

        // Bersihkan state jika ditutup manual lewat tombol X (bukan lewat tombol Back HP)
        if (!dariTombolBack && history.state && history.state.modalAdminTerbuka) {
            history.back(); 
        }
    }
}

// 3. Mengembalikan form ke mode "Tambah Baru"

function resetFormPengumuman() {
    document.getElementById('adminIdPengumuman').value = "0";
    document.getElementById('adminTglPengumuman').value = "";
    document.getElementById('adminJdlPengumuman').value = "";
    document.getElementById('adminIsiPengumuman').value = "";
    
    // Ubah nilai bawaan dropdown menjadi kosong (kembali ke "-- Pilih Kategori --")
    document.getElementById('adminKatPengumuman').value = ""; 
    
    document.getElementById('titleFormPengumuman').innerText = "Tambah Pengumuman Baru";
    document.getElementById('badgeEditMode').classList.add('hidden');
    
    gantiContohPengumuman();
}

// 4. Menarik data list pengumuman untuk ditampilkan ke Admin
function muatListPengumumanAdmin() {
    const wadah = document.getElementById('wadahListAdminPengumuman');
    wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-4"><i class="fas fa-spinner fa-spin mr-1"></i> Sedang mensinkronisasi data...</div>';

    const fd = new URLSearchParams();
    fd.append('action', 'getPengumuman');

    // Menggunakan gasFetch karena ini adalah standar routing sistem Anda
    gasFetch({ method: 'POST', body: fd })
    .then(r => r.json())
    .then(res => {
        wadah.innerHTML = '';
        if (res.status === 'success' && res.data.length > 0) {
            res.data.forEach(item => {
                let badgeClass = "bg-gray-100 text-gray-600 border-gray-200";
                let cat = item.kategori ? item.kategori.toUpperCase() : "";
                
                if (cat.includes("LIBUR")) badgeClass = "bg-red-50 text-red-600 border-red-200";
                else if (cat.includes("UJIAN")) badgeClass = "bg-purple-50 text-purple-600 border-purple-200";
                else if (cat.includes("LOMBA")) badgeClass = "bg-orange-50 text-orange-600 border-orange-200";
                else if (cat.includes("AKADEMIK")) badgeClass = "bg-blue-50 text-blue-600 border-blue-200";
                else if (cat.includes("KEGIATAN") || cat.includes("HAFLAH")) badgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200";

                // Escaping data agar tidak bentrok dengan tanda petik saat edit ditekan
                const safeJdl = item.judul.replace(/'/g, "\\'");
                const safeTgl = item.tanggal.replace(/'/g, "\\'");
                const safeIsi = item.isi.replace(/'/g, "\\'").replace(/\n/g, "\\n");
                const safeKat = item.kategori.replace(/'/g, "\\'");

                wadah.innerHTML += `
                    <div class="p-4 bg-white border border-gray-200 rounded-xl flex flex-col sm:flex-row justify-between gap-3 shadow-sm hover:border-emerald-300 transition-all">
                        <div class="flex-1">
                            <div class="flex items-center gap-2 mb-1.5">
                                <span class="px-2 py-0.5 text-[9px] font-bold border rounded uppercase ${badgeClass}">${item.kategori}</span>
                                <span class="text-[11px] font-bold text-gray-400"><i class="far fa-calendar-alt"></i> ${item.tanggal}</span>
                            </div>
                            <h6 class="text-sm font-bold text-gray-800">${item.judul}</h6>
                           <p class="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed whitespace-pre-line">${item.isi}</p>
                        </div>
                        <div class="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-3">
                            <button onclick="editPengumuman('${item.id}', '${safeTgl}', '${safeKat}', '${safeJdl}', '${safeIsi}')" class="flex-1 sm:flex-none w-full sm:w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white flex items-center justify-center transition-colors text-xs shadow-sm"><i class="fas fa-edit mr-1 sm:mr-0"></i><span class="sm:hidden">Edit</span></button>
                            <button onclick="hapusPengumuman('${item.id}')" class="flex-1 sm:flex-none w-full sm:w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-600 hover:text-white flex items-center justify-center transition-colors text-xs shadow-sm"><i class="fas fa-trash-alt mr-1 sm:mr-0"></i><span class="sm:hidden">Hapus</span></button>
                        </div>
                    </div>
                `;
            });
        } else {
            wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-6 italic border border-dashed border-gray-200 rounded-xl bg-gray-50">Belum ada pengumuman. Papan di portal ortu saat ini kosong.</div>';
        }
    })
    .catch(err => {
        wadah.innerHTML = '<div class="text-center text-xs text-red-400 py-4">Gagal memuat daftar pengumuman. Periksa koneksi.</div>';
    });
}

// 5. Fungsi saat tombol "Edit" di klik (Mengisi formulir otomatis)
function editPengumuman(id, tgl, kat, jdl, isi) {
    document.getElementById('adminIdPengumuman').value = id;
    document.getElementById('adminTglPengumuman').value = tgl;
    document.getElementById('adminKatPengumuman').value = kat;
    document.getElementById('adminJdlPengumuman').value = jdl;
    
    // Kembalikan newline (\n) agar format paragraf di textarea rapi
    document.getElementById('adminIsiPengumuman').value = isi.replace(/\\n/g, "\n");
    
    document.getElementById('titleFormPengumuman').innerText = "Edit Pengumuman";
    document.getElementById('badgeEditMode').classList.remove('hidden');
    
    // Scroll otomatis ke atas form agar admin fokus ke form
    document.getElementById('modalKelolaPengumumanContent').scrollTo({ top: 0, behavior: 'smooth' });
}

// 6. Menyimpan hasil ketikan (Mode Baru / Edit) ke Database
function simpanPengumumanAdmin() {
    const id = document.getElementById('adminIdPengumuman').value;
    const tgl = document.getElementById('adminTglPengumuman').value.trim();
    const kat = document.getElementById('adminKatPengumuman').value.trim();
    const jdl = document.getElementById('adminJdlPengumuman').value.trim();
    const isi = document.getElementById('adminIsiPengumuman').value.trim();

    if(!tgl || !jdl || !isi) return Swal.fire('Perhatian', 'Kolom Tanggal, Judul, dan Isi tidak boleh dikosongkan!', 'warning');

    const btn = document.querySelector('button[onclick="simpanPengumumanAdmin()"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    btn.disabled = true;

    // AMBIL TOKEN LOGIN ADMIN DARI MEMORI BROWSER
const fd = new URLSearchParams();
    fd.append('action', 'savePengumuman');
    
    // AMBIL TOKEN DENGAN AMAN (Mencegah pengiriman teks "null")
    let tokenAdmin = null;
    if (typeof token !== 'undefined' && token) tokenAdmin = token;
    else if (sessionStorage.getItem('token')) tokenAdmin = sessionStorage.getItem('token');
    else if (localStorage.getItem('token')) tokenAdmin = localStorage.getItem('token');
    
    // Jika gasFetch Anda sudah otomatis menyelipkan token, fd.append ini akan diabaikan.
    if (tokenAdmin) {
        fd.append('token', tokenAdmin);
    }
    fd.append('id', id);
    fd.append('tanggal', tgl);
    fd.append('kategori', kat);
    fd.append('judul', jdl);
    fd.append('isi', isi);

    gasFetch({ method: 'POST', body: fd })
    .then(r => r.json())
    .then(res => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        if(res.status === 'success') {
            Swal.fire('Sukses', res.message, 'success');
            resetFormPengumuman(); 
            muatListPengumumanAdmin(); 
        } else {
            Swal.fire('Gagal', res.message, 'error');
        }
    })
    .catch(err => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        Swal.fire('Error', 'Terjadi kesalahan jaringan saat menyimpan.', 'error');
    });
}

// 7. Menghapus pengumuman
function hapusPengumuman(id) {
    Swal.fire({
        title: 'Cabut Pengumuman?',
        text: "Pengumuman ini akan dihapus secara permanen dari layar Wali Santri.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Cabut'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            
            const fd = new URLSearchParams();
            fd.append('action', 'deletePengumuman');
            fd.append('id', id);

            // AMBIL TOKEN DENGAN AMAN
            let tokenAdmin = null;
            if (typeof token !== 'undefined' && token) tokenAdmin = token;
            else if (sessionStorage.getItem('token')) tokenAdmin = sessionStorage.getItem('token');
            else if (localStorage.getItem('token')) tokenAdmin = localStorage.getItem('token');
            
            if (tokenAdmin) {
                fd.append('token', tokenAdmin);
            }
            fd.append('id', id);

            gasFetch({ method: 'POST', body: fd })
            .then(r => r.json())
            .then(res => {
                if(res.status === 'success') {
                    Swal.fire('Dihapus!', res.message, 'success');
                    muatListPengumumanAdmin(); 
                } else {
                    Swal.fire('Gagal', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('Error', 'Terjadi kesalahan jaringan.', 'error'));
        }
    });
}
// 7. Menghapus pengumuman
function hapusPengumuman(id) {
    Swal.fire({
        title: 'Cabut Pengumuman?',
        text: "Pengumuman ini akan dihapus secara permanen dari layar Wali Santri.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Cabut'
    }).then((result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Menghapus...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
            
            const fd = new URLSearchParams();
            fd.append('action', 'deletePengumuman');
            fd.append('id', id);

            gasFetch({ method: 'POST', body: fd })
            .then(r => r.json())
            .then(res => {
                if(res.status === 'success') {
                    Swal.fire('Dihapus!', res.message, 'success');
                    muatListPengumumanAdmin(); // Render ulang list
                } else {
                    Swal.fire('Gagal', res.message, 'error');
                }
            })
            .catch(err => Swal.fire('Error', 'Terjadi kesalahan jaringan.', 'error'));
        }
    });
}

// Mengganti teks petunjuk (placeholder) sesuai kategori yang dipilih
function gantiContohPengumuman() {
    // Jangan ubah form jika admin sedang mengedit pengumuman yang sudah ada
    if (document.getElementById('adminIdPengumuman').value !== "0") return;

    const kategori = document.getElementById('adminKatPengumuman').value;
    const judul = document.getElementById('adminJdlPengumuman');
    const isi = document.getElementById('adminIsiPengumuman');

    // Kosongkan isian asli agar Admin mengetik sendiri
    judul.value = "";
    isi.value = "";

    // Berikan teks bayangan (penjelasan) berdasarkan kategori
    if (kategori === "") {
        judul.placeholder = "Pilih kategori terlebih dahulu...";
        isi.placeholder = "Pilih kategori untuk melihat petunjuk penulisan isi pengumuman...";
    }
    else if (kategori === "Akademik") {
        judul.placeholder = "Contoh: Info Pembagian Rapor / Evaluasi Belajar";
        isi.placeholder = "Petunjuk: Jelaskan informasi akademik di sini. Misal: Kapan rapor dibagikan, syarat pengambilan rapor, atau info kegiatan belajar mengajar lainnya.";
    } 
    else if (kategori === "Libur") {
        judul.placeholder = "Contoh: Libur Hari Raya / Libur Semester";
        isi.placeholder = "Petunjuk: Jelaskan detail libur di sini. Sebutkan tanggal mulai libur dan tegaskan tanggal berapa santri wajib masuk kembali ke madrasah.";
    } 
    else if (kategori === "Ujian") {
        judul.placeholder = "Contoh: Jadwal Ujian Penilaian Akhir Semester (PAS)";
        isi.placeholder = "Petunjuk: Jelaskan detail pelaksanaan ujian. Misal: Tanggal pelaksanaan ujian, himbauan untuk memantau jam belajar anak di rumah, atau persyaratan ujian.";
    } 
    else if (kategori === "Lomba") {
        judul.placeholder = "Contoh: Rangkaian Lomba Peringatan Hari Santri";
        isi.placeholder = "Petunjuk: Sebutkan jenis-jenis perlombaan yang diadakan, kapan pelaksanaannya (siang/malam), dan ketentuan untuk santri atau wali santri.";
    } 
    else if (kategori === "Kegiatan") {
        judul.placeholder = "Contoh: Pengajian Akbar & Haflah Akhirussanah";
        isi.placeholder = "Petunjuk: Jelaskan detail kegiatan madrasah. Sebutkan waktu pelaksanaan, lokasi acara, dan himbauan kehadiran untuk wali santri.";
    }
}

// =========================================================
// EVENT LISTENER GLOBAL UNTUK TOMBOL BACK HP (ADMIN MODE)
// =========================================================
window.addEventListener('popstate', function (event) {
    // 1. Tutup notifikasi SweetAlert jika kebetulan sedang muncul
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
    }
    
    // 2. Tutup Modal Kelola Pengumuman jika sedang terbuka
    const modalAdmin = document.getElementById('modalKelolaPengumuman');
    if (modalAdmin && !modalAdmin.classList.contains('hidden')) {
        // Kirim argumen 'true' agar sistem tahu ini dari tombol Back, bukan dari tombol X
        tutupModalPengumumanAdmin(true); 
    }
});