
// ---------------------------------------------------------
// 1. PENGATURAN GLOBAL, KEAMANAN & ONBOARDING
// ---------------------------------------------------------
let GLOBAL_DATA_SANTRI = [];
let GLOBAL_HEADERS_NILAI = [];
let GLOBAL_DATA_NILAI = [];
let JADWAL_MAPEL = {}; 

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener("DOMContentLoaded", () => {
    const sudahOnboarding = localStorage.getItem('madasaOnboardingDone');
    const tokenTersimpan = sessionStorage.getItem('tokenMadasa');
    
    const namaTersimpan = sessionStorage.getItem('namaMadasa');
    const roleTersimpan = sessionStorage.getItem('roleMadasa');

    const pageOnboarding = document.getElementById('onboardingPage');
    const pageLogin = document.getElementById('loginPage');
    const pageDashboard = document.getElementById('dashboardPage');

    if (!sudahOnboarding) {
        if (pageOnboarding) pageOnboarding.classList.remove('hidden');
        pageLogin.classList.add('hidden');
        pageDashboard.classList.add('hidden');
    } else {
        if (pageOnboarding) pageOnboarding.classList.add('hidden');
        pageLogin.style.visibility = 'visible'; 
        
        if (!tokenTersimpan) {
            pageLogin.classList.remove('hidden');
            pageDashboard.classList.add('hidden');
        } else {
            pageLogin.classList.add('hidden');
            pageDashboard.classList.remove('hidden');
			
            if (namaTersimpan && roleTersimpan) {
                document.getElementById('userNameDisplay').innerText = namaTersimpan;
                document.getElementById('userRoleDisplay').innerText = roleTersimpan;

                const adminElements = document.querySelectorAll('.admin-only');
                if (roleTersimpan === 'Guru Kelas' || roleTersimpan === 'Guru') {
                    adminElements.forEach(el => el.style.display = 'none');
                } else {
                    adminElements.forEach(el => el.style.display = '');
                }
                
               showView('home', false); 
muatSemuaMapel();

if (typeof tampilkanWidgetWA === 'function') {
    setTimeout(() => {
        tampilkanWidgetWA();
    }, 500);
}

if (typeof tampilkanPromptPWA === 'function') {
    setTimeout(() => {
        tampilkanPromptPWA();
    }, 1500);
}
            }
        }
    }
});

function selesaikanOnboarding() {
    const pageOnboarding = document.getElementById('onboardingPage');
    const pageLogin = document.getElementById('loginPage');

    localStorage.setItem('madasaOnboardingDone', 'true');

    if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(function(OneSignal) {
    if (OneSignal && OneSignal.Slidedown) {
        OneSignal.Slidedown.promptPush();
    }
        });
    }

    pageOnboarding.classList.add('opacity-0');
    pageLogin.style.visibility = 'visible'; 
    pageLogin.classList.remove('hidden');
    pageLogin.classList.add('animasi-masuk');

    setTimeout(() => {
        pageOnboarding.classList.add('hidden');
    }, 500);
}

function formatTanggalIndo(tanggalYYYYMMDD) {
    if (!tanggalYYYYMMDD) return "";
    const dateObj = new Date(tanggalYYYYMMDD);
    return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

// =========================================================
// FUNGSI MUAT MAPEL (DIPERBAIKI DENGAN AUTO-RETRY)
// =========================================================
function muatSemuaMapel() {
    const fdMapel = new URLSearchParams();
    fdMapel.append('action', 'getAllMapel');
    fdMapel.append('token', sessionStorage.getItem('tokenMadasa'));
    
    // Fungsi khusus untuk mencoba ulang jika server Google 404
    const tarikMapel = async (retry = 3) => {
        for (let i = 0; i < retry; i++) {
            try {
                let req = await gasFetch( { method: 'POST', body: fdMapel });
                if (!req.ok) throw new Error("Server Sibuk");
                let res = await req.json();
                if (res.status === 'success') JADWAL_MAPEL = res.data;
                return; // Berhenti mencoba jika sukses
            } catch (e) {
                if (i === retry - 1) console.log("Gagal memuat Master Mapel setelah 3 percobaan.");
                // Tunggu 1 detik sebelum mencoba lagi
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };
    tarikMapel();
}

// =========================================================
// FUNGSI LOAD DATA SANTRI (DIPERBAIKI DENGAN AUTO-RETRY)
// =========================================================
function loadDataSantri(silent = false) { 
    if (!silent) showLoading(true); 
    const formData = new URLSearchParams(); 
    formData.append('action', 'getSantri'); 
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    
    // Fungsi khusus untuk mencoba ulang jika server Google 404
    const tarikSantri = async (retry = 3) => {
        for (let i = 0; i < retry; i++) {
            try {
                let req = await gasFetch( { method: 'POST', body: formData });
                if (!req.ok) throw new Error("Server Sibuk");
                let res = await req.json();
                return res; // Kembalikan data jika sukses
            } catch (e) {
                if (i === retry - 1) throw e; // Lempar error jika percobaan habis
                console.warn(`Server Google merespons 404/Error, mencoba ulang... (Percobaan ${i + 1})`);
                // Tunggu 1 detik sebelum mencoba lagi
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };

    tarikSantri().then(res => { 
        if (!silent) showLoading(false); 
        if(res.status === 'success') { 
            GLOBAL_DATA_SANTRI = res.data; 
            buatOpsiSemuaKelasOtomatis();
            
            const tbody = document.getElementById('bodyTabelSantri'); 
            if(tbody) { 
                if(res.data.length === 0) { 
                    tbody.innerHTML = '<tr><td colspan=\"6\" class=\"p-4 sm:p-6 text-center text-gray-500\">Belum ada data santri di database.</td></tr>'; 
                    return; 
                } 

                let barisHTML = [];
                const roleSaatIni = sessionStorage.getItem('roleMadasa') || '';

                res.data.forEach(s => { 
                    let amanTampilNama = escapeHTML(s.nama);
                    let amanTampilKelas = escapeHTML(s.kelas);
                    let amanNama = s.nama ? s.nama.toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;') : '';
                    let amanAlamat = s.alamat ? s.alamat.toString().replace(/\\/g, '\\\\').replace(/`/g, "\\`").replace(/'/g, "\\'") : '';
                    let amanAyah = s.ayah ? s.ayah.toString().replace(/\\/g, '\\\\').replace(/`/g, "\\`").replace(/'/g, "\\'") : '';
                    let amanIbu = s.ibu ? s.ibu.toString().replace(/\\/g, '\\\\').replace(/`/g, "\\`").replace(/'/g, "\\'") : '';
                    let amanTtl = s.ttl ? s.ttl.toString().replace(/\\/g, '\\\\').replace(/`/g, "\\`").replace(/'/g, "\\'") : '';

                    const tombolHapus = (!roleSaatIni.includes('Guru')) 
                        ? `<button onclick="hapusDataSantri('${s.nis}', '${amanNama}')" class="text-red-500 hover:bg-red-100 p-2 sm:p-2.5 rounded-lg transition-all" title="Hapus Data"><i class="fas fa-trash-alt"></i></button>` : '';

                    barisHTML.push(`
                    <tr class="hover:bg-teal-50 transition-all santri-row" data-kelas="${amanTampilKelas}">
                        <td class="p-3 sm:p-4 text-center font-bold text-gray-500 urut-nomor"></td>
                        <td class="p-3 sm:p-4 font-medium">${escapeHTML(s.nis)}</td>
                        <td class="p-3 sm:p-4 font-bold text-gray-800 whitespace-nowrap">${amanTampilNama}</td>
                        <td class="p-3 sm:p-4 text-center whitespace-nowrap">${escapeHTML(s.jk)}</td>
                        <td class="p-3 sm:p-4 whitespace-nowrap"><span class="bg-teal-100 text-teal-700 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap">${amanTampilKelas}</span></td>
                        <td class="p-3 sm:p-4 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="openModalEditSantri('${s.nis}', '${amanNama}', '${s.jk}', '${s.kelas}', \`${amanAlamat}\`, \`${amanAyah}\`, \`${amanIbu}\`, '${s.hp}', \`${amanTtl}\`)" class="text-blue-500 hover:bg-blue-100 p-2 sm:p-2.5 rounded-lg transition-all" title="Edit Data"><i class="fas fa-edit"></i></button>
                                ${tombolHapus}
                            </div>
                        </td>
                    </tr>`);
                });
                
                tbody.innerHTML = barisHTML.join('');
                filterSantri(); 
            } 
        } 
    }).catch(err => { 
        if (!silent) showLoading(false); 
        console.error("Detail Error JS:", err); 
        if (!silent) Swal.fire('Error', 'Server Google sedang sibuk. Silakan coba klik menunya sekali lagi.', 'error'); 
    }); 
}

// ---------------------------------------------------------
// 2. FUNGSI UI UTAMA
// ---------------------------------------------------------
function togglePassword() { const pwd = document.getElementById('password'); const icon = document.getElementById('eyeIcon'); if (pwd.type === 'password') { pwd.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } else { pwd.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); } }
function showLoading(show) { document.getElementById('loadingScreen').style.display = show ? 'flex' : 'none'; }

function showView(viewName, pushToHistory = true) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    const targetView = document.getElementById('view-' + viewName);
    if (targetView) targetView.classList.remove('hidden');
    
    if (viewName === 'dataSantri' || viewName === 'inputNilai' || viewName === 'dataNilai' || viewName === 'ranking' || viewName === 'pengaturan' || viewName === 'mutasi') { 
        if (GLOBAL_DATA_SANTRI.length === 0) {
            loadDataSantri(); 
        }
    }
    
    if (viewName === 'ranking') { 
        loadBintangPelajar(); 
    }
    
    gantiMotivasiAcak();
    if (viewName === 'home') { jalankanBannerOtomatis(); }
    
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('bg-emerald-700', 'text-white', 'font-medium'); 
        link.classList.add('text-emerald-100', 'hover:bg-emerald-700/50');
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${viewName}'`)) {
            link.classList.add('bg-emerald-700', 'text-white', 'font-medium'); 
            link.classList.remove('text-emerald-100', 'hover:bg-emerald-700/50');
        }
    });
    
    if (pushToHistory) window.history.pushState({ view: viewName }, "", "#" + viewName);
    
    if (window.innerWidth < 768) {
        const sidebar = document.querySelector('aside');
        const overlay = document.getElementById('overlay-sidebar');
        if (sidebar && !sidebar.classList.contains('hidden')) {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('flex', 'fixed', 'inset-y-0', 'left-0', 'w-64', 'z-[60]', 'shadow-2xl');
            if (overlay) overlay.remove(); 
        }
    }
}

window.addEventListener('popstate', function(event) {
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
        return; 
    }

    const sidebar = document.querySelector('aside');
    if (sidebar && !sidebar.classList.contains('hidden') && window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex', 'fixed', 'inset-y-0', 'left-0', 'w-64', 'z-[60]', 'shadow-2xl');
        const overlay = document.getElementById('overlay-sidebar');
        if (overlay) overlay.remove();
        return;
    }

    const modalTambah = document.getElementById('modalTambahSantri');
    const modalEdit = document.getElementById('modalEditSantri');
    const modalImport = document.getElementById('modalImportSantri');
    const modalEditNilai = document.getElementById('modalEditNilai');
    
    let isModalClosed = false;

    if (modalTambah && !modalTambah.classList.contains('hidden')) { 
        modalTambah.classList.add('hidden'); 
        const form = document.getElementById('formTambahSantri');
        if(form) {
            form.reset();
            document.getElementById('text_add_kelas').innerText = 'Pilih...';
        }
        isModalClosed = true; 
    }
    if (modalEdit && !modalEdit.classList.contains('hidden')) { 
        modalEdit.classList.add('hidden'); 
        const form = document.getElementById('formEditSantri');
        if(form) {
            form.reset();
            document.getElementById('text_edit_kelas').innerText = 'Pilih...';
        }
        isModalClosed = true; 
    }

    if (modalImport && !modalImport.classList.contains('hidden')) { 
        modalImport.classList.add('hidden'); 
        const form = document.getElementById('formImportSantri');
        if(form) form.reset();
        isModalClosed = true; 
    }
    if (modalEditNilai && !modalEditNilai.classList.contains('hidden')) { 
        modalEditNilai.classList.add('hidden'); 
        const wadah = document.getElementById('wadahInputEditNilai');
        if(wadah) wadah.innerHTML = '';
        isModalClosed = true; 
    }
    
    if (isModalClosed) return;

    const isDashboard = !document.getElementById('dashboardPage').classList.contains('hidden');
    if (isDashboard) {
        if (event.state && event.state.view) {
            showView(event.state.view, false);
        } else {
            showView('home', false);
        }
    }
});

// ---------------------------------------------------------
// 3. FUNGSI AUTENTIKASI (LOGIN & LOGOUT)
// ---------------------------------------------------------
// ---------------------------------------------------------
// 3. FUNGSI AUTENTIKASI (LOGIN & LOGOUT) DENGAN AUTO-RETRY
// ---------------------------------------------------------
document.getElementById('loginForm').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    showLoading(true); 
    
    const formData = new URLSearchParams(); 
    formData.append('action', 'login'); 
    formData.append('username', document.getElementById('username').value); 
    formData.append('password', document.getElementById('password').value); 
    
    // Fungsi khusus untuk mencoba ulang login jika server Google sibuk/CORS
    const prosesLoginMadasa = async (retry = 3) => {
        for (let i = 0; i < retry; i++) {
            try {
                let req = await gasFetch( { method: 'POST', body: formData });
                if (!req.ok) throw new Error("CORS / Server Sibuk");
                return await req.json();
            } catch (err) {
                if (i === retry - 1) throw err;
                console.warn(`Gagal login, mencoba ulang... (Percobaan ${i + 1})`);
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };

    prosesLoginMadasa().then(d => { 
        showLoading(false); 
        if (d.status === 'success') { 
            sessionStorage.setItem('tokenMadasa', d.token);
            sessionStorage.setItem('namaMadasa', d.name);
            sessionStorage.setItem('roleMadasa', d.role);

            document.getElementById('userNameDisplay').innerText = d.name; 
            document.getElementById('userRoleDisplay').innerText = d.role; 
            const adminElements = document.querySelectorAll('.admin-only'); 
            
            if (d.role === 'Guru Kelas' || d.role === 'Guru') { 
                adminElements.forEach(el => el.style.display = 'none'); 
            } else { 
                adminElements.forEach(el => el.style.display = ''); 
            } 
            
            document.getElementById('loginPage').classList.add('hidden'); 
            document.getElementById('dashboardPage').classList.remove('hidden'); 
			
            if (typeof tampilkanWidgetWA === 'function') {
                tampilkanWidgetWA();
            }
			
            window.history.replaceState({ view: 'home' }, "", "#home");
            showView('home', false); 
            muatSemuaMapel();
			
            if (typeof tampilkanPromptPWA === 'function') {
                tampilkanPromptPWA();
            }

            // Pelacakan Login
            let mentahanPerangkat = navigator.userAgent;
            let namaPerangkatRapi = mentahanPerangkat;
            if (/Android/i.test(mentahanPerangkat)) {
                let match = mentahanPerangkat.match(/Android\s[0-9\.]+(?:;\s([^;]+))?/);
                let modelPabrik = match && match[1] ? match[1].split(')')[0] : "Tidak Diketahui";
                namaPerangkatRapi = "📱 HP Android (Model: " + modelPabrik + ")";
            } else if (/iPhone/i.test(mentahanPerangkat)) { namaPerangkatRapi = "📱 Apple iPhone";
            } else if (/iPad/i.test(mentahanPerangkat)) { namaPerangkatRapi = "📱 Apple iPad";
            } else if (/Windows NT/i.test(mentahanPerangkat)) { namaPerangkatRapi = "💻 Laptop/PC (Windows)";
            } else if (/Mac/i.test(mentahanPerangkat)) { namaPerangkatRapi = "💻 MacBook/iMac (Mac OS)";
            }

            const kirimDataKeServer = (dataLokasi) => {
                const notifData = new URLSearchParams();
                notifData.append('action', 'notifLogin');
                notifData.append('nama', d.name);  
                notifData.append('role', d.role);  
                notifData.append('perangkat', namaPerangkatRapi); 
                notifData.append('lokasi', dataLokasi);
                notifData.append('token', d.token);
                
                gasFetch( { method: 'POST', body: notifData }).catch(err => console.log(err));
            };

            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const lat = pos.coords.latitude; const lon = pos.coords.longitude;
                        kirimDataKeServer(`https://www.google.com/maps?q=${lat},${lon}`);
                    },
                    (err) => { kirimDataKeServer("Akses GPS Ditolak (" + err.message + ")"); },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else {
                kirimDataKeServer("Perangkat tidak mendukung GPS");
            }

        } else { 
            Swal.fire('Gagal Masuk', d.message, 'error'); 
        } 

    }).catch(er => { 
        showLoading(false); 
        console.error("Detail Error Sistem:", er); 
        Swal.fire('Terjadi Kesalahan Akses', 'Gagal terhubung ke Database. Pastikan pengaturan Deploy Apps Script diatur ke "Siapa Saja" (Anyone).', 'error'); 
    }); 
});

function logout() {
    Swal.fire({ 
        title: 'Keluar?', text: "Anda akan kembali ke halaman login", icon: 'question', 
        showCancelButton: true, confirmButtonColor: '#059669', cancelButtonColor: '#d33', confirmButtonText: 'Ya, Keluar' 
    }).then((result) => { 
        if (result.isConfirmed) { 
            sessionStorage.removeItem('tokenMadasa');
            sessionStorage.removeItem('namaMadasa');
            sessionStorage.removeItem('roleMadasa');
            
            document.getElementById('dashboardPage').classList.add('hidden'); 
            document.getElementById('loginPage').classList.remove('hidden'); 
            document.getElementById('loginForm').reset(); 
            window.history.replaceState(null, "", window.location.pathname); 
        } 
    }); 
}

// ---------------------------------------------------------
// 4. KATA MOTIVASI ACAK
// ---------------------------------------------------------
const dataMotivasi = [
    { judul: "Amal Jariyah Tanpa Batas", teks: "\"Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lainnya. Lelahmu dalam mendidik hari ini adalah benih amal jariyah yang pahalanya mengalir abadi.\"" },
    { judul: "Pelita Kegelapan", teks: "\"Guru sejati adalah pelita di tengah kegelapan. Satu huruf yang kau ajarkan dengan ikhlas, bisa menjadi cahaya bagi masa depan seorang santri.\"" },
    { judul: "Kesabaran Berbuah Surga", teks: "\"Mendidik butuh kesabaran ekstra. Ingatlah, setiap keringat dan kesabaranmu menghadapi santri akan dicatat sebagai ibadah di sisi Allah SWT.\"" },
    { judul: "Pencetak Generasi Rabbani", teks: "\"Engkau bukan sekadar mentransfer ilmu, tapi sedang memahat jiwa dan akhlaq. Di tanganmulah generasi Rabbani masa depan dibentuk.\"" },
    { judul: "Niatkan Karena Allah (Lillah)", teks: "\"Jadikan lelahmu menjadi Lillah. Tidak ada profesi yang lebih mulia dibandingkan mewariskan ilmu-ilmu kebaikan dan risalah kenabian.\"" },
    { judul: "Doa Para Malaikat", teks: "\"Sesungguhnya Allah, para malaikat, hingga semut di lubangnya bershalawat dan mendoakan kebaikan bagi orang yang mengajarkan kebaikan kepada manusia.\"" },
    { judul: "Pahlawan Tanpa Tanda Jasa", teks: "\"Namamu mungkin tak setenar tokoh dunia, tapi di langit, namamu harum karena lisan santri-santrimu yang melangitkan doa untukmu.\"" },
    { judul: "Pewaris Para Nabi", teks: "\"Ulama dan guru adalah pewaris para nabi. Berbanggalah, karena jalan yang kau tempuh saat ini adalah jalan setapak menuju surga.\"" },
    { judul: "Sentuhan Hati Terdalam", teks: "\"Nasihat yang keluar dari lisan mungkin hanya sampai di telinga, tapi didikan yang keluar dari hati akan menetap abadi di dalam sanubari santri.\"" },
    { judul: "Mata Air Hikmah", teks: "\"Jadilah seperti mata air hikmah yang menyejukkan. Meskipun terkadang santri menguji kesabaran, tetaplah sirami mereka dengan kasih sayang.\"" },
    { judul: "Mengangkat Derajat", teks: "\"Allah meninggikan derajat orang-orang yang berilmu. Engkau adalah jalan perantara bagi mereka untuk menggapai derajat yang mulia tersebut.\"" },
    { judul: "Tinta Emas Sejarah", teks: "\"Tinta seorang guru lebih berat timbangannya dari darah syuhada. Teruslah menuliskan kebaikan di lembaran kertas kehidupan para santri.\"" },
    { judul: "Arsitek Peradaban", teks: "\"Gedung tinggi bisa hancur, namun pondasi iman dan adab yang kau bangun di dada santrimu akan bertahan melintasi zaman.\"" },
    { judul: "Adab Mendahului Ilmu", teks: "\"Tugas terberatmu bukanlah membuat mereka pintar matematika atau nahwu, melainkan membuat mereka memiliki adab yang luhur dan tawadhu.\"" },
    { judul: "Kunci Pembuka Surga", teks: "\"Barangsiapa memudahkan jalan pencari ilmu, Allah mudahkan jalannya ke surga. Teruslah menjadi pembuka jalan kebaikan itu.\"" },
    { judul: "Menyemai Cahaya Hidayah", teks: "\"Mungkin kau tak pernah tahu kalimat mana yang akhirnya mengubah hidup seorang murid. Tugasmu hanya terus menyemai benih kebaikan.\"" },
    { judul: "Madrasah Pertama Kehidupan", teks: "\"Di madrasah inilah karakter dibentuk. Sambutlah para santri dengan senyum setiap pagi, karena senyummu mungkin adalah penyemangat utama mereka.\"" },
    { judul: "Mahkota Cahaya Kemuliaan", teks: "\"Anak yang sholeh akan memberikan mahkota cahaya bagi orang tuanya. Dan engkaulah perantara terhebat yang mewujudkan hal itu.\"" },
    { judul: "Sinergi Doa & Usaha", teks: "\"Mendidik bukan hanya soal teknik mengajar, tapi seberapa sering engkau menyebut nama murid-muridmu dalam sujud di sepertiga malam.\"" },
    { judul: "Penghapus Kebodohan", teks: "\"Tidak ada sedekah yang lebih agung daripada menyedekahkan ilmu untuk menghapus tabir kebodohan dari umat manusia.\"" },
    { judul: "Langkah Penuh Berkah", teks: "\"Setiap langkah kakimu dari rumah menuju Madrasah Darussalam adalah saksi bisu perjuanganmu menegakkan kalimat Allah.\"" },
    { judul: "Keikhlasan Adalah Kunci", teks: "\"Hanya ilmu yang diajarkan dengan keikhlasan yang akan membuahkan kepahaman. Jaga selalu niat muliamu, wahai Ustadz/Ustadzah.\"" },
    { judul: "Melukis Masa Depan", teks: "\"Papan tulis di kelasmu adalah kanvas, dan engkau adalah pelukisnya. Lukislah masa depan yang cerah untuk generasi Islam.\"" },
    { judul: "Kekuatan Sebuah Keteladanan", teks: "\"Satu contoh keteladanan yang kau tunjukkan jauh lebih kuat pengaruhnya daripada seribu nasihat yang hanya diucapkan lisan.\"" },
    { judul: "Senyum Pembawa Berkah", teks: "\"Wajah yang berseri dan senyum yang tulus saat masuk ke kelas adalah sedekah pertama yang kau berikan kepada santri-santrimu hari ini.\"" },
    { judul: "Merawat Berlian Umat", teks: "\"Setiap santri adalah bongkahan berlian kasar. Tugas gurulah yang menggosoknya dengan ilmu dan adab hingga mereka berkilau terang.\"" },
    { judul: "Tunas yang Akan Tumbuh", teks: "\"Jangan pernah berkecil hati jika hasil didikanmu belum terlihat. Engkau sedang menanam pohon jati yang butuh waktu untuk menjulang tinggi.\"" },
    { judul: "Lentera Kesabaran", teks: "\"Terkadang kenakalan santri hanyalah cara mereka mencari perhatian. Jawablah dengan sabar, karena di sanalah letak ujian keikhlasanmu.\"" },
    { judul: "Mewariskan Harta Terbaik", teks: "\"Harta yang kau wariskan akan habis dimakan zaman, tapi ilmu yang kau ajarkan akan abadi menjaga pemiliknya dari kehancuran.\"" },
    { judul: "Menyelamatkan Masa Depan", teks: "\"Menyelamatkan satu jiwa dengan ilmu agama, sama nilainya dengan menyelamatkan masa depan seluruh umat manusia.\"" },
    { judul: "Menepis Lelah dengan Ibadah", teks: "\"Ketika tumpukan nilai dan koreksian membuatmu lelah, tataplah wajah santrimu. Ingatlah bahwa mereka adalah kunci surgamu kelak.\"" },
    { judul: "Menumbuhkan Sayap Kebaikan", teks: "\"Guru tidak memberikan sayap, tapi guru mengajari santri bagaimana cara mengepakkan sayap agar mereka bisa terbang meraih ridha-Nya.\"" },
    { judul: "Satu Frekuensi Kebaikan", teks: "\"Tetaplah semangat bersinergi. Kesuksesan Madrasah Darussalam adalah hasil dari doa, dedikasi, dan kerja keras seluruh dewan guru.\"" }
];

function gantiMotivasiAcak() {
    const wadahJudul = document.getElementById('judulMotivasi');
    const wadahTeks = document.getElementById('teksMotivasi');
    if (wadahJudul && wadahTeks) {
        const acakIndex = Math.floor(Math.random() * dataMotivasi.length);
        const dataTerpilih = dataMotivasi[acakIndex];
        
        wadahJudul.style.transition = "opacity 0.5s ease"; 
        wadahTeks.style.transition = "opacity 0.5s ease";
        wadahJudul.style.opacity = 0; 
        wadahTeks.style.opacity = 0;
        
        setTimeout(() => {
            wadahJudul.innerText = dataTerpilih.judul;
            wadahTeks.innerText = dataTerpilih.teks; 
            wadahJudul.style.opacity = 1; 
            wadahTeks.style.opacity = 1;
        }, 200);
    }
}
document.addEventListener("DOMContentLoaded", gantiMotivasiAcak);

// ---------------------------------------------------------
// 5. PWA (PROGRESSIVE WEB APP)
// ---------------------------------------------------------
let deferredPrompt;
const installPrompt = document.getElementById('pwaInstallPrompt');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }) // <--- Harus sama dengan yang di atas
        .then(reg => console.log('PWA aktif!'))
        .catch(err => console.log('PWA gagal: ', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPrompt = e;
});

function tampilkanPromptPWA() {
    const installPrompt = document.getElementById('pwaInstallPrompt');
    if (deferredPrompt && installPrompt) { 
        setTimeout(() => { 
            installPrompt.classList.remove('translate-x-[150%]', 'opacity-0'); 
            installPrompt.classList.add('translate-x-0', 'opacity-100'); 
        }, 2000); 
    }
}

function tutupNotifPWA() { 
    if(installPrompt) { 
        installPrompt.classList.remove('translate-x-0', 'opacity-100'); 
        installPrompt.classList.add('translate-x-[150%]', 'opacity-0'); 
    } 
}

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => { 
            if (choiceResult.outcome === 'accepted') { tutupNotifPWA(); } 
            deferredPrompt = null; 
        });
    }
}

window.addEventListener('appinstalled', (evt) => { tutupNotifPWA(); });

// ---------------------------------------------------------
// 6. FUNGSI DATABASE SANTRI & FORM
// ---------------------------------------------------------
function openModalSantri() { 
    let nextNis = "001"; 
    if (GLOBAL_DATA_SANTRI && GLOBAL_DATA_SANTRI.length > 0) {
        let maxNis = 0;
        let panjangKarakter = 3; 
        
        GLOBAL_DATA_SANTRI.forEach(s => {
            let nisStr = s.nis.toString().trim();
            if(nisStr.length > panjangKarakter) panjangKarakter = nisStr.length;
            
            let nisAngka = parseInt(nisStr.replace(/\D/g, '')); 
            if (!isNaN(nisAngka) && nisAngka > maxNis) {
                maxNis = nisAngka;
            }
        });
        
        nextNis = (maxNis + 1).toString().padStart(panjangKarakter, '0');
    }

    const inputNis = document.getElementById('add_nis');
    const labelNis = document.getElementById('labelNisRole');
    inputNis.value = nextNis;

    const userRole = document.getElementById('userRoleDisplay').innerText;
    if (userRole.includes('Guru')) {
        inputNis.readOnly = true;
        inputNis.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        labelNis.innerText = "(Otomatis)";
    } else {
        inputNis.readOnly = false;
        inputNis.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        labelNis.innerText = "(Bisa diedit Admin)";
    }

    window.history.pushState({ modal: 'tambah' }, "", "#modalTambah"); 
    document.getElementById('modalTambahSantri').classList.remove('hidden'); 
}

function closeModalSantri() { 
    if (window.location.hash === "#modalTambah") {
        window.history.back(); 
    } else {
        document.getElementById('modalTambahSantri').classList.add('hidden'); 
        document.getElementById('formTambahSantri').reset(); 
        if(document.getElementById('text_add_kelas')) document.getElementById('text_add_kelas').innerText = 'Pilih...';
    }
}

function closeModalImportSantri() {
    if (window.location.hash === "#modalImport") {
        window.history.back(); 
    } else {
        document.getElementById('modalImportSantri').classList.add('hidden');
        document.getElementById('formImportSantri').reset();
    }
}

function closeModalEditSantri() { 
    document.getElementById('modalEditSantri').classList.add('hidden'); 
    document.getElementById('formEditSantri').reset(); 
    if(document.getElementById('text_edit_kelas')) document.getElementById('text_edit_kelas').innerText = 'Pilih...';
    if (window.location.hash === "#modalEdit") window.history.back(); 
}


function openModalImportSantri() {
    window.history.pushState({ modal: 'import' }, "", "#modalImport"); 
    document.getElementById('modalImportSantri').classList.remove('hidden');
    document.getElementById('fileImportCSV').value = '';
    document.getElementById('namaFileCsv').innerText = '';
}

// =================================================================
// REVISI FINAL IMPORT EXCEL (ANTI BERKEDIP & AUTO REFRESH)
// =================================================================
const formImport = document.getElementById('formImportSantri');
if (formImport) {
    formImport.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('fileImportCSV');
        if (!fileInput || !fileInput.files.length) {
            return Swal.fire('Perhatian', 'Pilih file Excel (.xlsx) terlebih dahulu!', 'warning');
        }

        const btnSubmit = this.querySelector('button[type="submit"]');
        const btnBatal = this.querySelector('button[type="button"]');
        const originalText = btnSubmit.innerHTML;

        // 1. Kunci tombol
        btnSubmit.disabled = true;
        btnSubmit.classList.add('pointer-events-none', 'opacity-70');
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Memproses...';
        if (btnBatal) btnBatal.disabled = true;

        // 2. Gunakan loading bawaan UI Madasa agar seragam
        showLoading(true);

        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
                
                if (jsonData.length > 0 && isNaN(parseInt(jsonData[0][0]))) {
                    jsonData.shift(); 
                }
                
                jsonData = jsonData.filter(row => row && row.length > 0 && row[0] !== undefined && row[0] !== "");

                if (jsonData.length === 0) {
                    showLoading(false);
                    btnSubmit.disabled = false;
                    btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
                    btnSubmit.innerHTML = originalText;
                    if (btnBatal) btnBatal.disabled = false;
                    return Swal.fire('Error Excel', 'File Excel kosong atau format tidak sesuai.', 'error');
                }

                const formData = new URLSearchParams();
                formData.append('action', 'importSantriBulk');
                formData.append('data_import', JSON.stringify(jsonData));
                formData.append('token', sessionStorage.getItem('tokenMadasa'));

                gasFetch( { method: 'POST', body: formData })
                .then(res => res.json())
                .then(data => {
                    // Matikan loading
                    showLoading(false);
                    
                    // Kembalikan status tombol
                    btnSubmit.disabled = false;
                    btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
                    btnSubmit.innerHTML = originalText;
                    if (btnBatal) btnBatal.disabled = false;

                    if (data.status === 'success') {
                        // 3. TUTUP MODAL SECARA MANUAL (Tanpa memicu popstate yang mematikan notifikasi)
                        document.getElementById('modalImportSantri').classList.add('hidden');
                        document.getElementById('formImportSantri').reset();
                        
                        if (window.location.hash === "#modalImport") {
                            // Ganti URL hash tanpa memicu event window back
                            window.history.replaceState({ view: 'dataSantri' }, "", "#dataSantri");
                        }

                        // 4. TAMPILKAN TOAST SUKSES (Tampil di kanan atas tanpa mengganggu layar)
                        Swal.fire({ 
                            toast: true, 
                            position: 'top-end', 
                            icon: 'success', 
                            title: data.message, 
                            showConfirmButton: false, 
                            timer: 3500 
                        });
                        
                        // 5. MUAT ULANG TABEL SECARA DIAM-DIAM (Tanpa loading screen putih yang menutupi tabel)
                        loadDataSantri(true);
                        
                    } else {
                        Swal.fire('Gagal Import', data.message, 'error');
                    }
                })
                .catch(err => {
                    showLoading(false);
                    btnSubmit.disabled = false;
                    btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
                    btnSubmit.innerHTML = originalText;
                    if (btnBatal) btnBatal.disabled = false;
                    Swal.fire('Error Network', 'Gagal terhubung ke database server.', 'error');
                });

            } catch (error) {
                showLoading(false);
                btnSubmit.disabled = false;
                btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
                btnSubmit.innerHTML = originalText;
                if (btnBatal) btnBatal.disabled = false;
                Swal.fire('Error Format', 'Gagal membaca file. Pastikan formatnya .xlsx', 'error');
            }
        };

        reader.readAsArrayBuffer(file);
    });
}

function reverseTanggalIndo(teksTanggal) {
    if (!teksTanggal || !teksTanggal.includes(',')) return "";
    let parts = teksTanggal.split(',');
    if (parts.length < 2) return "";
    
    let tglArr = parts[1].trim().split(/\s+/);
    if (tglArr.length !== 3) return "";

    let bulanMap = {
        "Januari": "01", "Februari": "02", "Maret": "03", "April": "04",
        "Mei": "05", "Juni": "06", "Juli": "07", "Agustus": "08",
        "September": "09", "Oktober": "10", "November": "11", "Desember": "12"
    };
    
    let hari = tglArr[0].padStart(2, '0');
    let bulan = bulanMap[tglArr[1]];
    let tahun = tglArr[2];

    if (hari && bulan && tahun) return `${tahun}-${bulan}-${hari}`;
    return "";
}

function openModalEditSantri(nis, nama, jk, kelas, alamat, ayah, ibu, hp, ttl) { 
    document.getElementById('edit_nis_lama').value = nis; 
    document.getElementById('edit_nis').value = nis; 
    
    document.getElementById('edit_nama').value = nama; 
    
    // ========================================================
    // PERBAIKAN: Normalisasi Jenis Kelamin (Case Insensitive)
    // ========================================================
    let jkBersih = jk ? jk.toString().trim().toLowerCase() : "";
    if (jkBersih === "l" || jkBersih === "laki-laki" || jkBersih === "laki - laki") {
        document.getElementById('edit_jk').value = "Laki-laki";
    } else if (jkBersih === "p" || jkBersih === "perempuan") {
        document.getElementById('edit_jk').value = "Perempuan";
    } else {
        document.getElementById('edit_jk').value = jk; // Fallback
    }
    // ========================================================

    document.getElementById('edit_kelas').value = kelas; 
    document.getElementById('text_edit_kelas').innerText = kelas;
    document.getElementById('edit_alamat').value = alamat; 
    document.getElementById('edit_ayah').value = ayah; 
    document.getElementById('edit_ibu').value = ibu; 
    document.getElementById('edit_hp').value = hp; 
    
    if (ttl && ttl.includes(',')) {
        let parts = ttl.split(',');
        document.getElementById('edit_tempat_lahir').value = parts[0].trim();
        document.getElementById('edit_tanggal_lahir').value = reverseTanggalIndo(ttl);
    } else {
        document.getElementById('edit_tempat_lahir').value = ttl || "";
        document.getElementById('edit_tanggal_lahir').value = "";
    }

    const userRole = document.getElementById('userRoleDisplay').innerText;
    const inputNisEdit = document.getElementById('edit_nis');
    const labelNisEdit = document.getElementById('labelEditNisRole');

    if (userRole.includes('Guru')) {
        inputNisEdit.readOnly = true;
        inputNisEdit.classList.add('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        labelNisEdit.innerText = "(Terkunci)";
        labelNisEdit.classList.replace('text-blue-500', 'text-red-500');
    } else {
        inputNisEdit.readOnly = false;
        inputNisEdit.classList.remove('bg-gray-100', 'text-gray-500', 'cursor-not-allowed');
        labelNisEdit.innerText = "(Bisa diedit Admin)";
        labelNisEdit.classList.replace('text-red-500', 'text-blue-500');
    }

    window.history.pushState({ modal: 'edit' }, "", "#modalEdit"); 
    document.getElementById('modalEditSantri').classList.remove('hidden'); 
}

function filterSantri() { 
    const searchText = document.getElementById('searchSantri').value.toLowerCase(); 
    const selectedKelas = document.getElementById('filterKelasSantri').value; 
    const rows = document.querySelectorAll('.santri-row'); 
    let visibleCount = 0; 
    
    rows.forEach(row => { 
        const nis = row.cells[1].innerText.toLowerCase(); 
        const nama = row.cells[2].innerText.toLowerCase(); 
        const kelas = row.getAttribute('data-kelas'); 
        const matchSearch = nama.includes(searchText) || nis.includes(searchText); 
        
        // MODIFIKASI: Filter khusus untuk menyembunyikan Alumni/DO dari tampilan "Semua"
        let matchKelas = false;
        if (selectedKelas === 'Semua') {
            const kelasLower = kelas.toLowerCase();
            // Jika filter "Semua", jangan tampilkan yang sudah Lulus/Alumni atau DO
            if (!kelasLower.includes('lulus') && !kelasLower.includes('alumni') && !kelasLower.includes('diberhentikan')) {
                matchKelas = true;
            }
        } else {
            // Jika filter kelas spesifik dipilih (termasuk jika sengaja memilih Lulus/Alumni)
            matchKelas = (kelas === selectedKelas);
        }
        
        if (matchSearch && matchKelas) { 
            row.style.display = ''; 
            visibleCount++; 
            // Update penomoran otomatis
            row.cells[0].innerText = visibleCount;
        } 
        else { 
            row.style.display = 'none'; 
        } 
    }); 
    
    const tabelContainer = document.getElementById('tabelSantri').parentElement; 
    const noDataPesan = document.getElementById('noDataPesan'); 
    
    if (visibleCount === 0) { 
        tabelContainer.classList.add('hidden'); noDataPesan.classList.remove('hidden'); 
    } else { 
        tabelContainer.classList.remove('hidden'); noDataPesan.classList.add('hidden'); 
    } 
}


// === FITUR TAMBAH SANTRI DENGAN PEMERIKSAAN KELAS DIPERBAIKI ===
document.getElementById('formTambahSantri').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    
    // --- KODE REVISI (DIPERBAIKI SINKRON KE add_kelas) ---
    const cekKelas = document.getElementById('add_kelas').value;
    if (!cekKelas || cekKelas === "") {
        Swal.fire('Perhatian', 'Silakan pilih Penempatan Kelas terlebih dahulu!', 'warning');
        return; 
    }

    const btnSubmit = this.querySelector('button[type="submit"]'); 
    const originalText = btnSubmit.innerHTML; 
    btnSubmit.disabled = true; btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; 
    showLoading(true);
    
    const formData = new URLSearchParams();
    formData.append('action', 'addSantri');
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    formData.append('nis', document.getElementById('add_nis').value);
    formData.append('nama', document.getElementById('add_nama').value); 
    formData.append('jk', document.getElementById('add_jk').value); 
    formData.append('kelas', document.getElementById('add_kelas').value); 
    formData.append('alamat', document.getElementById('add_alamat').value); 
    formData.append('ayah', document.getElementById('add_ayah').value); 
    formData.append('ibu', document.getElementById('add_ibu').value); 
    formData.append('hp', document.getElementById('add_hp').value); 
    
    const tempatTambah = document.getElementById('add_tempat_lahir').value;
    const tglTambah = formatTanggalIndo(document.getElementById('add_tanggal_lahir').value);
    formData.append('ttl', `${tempatTambah}, ${tglTambah}`);
    
    gasFetch( { method: 'POST', body: formData }).then(res => res.json()).then(data => { 
        showLoading(false); btnSubmit.disabled = false; btnSubmit.innerHTML = originalText; 
        if(data.status === 'success') { 
            closeModalSantri(); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: data.message, showConfirmButton: false, timer: 3000 });
            loadDataSantri(true); 
        } 
        else { Swal.fire('Gagal', data.message, 'error'); }
    }).catch(err => { 
        showLoading(false); btnSubmit.disabled = false; btnSubmit.innerHTML = originalText; Swal.fire('Error', 'Gagal mengirim data.', 'error'); 
    }); 
});

document.getElementById('formEditSantri').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    
    const cekKelas = document.getElementById('edit_kelas').value;
    if (!cekKelas || cekKelas === "") {
        Swal.fire('Perhatian', 'Silakan pilih Penempatan Kelas terlebih dahulu!', 'warning');
        return; 
    }

    const btnSubmit = this.querySelector('button[type="submit"]');
    const btnBatal = this.querySelector('button[type="button"]'); 
    const btnClose = document.querySelector('#modalEditSantri button[onclick="closeModalEditSantri()"]');
    
    const originalText = btnSubmit.innerHTML; 
    
    btnSubmit.disabled = true; 
    btnSubmit.classList.add('pointer-events-none', 'cursor-not-allowed');
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memperbarui...'; 
    
    if(btnBatal) { 
        btnBatal.disabled = true; 
        btnBatal.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); 
    }
    if(btnClose) { 
        btnClose.disabled = true; 
        btnClose.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); 
    }
    
    showLoading(true); 
    
    const formData = new URLSearchParams();
    formData.append('action', 'updateSantri');
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    formData.append('nis_lama', document.getElementById('edit_nis_lama').value);
    formData.append('nis', document.getElementById('edit_nis').value);
    formData.append('nama', document.getElementById('edit_nama').value); 
    formData.append('jk', document.getElementById('edit_jk').value); 
    formData.append('kelas', document.getElementById('edit_kelas').value); 
    formData.append('alamat', document.getElementById('edit_alamat').value); 
    formData.append('ayah', document.getElementById('edit_ayah').value); 
    formData.append('ibu', document.getElementById('edit_ibu').value); 
    formData.append('hp', document.getElementById('edit_hp').value); 
    
    const tempatEdit = document.getElementById('edit_tempat_lahir').value;
    const tglEdit = formatTanggalIndo(document.getElementById('edit_tanggal_lahir').value);
    formData.append('ttl', `${tempatEdit}, ${tglEdit}`);
    
    gasFetch( { method: 'POST', body: formData }).then(res => res.json()).then(data => { 
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 
        
        if(btnBatal) { btnBatal.disabled = false; btnBatal.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        if(btnClose) { btnClose.disabled = false; btnClose.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        
        if(data.status === 'success') { 
            closeModalEditSantri(); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: data.message, showConfirmButton: false, timer: 3000 });
            loadDataSantri(true); 
        } 
        else { 
            Swal.fire('Gagal', data.message, 'error'); 
        }
	   
    }).catch(err => { 
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 
        
        if(btnBatal) { btnBatal.disabled = false; btnBatal.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        if(btnClose) { btnClose.disabled = false; btnClose.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        
        Swal.fire('Error', 'Gagal update data. Periksa jaringan Anda.', 'error'); 
    }); 
});

function validasiInputNilai(el) { 
    let val = parseFloat(el.value); 
    if (el.value !== "" && (val < 0 || val > 100)) { 
        el.classList.add('border-red-500', 'bg-red-50', 'ring-2', 'ring-red-500'); 
        Swal.fire({ toast: true, position: 'top-end', icon: 'warning', title: 'Nilai 0 - 100', showConfirmButton: false, timer: 2000 }); 
    } else { 
        el.classList.remove('border-red-500', 'bg-red-50', 'ring-2', 'ring-red-500'); 
    } 
}


// V16: sinkronkan input angka dengan status ketidakhadiran.
// Jika status dipilih, angka dikosongkan dan dinonaktifkan. Jika status dibatalkan, input aktif kembali.
function sinkronStatusNilaiSelect(selectEl) {
    const wadah = selectEl.closest('td');
    if (!wadah) return;
    const input = wadah.querySelector('.input-ibt');
    if (!input) return;
    if (selectEl.value) {
        input.value = '';
        input.disabled = true;
        input.classList.remove('border-red-500', 'bg-red-50', 'ring-2', 'ring-red-500');
    } else {
        input.disabled = false;
        setTimeout(() => input.focus(), 0);
    }
}

function aktifkanFilterKedua() { 
    const kelas = document.getElementById('pilihKelasNilai').value; 
    const wadahFilter2 = document.getElementById('wadahFilterKedua'); 
    const selectFilter2 = document.getElementById('pilihFilterKedua'); 
    const labelFilter2 = document.getElementById('labelFilterKedua'); 
    
    document.getElementById('formInputNilaiBulk').classList.add('hidden'); 
    
    if (kelas) { 
        wadahFilter2.classList.remove('hidden'); 
        selectFilter2.innerHTML = '<option value="" disabled selected>-- Pilih --</option>'; 
        
        if (kelas.includes('TK')) { 
            labelFilter2.innerHTML = '<i class="fas fa-calendar-alt text-emerald-600 mr-2"></i> Penilaian Hari Apa?'; 
            const hari = ['Sabtu', 'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis']; 
            hari.forEach(h => selectFilter2.innerHTML += `<option value="${h}">${h}</option>`); 
        } else {
            labelFilter2.innerHTML = '<i class="fas fa-book text-blue-600 mr-2"></i> Untuk Pelajaran Apa?';
            
            const dataMapel = JADWAL_MAPEL[kelas] || { tulis: [], praktek: [], baca: [] };
            
            let htmlTulis = ''; let htmlPraktek = ''; let htmlMembaca = '';
            
            if(dataMapel.tulis) dataMapel.tulis.forEach(m => htmlTulis += `<option value="${m}">${m}</option>`);
            if(dataMapel.praktek) dataMapel.praktek.forEach(m => htmlPraktek += `<option value="${m}">${m}</option>`);
            if(dataMapel.baca) dataMapel.baca.forEach(m => htmlMembaca += `<option value="${m}">${m}</option>`);
            
            if(htmlTulis) selectFilter2.innerHTML += `<optgroup label="A. UJIAN TERTULIS">${htmlTulis}</optgroup>`;
            if(htmlPraktek) selectFilter2.innerHTML += `<optgroup label="B. UJIAN PRAKTEK">${htmlPraktek}</optgroup>`;
            if(htmlMembaca) selectFilter2.innerHTML += `<optgroup label="C. UJIAN MEMBACA">${htmlMembaca}</optgroup>`;
        }
    } 
}

// =========================================================
// FUNGSI HIGHLIGHT BARIS SAAT INPUT NILAI DIFOKUSKAN (BARU)
// =========================================================
function sorotBaris(inputEl, isFocus) {
    let tr = inputEl.closest('tr');
    if (!tr) return;
    
    // Pastikan kita menargetkan kolom "Nama" secara absolut (index ke-2)
    let tdNama = tr.children[2];
    
    if (isFocus) {
        tr.classList.add('bg-emerald-100'); 
        if (tdNama) {
            tdNama.classList.remove('bg-white', 'group-hover:bg-emerald-50');
            tdNama.classList.add('bg-emerald-100');
        }
    } else {
        tr.classList.remove('bg-emerald-100'); 
        if (tdNama) {
            tdNama.classList.remove('bg-emerald-100');
            tdNama.classList.add('bg-white', 'group-hover:bg-emerald-50');
        }
    }
}

// =========================================================
// FUNGSI RENDER TABEL INPUT NILAI (DIUPGRADE: KUNCI PRIVASI & CONTRENG)
// =========================================================
async function generateTabelAbsen() { 
    const kelas = document.getElementById('pilihKelasNilai').value; 
    const subFilterValue = document.getElementById('pilihFilterKedua').value; 
    const santriKelasIni = GLOBAL_DATA_SANTRI.filter(s => s.kelas === kelas); 
    const tbody = document.getElementById('bodyTabelAbsen'); 
    const wadahGlobalMapelTK = document.getElementById('wadahGlobalMapelTK'); 
    
    if (!kelas || !subFilterValue) return;

    showLoading(true, "Memeriksa Data Tersimpan...");

    let mapNilaiLama = {};
    let mapStatusNilai = {};
    const bersihTeks = (str) => String(str === null || str === undefined ? '' : str)
        .toLowerCase()
        .replace(/[\u2018\u2019'`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const bersihNis = (str) => String(str === null || str === undefined ? '' : str)
        .replace(/^'+/, '')
        .trim();

    // V16: untuk menentukan tanda centang, kita hanya membutuhkan STATUS
    // apakah nilai sudah tersimpan. Pembacaan status memakai JSONP read-only,
    // sehingga tidak terganggu CORS redirect ContentService Apps Script.
    try {
        const token = sessionStorage.getItem('tokenMadasa') || '';
        const paramsStatus = {
            token: token,
            kelas: kelas
        };

        if (kelas.includes('TK')) {
            paramsStatus.hari = subFilterValue;
        } else {
            paramsStatus.mapel = subFilterValue;
        }

        const resStatus = await gasJsonp('getStatusNilai', paramsStatus, 15000);

        if (!resStatus || resStatus.status !== 'success') {
            throw new Error((resStatus && resStatus.message) || 'Status nilai tidak dapat dibaca.');
        }

        if (kelas.includes('TK')) {
            const setN1 = new Set((resStatus.savedN1 || []).map(bersihNis));
            const setN2 = new Set((resStatus.savedN2 || []).map(bersihNis));
            santriKelasIni.forEach(s => {
                const nis = bersihNis(s.nis);
                if (setN1.has(nis) || setN2.has(nis)) {
                    mapNilaiLama[bersihTeks(nis)] = {
                        n1: setN1.has(nis) ? true : '',
                        n2: setN2.has(nis) ? true : ''
                    };
                }
            });
        } else {
            const setSelesai = new Set((resStatus.savedNis || []).map(bersihNis));
            const statusServer = resStatus.statusNis || {};
            santriKelasIni.forEach(s => {
                const nis = bersihNis(s.nis);
                const key = bersihTeks(nis);
                if (setSelesai.has(nis)) {
                    mapNilaiLama[key] = true;
                } else if (statusServer[nis]) {
                    mapStatusNilai[key] = String(statusServer[nis]).toUpperCase();
                }
            });
        }

        console.log(`[STATUS NILAI] ${kelas} / ${subFilterValue}: ${resStatus.count || 0} data selesai.`);
        if (resStatus.warning) console.warn('[STATUS NILAI]', resStatus.warning);
    } catch (statusError) {
        console.warn('[STATUS NILAI] JSONP gagal, mencoba pembacaan lama sebagai fallback.', statusError);

        // Fallback untuk deployment Apps Script lama yang belum memiliki getStatusNilai.
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'getDataNilai');
            formData.append('token', sessionStorage.getItem('tokenMadasa'));
            formData.append('kelas', kelas);

            const response = await gasFetch({ method: 'POST', body: formData });
            if (!response.ok) throw new Error('Respons server tidak valid.');
            const res = await response.json();

            if (res.status === 'success' && res.data && res.data.length > 0) {
                const headers = res.headers || [];
                const dataRows = res.data;

                if (kelas.includes('TK')) {
                    const idxNis = headers.findIndex(h => bersihTeks(h) === 'nis');
                    const idxHari = headers.findIndex(h => bersihTeks(h) === 'hari');
                    const idxN1 = headers.findIndex(h => bersihTeks(h).includes('nilai 1') || bersihTeks(h) === 'n1');
                    const idxN2 = headers.findIndex(h => bersihTeks(h).includes('nilai 2') || bersihTeks(h) === 'n2');

                    dataRows.forEach(row => {
                        if (idxNis > -1 && idxHari > -1 && bersihTeks(row[idxHari]) === bersihTeks(subFilterValue)) {
                            const nis = bersihTeks(bersihNis(row[idxNis]));
                            mapNilaiLama[nis] = {
                                n1: (idxN1 > -1 && row[idxN1] !== '' && row[idxN1] !== null) ? true : '',
                                n2: (idxN2 > -1 && row[idxN2] !== '' && row[idxN2] !== null) ? true : ''
                            };
                        }
                    });
                } else {
                    const idxNis = headers.findIndex(h => bersihTeks(h) === 'nis');
                    const idxMapel = headers.findIndex(h => bersihTeks(h) === bersihTeks(subFilterValue));

                    if (idxNis > -1 && idxMapel > -1) {
                        dataRows.forEach(row => {
                            const nilaiMapel = row[idxMapel];
                            if (nilaiMapel !== undefined && nilaiMapel !== null && nilaiMapel !== '') {
                                mapNilaiLama[bersihTeks(bersihNis(row[idxNis]))] = true;
                            }
                        });
                    }
                }
            }
        } catch (fallbackError) {
            console.error('[STATUS NILAI] Tidak dapat membaca status nilai tersimpan.', fallbackError);
        }
    }

    showLoading(false); 

    if (santriKelasIni.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="10" class="p-6 text-center text-red-500 font-bold"><i class="fas fa-exclamation-triangle mr-2"></i> Kelas ini masih kosong, belum ada santri.</td></tr>'; 
    } else { 
        let barisHTML = [];
        
        santriKelasIni.forEach((s, idx) => { 
            // PERBAIKAN BUG: Pastikan NIS dibersihkan dari tanda kutip sebelum dicocokkan
            let nisBersih = bersihTeks(bersihNis(s.nis));
            let html = `<tr class="group hover:bg-emerald-50 transition-colors duration-200 santri-absen-row"> <td class="p-3 text-center text-gray-500 font-medium border-r border-gray-200">${idx + 1}</td>`; 
            
            if (kelas.includes('TK')) { 
                let valN1 = mapNilaiLama[nisBersih] !== undefined ? mapNilaiLama[nisBersih].n1 : "";
                let valN2 = mapNilaiLama[nisBersih] !== undefined ? mapNilaiLama[nisBersih].n2 : "";
                
                // Render logika UI untuk mengecek valN1 dan valN2
                let colN1 = valN1 !== "" 
                    ? `<div class="w-16 sm:w-20 mx-auto bg-gray-100 border border-gray-200 rounded-lg p-2 flex items-center justify-center cursor-not-allowed" title="Selesai Diinput"><i class="fas fa-check-circle text-emerald-500 text-lg"></i><span class="text-[10px] font-bold text-gray-400">Selesai</span></div>` 
                    : `<input type="number" class="input-tk-n1 w-16 sm:w-20 mx-auto block p-2 border border-emerald-300 rounded-lg font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 bg-white" data-nis="${s.nis}" placeholder="N1" oninput="validasiInputNilai(this)" onfocus="sorotBaris(this, true)" onblur="sorotBaris(this, false)">`;
                
               let colN2 = valN2 !== "" 
    ? `<div class="w-16 sm:w-20 mx-auto bg-gray-100 border border-gray-200 rounded-lg p-2 flex items-center justify-center cursor-not-allowed" title="Selesai Diinput"><i class="fas fa-check-circle text-emerald-500 text-lg"></i><span class="text-[10px] font-bold text-gray-400">Selesai</span></div>` 
    : `<input type="number" class="input-tk-n2 w-16 sm:w-20 mx-auto block p-2 border border-emerald-300 rounded-lg font-bold text-center outline-none focus:ring-2 focus:ring-emerald-500 bg-white" data-nis="${s.nis}" placeholder="N2" oninput="validasiInputNilai(this)" onfocus="sorotBaris(this, true)" onblur="sorotBaris(this, false)">`;
                
                html += `<td class="p-3 text-sm border-r border-gray-200 text-gray-500 whitespace-nowrap">${s.nis}</td> <td class="p-3 border-r border-gray-200 md:sticky md:left-0 bg-white group-hover:bg-emerald-50 z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] max-w-[200px] transition-colors duration-200"> <p class="font-bold text-gray-800 whitespace-normal text-xs sm:text-sm leading-snug">${s.nama}</p> </td> <td class="p-2 border-r border-gray-200 bg-gray-50/50">${colN1}</td> <td class="p-2 bg-gray-50/50">${colN2}</td>`; 
            } else { 
                document.getElementById('judulKolomNilai').innerText = `NILAI ${subFilterValue}`;
                let valMapel = mapNilaiLama[nisBersih] !== undefined ? mapNilaiLama[nisBersih] : "";
                let statusMapel = mapStatusNilai[nisBersih] || "";
                
                // V16: angka 0 adalah nilai sah. Nilai kosong dapat diberi status Tidak Hadir / Menunggu Susulan.
                let colMapel;
                if (valMapel !== "") {
                    colMapel = `<div class="w-full min-w-[110px] max-w-[150px] mx-auto bg-gray-100 border-2 border-gray-200 rounded-lg p-2 flex items-center justify-center gap-2 cursor-not-allowed shadow-inner" title="Privasi: Nilai sudah diinput"><i class="fas fa-check-circle text-emerald-500 text-lg"></i><span class="text-xs font-bold text-gray-500">Selesai</span></div>`;
                } else {
                    const labelStatus = statusMapel === 'TIDAK_HADIR' ? 'Tidak Hadir' : (statusMapel === 'MENUNGGU_SUSULAN' ? 'Menunggu Susulan' : 'Status...');
                    colMapel = `
                        <div class="min-w-[150px] max-w-[180px] mx-auto space-y-1.5">
                            <input type="number" class="input-ibt w-full block p-2 border-2 border-emerald-400 rounded-lg font-bold text-center text-emerald-700 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500 shadow-inner outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200" data-nis="${escapeHTML(s.nis)}" data-nama="${escapeHTML(s.nama)}" placeholder="0-100" ${statusMapel ? 'disabled' : ''} oninput="validasiInputNilai(this)" onfocus="sorotBaris(this, true)" onblur="sorotBaris(this, false)">
                            <select class="status-ibt w-full text-[10px] sm:text-xs p-1.5 border rounded-lg bg-white font-semibold ${statusMapel ? 'border-amber-300 text-amber-700' : 'border-gray-200 text-gray-500'}" data-nis="${escapeHTML(s.nis)}" data-nama="${escapeHTML(s.nama)}" data-original="${statusMapel}" onchange="sinkronStatusNilaiSelect(this)">
                                <option value="" ${!statusMapel ? 'selected' : ''}>${statusMapel ? 'Batalkan status / input susulan' : 'Status...'}</option>
                                <option value="TIDAK_HADIR" ${statusMapel === 'TIDAK_HADIR' ? 'selected' : ''}>Tidak Hadir</option>
                                <option value="MENUNGGU_SUSULAN" ${statusMapel === 'MENUNGGU_SUSULAN' ? 'selected' : ''}>Menunggu Susulan</option>
                            </select>
                            ${statusMapel ? `<div class="text-[10px] font-bold text-amber-700"><i class="fas fa-clock mr-1"></i>${labelStatus}</div>` : ''}
                        </div>`;
                }
                
                html += `<td class="p-3 text-sm border-r border-gray-200 text-gray-500 whitespace-nowrap">${s.nis}</td> <td class="p-3 border-r border-gray-200 md:sticky md:left-0 bg-white group-hover:bg-emerald-50 z-10 md:shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] min-w-[140px] max-w-[200px] transition-colors duration-200"> 
                <p class="font-bold text-gray-800 whitespace-normal text-xs sm:text-sm leading-snug">${escapeHTML(s.nama)}</p> </td> <td class="p-3 text-center bg-gray-50/50">${colMapel}</td>`; 
            } 
            html += `</tr>`; 
            
            barisHTML.push(html);
        }); 
        
        tbody.innerHTML = barisHTML.join('');
    } 
    
    // Setup Visual Header & Footer (Tetap dipertahankan)
    if (kelas.includes('TK')) { 
        document.getElementById('headerTK').style.display = 'table-header-group'; 
        document.getElementById('headerIBT').style.display = 'none'; 
        wadahGlobalMapelTK.classList.remove('hidden'); 
        document.getElementById('petunjukPredikatTK').classList.remove('hidden');
        document.getElementById('peringatanNilaiIbt').classList.add('hidden');
    } else { 
        document.getElementById('headerTK').style.display = 'none'; 
        document.getElementById('headerIBT').style.display = 'table-header-group'; 
        wadahGlobalMapelTK.classList.add('hidden'); 
        document.getElementById('petunjukPredikatTK').classList.add('hidden');
        document.getElementById('peringatanNilaiIbt').classList.remove('hidden');
    } 
    document.getElementById('formInputNilaiBulk').classList.remove('hidden'); 
}

document.getElementById('formInputNilaiBulk').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    if (this.querySelectorAll('.border-red-500').length > 0) { 
        Swal.fire({ icon: 'error', title: 'Data Invalid', text: 'Pastikan angka nilai 0 - 100.' }); 
        return; 
    } 
    
    const kelasPilih = document.getElementById('pilihKelasNilai').value; 
    const filterKedua = document.getElementById('pilihFilterKedua').value; 
    let paketBulk = []; 
    
if (kelasPilih.includes('TK')) { 
        const globalM1 = document.getElementById('global_tk_m1').value; 
        const globalM2 = document.getElementById('global_tk_m2').value; 
        let adaIsianNilai = false; 
        
        document.querySelectorAll('#bodyTabelAbsen tr.santri-absen-row').forEach(tr => { 
            const n1Input = tr.querySelector('.input-tk-n1'); 
            const n2Input = tr.querySelector('.input-tk-n2'); 
            
            // Bypass aman: Jika N1 dan N2 sudah "Selesai" (bukan input lagi), lewati baris ini
            if (!n1Input && !n2Input) return;

            // Ambil NIS dan Nama dengan aman langsung dari teks kolom tabel
            const nis = tr.cells[1].innerText.trim();
            const nama = tr.cells[2].innerText.trim();
            
            // Cek isi nilai dengan aman
            const n1 = n1Input ? n1Input.value : ""; 
            const n2 = n2Input ? n2Input.value : ""; 

            if(n1 !== "" || n2 !== "") { 
                adaIsianNilai = true; 
                let total = (parseFloat(n1)||0) + (parseFloat(n2)||0); 
                let count = 0; 
                if(n1!=="") count++; 
                if(n2!=="") count++; 
                let rata = count > 0 ? (total/count).toFixed(2) : 0; 
                
                paketBulk.push({ nis: nis, nama: nama, m1: globalM1, n1: n1, m2: globalM2, n2: n2, total: total, rata: rata }); 
            } 
        }); 
        
        if (adaIsianNilai && globalM1 === "") { Swal.fire({ icon: 'warning', title: 'Mapel 1 Kosong', text: 'Tolong isi Nama Mapel 1.'}); return; } 
    } else { 
        document.querySelectorAll('.input-ibt').forEach(input => {
            if (!input.disabled && input.value !== "") {
                paketBulk.push({ nis: input.getAttribute('data-nis'), nama: input.getAttribute('data-nama'), nilai: input.value });
            }
        }); 
    }

    // Status disimpan terpisah agar kosong/tidak hadir tidak pernah berubah menjadi nilai 0.
    let paketStatus = [];
    if (!kelasPilih.includes('TK')) {
        document.querySelectorAll('.status-ibt').forEach(select => {
            const original = select.getAttribute('data-original') || '';
            const sekarang = select.value || '';
            if (original !== sekarang) {
                paketStatus.push({
                    nis: select.getAttribute('data-nis'),
                    nama: select.getAttribute('data-nama'),
                    status: sekarang
                });
            }
        });
    }
    
    if (paketBulk.length === 0 && paketStatus.length === 0) { Swal.fire({ icon: 'warning', title: 'Belum Ada Perubahan', text: 'Masukkan nilai atau pilih status santri terlebih dahulu.'}); return; } 
    
    const btnSubmit = this.querySelector('button[type="submit"]'); 
    const originalText = btnSubmit.innerHTML; 
    
    btnSubmit.disabled = true; 
    btnSubmit.classList.add('pointer-events-none', 'opacity-70');
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...'; 
    showLoading(true); 
    
    const formData = new URLSearchParams();
    formData.append('action', 'simpanNilai');
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    formData.append('kelas', kelasPilih);
    formData.append('list_nilai', JSON.stringify(paketBulk)); 
    
    if (kelasPilih.includes('TK')) { 
        formData.append('hari', filterKedua); 
    } else { 
        formData.append('mapel', filterKedua); 
        formData.append('semua_mapel', JSON.stringify(JADWAL_MAPEL[kelasPilih].semua)); 
    }
    
    const requests = [];
    if (paketBulk.length > 0) {
        requests.push(
            gasFetch({ method: 'POST', body: formData })
                .then(res => res.json())
                .then(data => { if (data.status !== 'success') throw new Error(data.message || 'Gagal menyimpan nilai.'); return data; })
        );
    }

    if (!kelasPilih.includes('TK') && paketStatus.length > 0) {
        paketStatus.forEach(item => {
            const fdStatus = new URLSearchParams();
            fdStatus.append('action', 'simpanStatusNilai');
            fdStatus.append('token', sessionStorage.getItem('tokenMadasa'));
            fdStatus.append('kelas', kelasPilih);
            fdStatus.append('mapel', filterKedua);
            fdStatus.append('nis', item.nis);
            fdStatus.append('nama', item.nama || '');
            fdStatus.append('status', item.status);
            requests.push(
                gasFetch({ method: 'POST', body: fdStatus })
                    .then(res => res.json())
                    .then(data => { if (data.status !== 'success') throw new Error(data.message || 'Gagal menyimpan status.'); return data; })
            );
        });
    }

    Promise.all(requests).then(async results => {
        showLoading(false);
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
        btnSubmit.innerHTML = originalText;

        await generateTabelAbsen();
        Swal.fire({
            icon: 'success',
            title: 'Sukses!',
            text: `Perubahan berhasil disimpan. Nilai 0 tetap dihitung sebagai nilai sah.`,
            confirmButtonColor: '#059669'
        });
    }).catch(err => {
        console.error('[INPUT NILAI V16]', err);
        showLoading(false);
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('pointer-events-none', 'opacity-70');
        btnSubmit.innerHTML = originalText;
        Swal.fire('Error', err.message || 'Gagal kirim. Periksa jaringan Anda.', 'error');
    }); 
});

// =========================================================
// FUNGSI LOAD DATA NILAI KELAS (DIPERBAIKI DENGAN AUTO-RETRY)
// =========================================================
function loadDataNilaiKelas(silent = false) { 
    const kelasPilih = document.getElementById('filterKelasDataNilai').value; 
    if (!kelasPilih) { Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Silakan pilih kelas terlebih dahulu.' }); return; } 
    
    if (!silent) showLoading(true); 
    
    const formData = new URLSearchParams();
    formData.append('action', 'getDataNilai');
    formData.append('token', sessionStorage.getItem('tokenMadasa')); 
    formData.append('kelas', kelasPilih); 
    
    // Mekanisme Auto-Retry (Coba lagi otomatis jika Google 404)
    const tarikDataNilai = async (retry = 3) => {
        for (let i = 0; i < retry; i++) {
            try {
                let req = await gasFetch( { method: 'POST', body: formData });
                if (!req.ok) throw new Error("Server Sibuk");
                let res = await req.json();
                return res; // Kembalikan data jika sukses
            } catch (e) {
                if (i === retry - 1) throw e; // Lempar error jika percobaan habis
                console.warn(`Server Google merespons 404/Error saat memuat nilai, mencoba ulang... (Percobaan ${i + 1})`);
                // Tunggu 1 detik sebelum mencoba lagi
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    };

    tarikDataNilai().then(res => { 
        if (!silent) showLoading(false); 
        if (res.status === 'success') { renderTabelDataNilai(res.headers, res.data); } 
        else { if (!silent) Swal.fire('Gagal', res.message || 'Gagal memuat data nilai.', 'error'); } 
    }).catch(err => { 
        if (!silent) showLoading(false); 
        if (!silent) Swal.fire('Error', 'Koneksi ke server gagal. Server Google sedang sibuk.', 'error'); 
    }); 
}

// =========================================================
// FUNGSI RENDER TABEL DATA NILAI (DITAMBAH TOMBOL HAPUS ADMIN)
// =========================================================
function renderTabelDataNilai(headers, data) { 
    GLOBAL_HEADERS_NILAI = headers; 
    GLOBAL_DATA_NILAI = data; 
    const thead = document.getElementById('headerDataNilai'); 
    const tbody = document.getElementById('bodyDataNilai'); 
    
    thead.innerHTML = ''; 
    let barisHTML = []; 
    
    if (!headers || headers.length === 0 || data.length === 0) { 
        tbody.innerHTML = `<tr><td colspan="15" class="p-10 text-center text-red-500 font-medium"><i class="fas fa-folder-open text-4xl mb-3 block text-red-300"></i> Belum ada data nilai yang diinput oleh Guru untuk kelas ini.</td></tr>`; 
        return; 
    } 
    
    let idxTotal = headers.findIndex(h => h.toLowerCase().includes('total'));
    let kls = document.getElementById('filterKelasDataNilai').value;

    // Cek apakah akun yang sedang login adalah Admin
    const roleSaatIni = sessionStorage.getItem('roleMadasa') || '';
    const isAdmin = !roleSaatIni.includes('Guru');

    let trHead = '<tr>'; 
    trHead += `<th class="p-3 text-center border-r border-gray-200 w-10 bg-gray-100">No</th>`; 
    headers.forEach((h) => { 
        let namaKolom = h.toLowerCase(); 
        if (namaKolom.includes('nama')) { 
            trHead += `<th class="p-3 border-r border-gray-200 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] whitespace-nowrap">${h}</th>`; 
        } else if (namaKolom.includes('nis')) { 
            trHead += `<th class="p-3 border-r border-gray-200 whitespace-nowrap w-1 bg-gray-100">${h}</th>`; 
        } else { 
            trHead += `<th class="p-3 border-r border-gray-200 text-center whitespace-nowrap bg-gray-100">${h}</th>`; 
        } 
    }); 
    trHead += `<th class="p-3 text-center bg-gray-100 w-32">AKSI</th></tr>`; 
    thead.innerHTML = trHead; 
    
    // Ambil jumlah mapel yang sah dari Master Mapel (khusus IBT/SANA/ALIYAH)
    let jmlMapelTotal = (!kls.includes('TK') && JADWAL_MAPEL[kls] && JADWAL_MAPEL[kls].semua) ? JADWAL_MAPEL[kls].semua.length : 0;

    data.forEach((row, rowIndex) => { 
        let trBody = `<tr class="hover:bg-blue-50 transition-all">`; 
        trBody += `<td class="p-3 text-center text-gray-500 border-r border-gray-200">${rowIndex + 1}</td>`; 
        
        let totalNilai = 0;
        let countTerisi = 0;
        let jumlahWajib = 0;
        let rataBenar = "-";

        // V16: hitung ulang dari sel nilai, bukan dari angka rekap lama.
        // Nilai 0 valid karena pengecekan memakai cell !== ''.
        if (kls.includes('TK')) {
            const idxNilaiTk = headers
                .map((h, i) => ({ h: String(h || '').toLowerCase(), i }))
                .filter(x => ['nilai 1','nilai 2','nilai 3','n1','n2','n3'].includes(x.h))
                .map(x => x.i);
            idxNilaiTk.forEach(i => {
                const cell = row[i];
                if (cell !== '' && cell !== null && cell !== undefined && !isNaN(Number(cell))) {
                    totalNilai += Number(cell);
                    countTerisi++;
                }
            });
            jumlahWajib = countTerisi;
        } else {
            const daftarMapel = (JADWAL_MAPEL[kls] && Array.isArray(JADWAL_MAPEL[kls].semua) && JADWAL_MAPEL[kls].semua.length)
                ? JADWAL_MAPEL[kls].semua
                : headers.slice(5);
            jumlahWajib = daftarMapel.length;
            daftarMapel.forEach(mapel => {
                const idx = headers.findIndex(h => String(h || '').trim().toLowerCase() === String(mapel || '').trim().toLowerCase());
                if (idx < 0) return;
                const cell = row[idx];
                if (cell !== '' && cell !== null && cell !== undefined && !isNaN(Number(cell))) {
                    totalNilai += Number(cell);
                    countTerisi++;
                }
            });
        }

        if (countTerisi > 0) rataBenar = (totalNilai / countTerisi).toFixed(2);
        const nilaiLengkap = kls.includes('TK') ? countTerisi > 0 : (jumlahWajib > 0 && countTerisi === jumlahWajib);
        if (idxTotal > -1) {
            row[idxTotal] = totalNilai;
            GLOBAL_DATA_NILAI[rowIndex][idxTotal] = totalNilai;
        }

        row.forEach((cell, cellIndex) => { 
            const headerName = headers[cellIndex].toLowerCase(); 
            if (headerName.includes('nama')) { 
                trBody += `<td class="p-3 border-r border-gray-200 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] font-bold text-gray-800 whitespace-nowrap">${escapeHTML(cell)}</td>`; 
            } else if (headerName.includes('nis')) { 
                let textNIS = cell.toString().replace("'", ""); 
                trBody += `<td class="p-3 border-r border-gray-200 text-gray-600 whitespace-nowrap">${escapeHTML(textNIS)}</td>`; 
            } else if (headerName.includes('rata')) {
                // GUNAKAN RATA-RATA DINAMIS YANG SUDAH KITA HITUNG DI ATAS
                trBody += `<td class="p-3 border-r border-gray-200 text-center font-bold text-blue-600 whitespace-nowrap">${rataBenar}${!nilaiLengkap && !kls.includes('TK') ? `<div class="text-[9px] text-amber-600 font-semibold mt-1">sementara ${countTerisi}/${jumlahWajib}</div>` : ''}</td>`;
                GLOBAL_DATA_NILAI[rowIndex][cellIndex] = rataBenar === '-' ? '' : rataBenar;
            } else { 
                const isNumber = !isNaN(cell) && cell !== ""; 
                trBody += `<td class="p-3 border-r border-gray-200 text-center ${isNumber ? 'font-bold text-emerald-700' : 'text-gray-400'} whitespace-nowrap">${cell}</td>`; 
            } 
        }); 
        
        // Memunculkan tombol hapus HANYA jika bukan Guru
        const tombolHapus = isAdmin ? `<button onclick="hapusSemuaNilaiSantri(${rowIndex})" class="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-all shadow-sm border border-red-200 ml-1" title="Kosongkan Semua Nilai Santri Ini"><i class="fas fa-trash-alt"></i></button>` : '';

        trBody += `<td class="p-3 text-center whitespace-nowrap flex items-center justify-center">
            <button onclick="openModalEditNilai(${rowIndex})" class="text-blue-500 hover:bg-blue-100 p-2 rounded-lg transition-all shadow-sm border border-blue-200" title="Edit Data"><i class="fas fa-edit"></i> Edit</button>
            ${tombolHapus}
        </td></tr>`; 
        
        barisHTML.push(trBody); 
    }); 
    
    tbody.innerHTML = barisHTML.join(''); 
}

// =========================================================
// FUNGSI HAPUS (KOSONGKAN) SELURUH NILAI SANTRI OLEH ADMIN
// =========================================================
function hapusSemuaNilaiSantri(index) {
    const headers = GLOBAL_HEADERS_NILAI; 
    const row = GLOBAL_DATA_NILAI[index]; 
    const kelasPilih = document.getElementById('filterKelasDataNilai').value;
    
    const idxNis = headers.findIndex(h => h.toLowerCase() === 'nis');
    const idxNama = headers.findIndex(h => h.toLowerCase().includes('nama'));
    
    const nisStr = row[idxNis].toString().replace(/'/g, "");
    const namaStr = row[idxNama];

    Swal.fire({
        title: 'Kosongkan Nilai?',
        html: `Yakin ingin mengosongkan <b>SELURUH NILAI</b> milik <b>${namaStr}</b>?<br><br><span class="text-red-500 text-xs font-bold"><i class="fas fa-exclamation-triangle"></i> Peringatan: Semua nilai mapel anak ini di kelas ${kelasPilih} akan dikosongkan dan guru harus menginput ulang.</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-trash-alt mr-1"></i> Ya, Kosongkan!',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true, "Mengosongkan Nilai...");
            
            // Membuat paket data kosong untuk semua pelajaran
            let payloadKosong = {}; 
            for(let i = 0; i < headers.length; i++) { 
                let h = headers[i]; 
                let isReadOnly = ['NIS', 'Nama Lengkap', 'Kelas', 'Hari', 'Total Nilai', 'Rata-rata'].includes(h); 
                if(!isReadOnly) { 
                    payloadKosong[h] = ""; // Mengosongkan data
                } 
            } 

            const formData = new URLSearchParams(); 
            formData.append('action', 'updateDataNilai'); 
            formData.append('kelas', kelasPilih); 
            formData.append('nis', nisStr); 
            formData.append('data_nilai', JSON.stringify(payloadKosong)); 
            formData.append('token', sessionStorage.getItem('tokenMadasa'));
            
            gasFetch( { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => { 
                showLoading(false); 
                if(data.status === 'success') { 
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Seluruh nilai berhasil dikosongkan!', showConfirmButton: false, timer: 3000 });
                    loadDataNilaiKelas(true); 
                } else { 
                    Swal.fire('Gagal', data.message, 'error'); 
                }
            }).catch(err => { 
                showLoading(false); 
                Swal.fire('Error', 'Gagal memproses data. Periksa jaringan Anda.', 'error'); 
            });
        }
    });
}

function openModalEditNilai(index) { 
    const headers = GLOBAL_HEADERS_NILAI; const row = GLOBAL_DATA_NILAI[index]; const container = document.getElementById('wadahInputEditNilai'); container.innerHTML = ''; 
    document.getElementById('edit_nilai_kelas').value = document.getElementById('filterKelasDataNilai').value; 
    for(let i = 0; i < headers.length; i++) { 
        let h = headers[i]; let val = row[i] === "" ? "" : row[i]; 
        let isReadOnly = ['NIS', 'Nama Lengkap', 'Kelas', 'Hari', 'Total Nilai', 'Rata-rata'].includes(h); 
        if(h === 'NIS') document.getElementById('edit_nilai_nis').value = val.toString().replace("'", ""); 
        let inputType = (h.includes('Mapel') || isReadOnly) ? 'text' : 'number'; 
        let html = `<div><label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1 truncate">${h} ${isReadOnly ? '<span class="text-xs text-red-500">(Terkunci)</span>' : ''}</label><input type="${inputType}" name="${h}" value="${val}" class="input-edit-nilai-dinamis w-full p-2.5 sm:p-3 border border-gray-300 rounded-xl focus:ring-blue-500 outline-none text-sm ${isReadOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'font-bold text-blue-700'}" ${isReadOnly ? 'readonly' : ''} ${inputType === 'number' && !isReadOnly ? 'oninput="validasiInputNilai(this)"' : ''}></div>`; 
        container.innerHTML += html; 
    } 

    window.history.pushState({ modal: 'editNilai' }, "", "#modalEditNilai"); 
    document.getElementById('modalEditNilai').classList.remove('hidden'); 
}

function closeModalEditNilai() {
    const modal = document.getElementById('modalEditNilai');
    const wadah = document.getElementById('wadahInputEditNilai');

    if (modal) modal.classList.add('hidden');
    if (wadah) wadah.innerHTML = '';

    if (window.location.hash === "#modalEditNilai") {
        window.history.back();
    }
}

document.getElementById('formEditNilai').addEventListener('submit', function(e) { 
    e.preventDefault(); 
    if (this.querySelectorAll('.border-red-500').length > 0) { 
        Swal.fire({ icon: 'error', title: 'Data Invalid', text: 'Pastikan angka nilai 0 - 100.' }); 
        return; 
    } 
    
    const btnSubmit = this.querySelector('button[type="submit"]'); 
    const btnBatal = this.querySelector('button[type="button"]'); 
    const btnClose = document.querySelector('#modalEditNilai button[onclick="closeModalEditNilai()"]');
    
    const originalText = btnSubmit.innerHTML; 
    
    btnSubmit.disabled = true; 
    btnSubmit.classList.add('pointer-events-none', 'cursor-not-allowed');
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; 
    
    if(btnBatal) { 
        btnBatal.disabled = true; 
        btnBatal.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); 
    }
    if(btnClose) { 
        btnClose.disabled = true; 
        btnClose.classList.add('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); 
    }
    
    showLoading(true); 
    
    let payload = {}; 
    this.querySelectorAll('.input-edit-nilai-dinamis').forEach(inp => { 
        if(!inp.readOnly) { payload[inp.name] = inp.value; } 
    }); 
    
    const formData = new URLSearchParams(); 
    formData.append('action', 'updateDataNilai'); 
    formData.append('kelas', document.getElementById('edit_nilai_kelas').value); 
    formData.append('nis', document.getElementById('edit_nilai_nis').value); 
    formData.append('data_nilai', JSON.stringify(payload)); 
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    
    gasFetch( { method: 'POST', body: formData }).then(res => res.json()).then(data => { 
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 
        
        if(btnBatal) { btnBatal.disabled = false; btnBatal.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        if(btnClose) { btnClose.disabled = false; btnClose.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        
        if(data.status === 'success') { 
            closeModalEditNilai(); 
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: data.message, showConfirmButton: false, timer: 3000 });
            loadDataNilaiKelas(true); 
        } 
        else { 
            Swal.fire('Gagal', data.message, 'error'); 
        }
	  
    }).catch(err => { 
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 
        
        if(btnBatal) { btnBatal.disabled = false; btnBatal.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        if(btnClose) { btnClose.disabled = false; btnClose.classList.remove('opacity-50', 'cursor-not-allowed', 'pointer-events-none'); }
        
        Swal.fire('Error', 'Gagal update data. Periksa jaringan Anda.', 'error'); 
    }); 
});

function loadBintangPelajar() {
    const wadah = document.getElementById('wadahBintangPelajar');

    wadah.innerHTML =
        '<div class="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 text-center text-white col-span-full">' +
        '<i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>' +
        'Memuat kandidat juara...' +
        '</div>';

    const token = sessionStorage.getItem('tokenMadasa') || '';
    const jsonp = window.gasJsonp;

    if (typeof jsonp !== 'function') {
        wadah.innerHTML =
            '<div class="text-white text-center col-span-full mt-4">' +
            'Komponen koneksi belum termuat. Silakan refresh halaman.' +
            '</div>';
        console.error('[RANKING] gasJsonp tidak tersedia. Pastikan config.js?v=18 termuat.');
        return;
    }

    jsonp('getBintangPelajar', { token }, 60000, 1)
    .then(res => {
        if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {

            const upper = v => String(v || '').toUpperCase();

            let dataTK = res.data.filter(s => /(^|\s|-)TK|TPQ|RA/.test(upper(s.kelas)));
            let dataIBT = res.data.filter(s => /IBT|IBTIDAIYAH|\bMI\b|\bSD\b/.test(upper(s.kelas)));
            let dataSANA = res.data.filter(s => /SANA|TSANAW|MTS|ALIYAH|\bMA\b/.test(upper(s.kelas)));

            const urutkanJuaraUmum = arr => {
                arr.sort((a, b) => {
                    const rataB = parseFloat(b.rata_asli ?? b.rata ?? 0);
                    const rataA = parseFloat(a.rata_asli ?? a.rata ?? 0);
                    if (rataB !== rataA) return rataB - rataA;
                    return parseFloat(b.total || 0) - parseFloat(a.total || 0);
                });
            };

            urutkanJuaraUmum(dataTK);
            urutkanJuaraUmum(dataIBT);
            urutkanJuaraUmum(dataSANA);

            wadah.innerHTML = '';

            const renderKategori = (judul, icon, dataKategori, warnaBadge) => {
                if (dataKategori.length === 0) return;

                wadah.innerHTML += `
                    <div class="col-span-full text-white font-bold text-lg mt-4 mb-2 border-b border-white/30 pb-2 shadow-sm">
                        <i class="${icon} mr-2"></i> ${judul}
                    </div>
                `;

                const topRata = parseFloat(dataKategori[0].rata_asli ?? dataKategori[0].rata ?? 0);
                const topTotal = parseFloat(dataKategori[0].total || 0);

                // TAMBAHAN: Masukkan parameter (santri, index)
                dataKategori.forEach((santri, index) => {
                    const nomorUrut = index + 1; // Membuat urutan otomatis mulai dari 1
                    
                    const rata = parseFloat(santri.rata_asli ?? santri.rata ?? 0);
                    const total = parseFloat(santri.total || 0);
                    const isJuaraUmum = rata === topRata && total === topTotal;
                    const namaWali = santri.wali || 'Belum Diatur';
                    const rataBenar = rata.toFixed(2);
                    
                    // Label Peringatan Belum Lengkap
                    let badgeBelumLengkap = '';
                    if (!santri.lengkap) {
                        let teksMapel = /(TK|TPQ|RA)/i.test(santri.kelas) 
                            ? `Baru diinput: ${santri.mapel_terisi} Mapel` 
                            : `Baru diinput: ${santri.mapel_terisi}/${santri.mapel_wajib} Mapel`;
                        
                        badgeBelumLengkap = `<br><span class="text-amber-600 font-bold text-[10px] mt-1.5 inline-block bg-amber-50 px-2 py-0.5 rounded border border-amber-200"><i class="fas fa-exclamation-triangle"></i> Sementara (${teksMapel})</span>`;
                    }

                    const badgeJuara = isJuaraUmum ? `
                        <div class="absolute top-0 right-0 ${warnaBadge} text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg z-10 shadow-sm">
                            <i class="fas fa-crown mr-1"></i> JUARA UMUM
                        </div>
                    ` : '';

                    const colorAvatar = isJuaraUmum ? 'bg-amber-100 text-amber-500' : 'bg-gray-100 text-gray-400';
                    const colorNumber = isJuaraUmum ? warnaBadge.split(' ')[0] : 'bg-emerald-600';

                    wadah.innerHTML += `
                    <div class="bg-white rounded-xl p-5 shadow-lg transform transition hover:-translate-y-1 relative overflow-hidden group">
                        ${badgeJuara}
                        <div class="flex items-center gap-4 mb-3">
                            <div class="w-14 h-14 rounded-full ${colorAvatar} flex items-center justify-center text-2xl font-bold shadow-inner shrink-0 relative">
                                <i class="fas fa-user-graduate"></i>
                                <!-- MENGGUNAKAN VARIABEL nomorUrut DI SINI -->
                                <div class="absolute -bottom-1 -right-1 w-6 h-6 ${colorNumber} text-white text-xs flex items-center justify-center rounded-full border-2 border-white font-bold">${nomorUrut}</div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-bold text-amber-600 tracking-wider uppercase mb-0.5">${escapeHTML(santri.kelas)}</p>
                                <h4 class="font-bold text-gray-800 text-sm sm:text-base truncate leading-tight">${escapeHTML(santri.nama)}</h4>
                                <p class="text-xs text-gray-500 mt-1">
                                    Total: <span class="font-bold text-gray-800">${santri.total}</span> | 
                                    Rata-rata: <span class="font-bold text-gray-800">${rataBenar}</span>
                                    ${badgeBelumLengkap}
                                </p>
                            </div>
                        </div>

                        <div class="border-t border-gray-100 pt-3 text-xs text-gray-500 space-y-1">
                            <p class="truncate" title="${escapeHTML(santri.jk)}">
                                <i class="fas fa-venus-mars w-4 text-purple-500 text-center"></i> Jns Kelamin: <b>${escapeHTML(santri.jk)}</b>
                            </p>
                            <p class="truncate" title="${escapeHTML(santri.ttl)}">
                                <i class="fas fa-map-marker-alt w-4 text-emerald-500 text-center"></i> ${escapeHTML(santri.ttl)}
                            </p>
                            <p class="truncate" title="${escapeHTML(santri.ayah)} & ${escapeHTML(santri.ibu)}">
                                <i class="fas fa-user-friends w-4 text-blue-500 text-center"></i> ${escapeHTML(santri.ayah)} & ${escapeHTML(santri.ibu)}
                            </p>
                            <p class="truncate" title="${escapeHTML(santri.alamat)}">
                                <i class="fas fa-home w-4 text-orange-500 text-center"></i> ${escapeHTML(santri.alamat)}
                            </p>
                            <p class="truncate mt-1 pt-1" title="Wali Kelas">
                                <i class="fas fa-user-tie w-4 text-gray-400 text-center"></i> Wali Kelas: <b class="text-gray-700">${escapeHTML(namaWali)}</b>
                            </p>
                        </div>
                    </div>
                    `;
                });
            };

            renderKategori('Tingkat TK / RA', 'fas fa-star text-amber-400', dataTK, 'bg-emerald-600');
            renderKategori('Tingkat Madrasah Ibtidaiyah', 'fas fa-star text-amber-400', dataIBT, 'bg-blue-600');
            renderKategori('Tingkat Madrasah Sanawiyah', 'fas fa-star text-amber-400', dataSANA, 'bg-purple-600');
        }
        else if (res.status === 'success') {
            wadah.innerHTML =
                '<div class="bg-white/20 backdrop-blur-md border border-white/30 rounded-xl p-6 text-center text-white col-span-full">' +
                '<i class="fas fa-info-circle text-2xl mb-2 block"></i>' +
                'Belum ada data nilai yang diinput di kelas mana pun.' +
                '</div>';
        }
        else {
            throw new Error(res.message || 'Gagal memuat Bintang Pelajar.');
        }
    })
    .catch(e => {
        console.error('[RANKING] Gagal memuat Bintang Pelajar:', e);
        wadah.innerHTML =
            '<div class="text-white text-center col-span-full mt-4">' +
            'Gagal memuat data ranking. Silakan refresh lalu coba lagi.' +
            '</div>';
    });
}


function loadRankingKelas() {
    const kelasPilih = document.getElementById('filterKelasRanking').value;
    if (!kelasPilih) {
        Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Silakan pilih kelas terlebih dahulu.' });
        return;
    }

    showLoading(true);
    const token = sessionStorage.getItem('tokenMadasa') || '';
    const jsonp = window.gasJsonp;

    if (typeof jsonp !== 'function') {
        showLoading(false);
        Swal.fire('Error', 'Komponen koneksi belum termuat. Silakan refresh halaman.', 'error');
        return;
    }

  jsonp('getRankingKelas', { token, kelas: kelasPilih }, 30000, 1)
    .then(resRanking => {
        showLoading(false);
        const tbody = document.getElementById('bodyTabelRanking');
        tbody.innerHTML = '';

        const namaWali = (resRanking && resRanking.wali) ? resRanking.wali : 'Belum Diatur';

        if (resRanking.status === 'success' && Array.isArray(resRanking.data) && resRanking.data.length > 0) {
            // Urutan dari server sudah final: santri lengkap berdasarkan rata-rata presisi asli,
            // lalu santri yang nilainya belum lengkap di bagian bawah tanpa ranking.
            resRanking.data.forEach((s, index) => {
                const lengkap = s.lengkap === true || s.status_ranking === 'LENGKAP';
                const rankNomor = lengkap && s.rank ? parseInt(s.rank) : null;
                let rankStyle = 'text-gray-400 font-bold text-lg';
                let bgStyle = lengkap ? 'hover:bg-gray-50' : 'bg-slate-50/80';
                let icon = rankNomor || '<span class="text-xs">BELUM</span>';

                if (rankNomor === 1) { rankStyle = 'text-amber-500 text-2xl font-black'; bgStyle = 'bg-amber-50 border-l-4 border-amber-400'; }
                else if (rankNomor === 2) { rankStyle = 'text-gray-400 text-xl font-black'; bgStyle = 'bg-gray-50'; }
                else if (rankNomor === 3) { rankStyle = 'text-orange-400 text-xl font-black'; bgStyle = 'bg-orange-50/50'; }

                tbody.innerHTML += `
                <tr class="transition-all ${bgStyle} border-b border-gray-50 last:border-0">
                    <td class="p-3 text-center border-r border-gray-100 ${rankStyle} whitespace-nowrap">${icon}</td>
                    <td class="p-3 text-gray-500 border-r border-gray-100 text-xs whitespace-nowrap">${escapeHTML(s.nis)}</td>
                    <td class="p-3 border-r border-gray-100 min-w-[280px]">
                        <p class="font-bold text-gray-800 ${rankNomor && rankNomor <= 3 ? 'text-base' : 'text-sm'} whitespace-nowrap">${escapeHTML(s.nama)}</p>
                        <div class="text-[11px] text-gray-500 mt-1.5 space-y-0.5 whitespace-nowrap">
                            <p><span class="font-semibold text-gray-600">L/P:</span> ${escapeHTML(s.jk)}</p>
                            <p><span class="font-semibold text-gray-600">TTL:</span> ${escapeHTML(s.ttl)}</p>
                            <p><span class="font-semibold text-gray-600">Ortu:</span> ${escapeHTML(s.ayah)} & ${escapeHTML(s.ibu)}</p>
                            <p><span class="font-semibold text-gray-600">Alamat:</span> ${escapeHTML(s.alamat)}</p>
                            ${!lengkap ? `<p class="mt-1 text-amber-700 font-bold"><i class="fas fa-exclamation-circle mr-1"></i>Nilai belum lengkap: ${s.mapel_terisi || 0}/${s.mapel_wajib || 0} mapel. Rata-rata sementara.</p>` : ''}
                            <p class="mt-1 pt-1 border-t border-gray-200/60"><span class="font-semibold text-gray-600">Wali Kelas:</span> <span class="font-bold text-gray-800">${escapeHTML(namaWali)}</span></p>
                        </div>
                    </td>
                    <td class="p-3 text-center border-r border-gray-100 font-bold text-emerald-700 align-middle whitespace-nowrap">${s.total}</td>
                    <td class="p-3 text-center font-bold text-blue-600 align-middle whitespace-nowrap">${s.mapel_terisi > 0 || lengkap ? parseFloat(s.rata_asli ?? s.rata ?? 0).toFixed(2) : '-'}</td>
                </tr>`;
            });
        } else if (resRanking.status === 'success') {
            tbody.innerHTML = `<tr><td colspan="5" class="p-8 text-left sm:text-center border-none"><div class="sticky left-6 inline-block text-center text-red-400 font-medium"><i class="fas fa-folder-open text-4xl mb-3 block text-red-300"></i> Belum ada data nilai di kelas ini.</div></td></tr>`;
        } else {
            throw new Error(resRanking.message || 'Gagal memuat ranking.');
        }
    })
    .catch(e => {
        showLoading(false);
        console.error('[RANKING] Gagal memuat ranking kelas:', e);
        Swal.fire('Error', 'Gagal memuat ranking. Silakan refresh lalu coba lagi.', 'error');
    });
}

function loadSettingRapor() {
    const kelas = document.getElementById('settingKelas').value; 
    if(!kelas) return; 
    
    const wadahMapel = document.getElementById('wadahKategoriMapel');
    const labelKepala = document.getElementById('labelKepalaSetting');
    
    if (kelas.includes('TK')) {
        if (wadahMapel) wadahMapel.classList.add('hidden'); 
        if (labelKepala) labelKepala.innerText = 'Nama Kepala TK / RA'; 
    } else {
        if (wadahMapel) wadahMapel.classList.remove('hidden'); 
        if (labelKepala) labelKepala.innerText = 'Nama Kepala Madrasah'; 
    }

    showLoading(true); 
    const formData = new URLSearchParams(); 
    formData.append('action', 'getPengaturan'); 
    formData.append('kelas', kelas); 

    gasFetch( {method:'POST', body:formData}).then(r=>r.json()).then(res => { 
        showLoading(false); 
        document.getElementById('formSettingRapor').classList.remove('hidden'); 

        let u = res.umum || {}; 
        document.getElementById('set_semester').value = u.semester || ''; 
        document.getElementById('set_tahun').value = u.tahun || ''; 
        document.getElementById('set_tanggal').value = u.tanggal || ''; 
        document.getElementById('set_kepala').value = u.kepala || ''; 
        document.getElementById('set_wali').value = u.wali || ''; 
		
        document.getElementById('set_status_rilis').value = u.status_rilis || 'Sembunyi';

        document.getElementById('set_mapel_tulis').value = res.mapel_tulis || ''; 
        document.getElementById('set_mapel_praktek').value = res.mapel_praktek || ''; 
        document.getElementById('set_mapel_baca').value = res.mapel_baca || ''; 
        document.getElementById('set_kamus').value = res.kamus || '';

        const mapImg = [{url: u.url_wali, imgId: 'preview_wali', teksId: 'teks_wali'}, {url: u.url_kepala, imgId: 'preview_kepala', teksId: 'teks_kepala'}, {url: u.url_stempel, imgId: 'preview_stempel', teksId: 'teks_stempel'}]; 
        mapImg.forEach(m => { 
            const imgEl = document.getElementById(m.imgId); 
            const txtEl = document.getElementById(m.teksId); 
            if(m.url) { imgEl.src = m.url; imgEl.classList.remove('hidden'); txtEl.classList.add('hidden'); } 
            else { imgEl.src = ''; imgEl.classList.add('hidden'); txtEl.classList.remove('hidden'); } 
        });
        
        const santriKelas = GLOBAL_DATA_SANTRI.filter(s => s.kelas === kelas); 
        const tbody = document.getElementById('bodySettingSantri'); 
        tbody.innerHTML = ''; 
        let det = res.detail || {}; 
        
if (santriKelas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="p-8 text-center text-red-500 font-bold"><i class="fas fa-exclamation-triangle mr-2 block text-3xl mb-2 text-red-300"></i> Belum ada santri di kelas ini.<br><span class="text-sm font-normal text-gray-500">Silakan tambahkan santri terlebih dahulu di menu Data Santri.</span></td></tr>';
        } else {
            // --- LOGIKA MENEBAK KELAS BERIKUTNYA SECARA OTOMATIS ---
            let teksNaikRomawi = "Naik ke Kelas ...";
            let teksTinggal = `Tinggal di ${kelas}`;
            let suffixTingkat = "";
            let kelasUpper = kelas.toUpperCase();
            
            if (kelasUpper.includes('IBT') || kelasUpper.includes('IBTIDAIYAH') || kelasUpper.includes('MI')) { suffixTingkat = " IBTIDAIYAH"; } 
            else if (kelasUpper.includes('SANA') || kelasUpper.includes('SANAWIYAH') || kelasUpper.includes('MTS')) { suffixTingkat = " SANAWIYAH"; } 
            else if (kelasUpper.includes('ALIYAH') || kelasUpper.includes('MA')) { suffixTingkat = " ALIYAH"; } 
            else if (kelasUpper.includes('TK') || kelasUpper.includes('RA')) { suffixTingkat = " TK - RA"; }

            function romawiKeAngka(str) {
                const nilai = { 'I':1, 'V':5, 'X':10 };
                let hasil = 0;
                for (let i = 0; i < str.length; i++) {
                    if (i < str.length - 1 && nilai[str[i]] < nilai[str[i+1]]) { hasil -= nilai[str[i]]; } 
                    else { hasil += nilai[str[i]]; }
                }
                return hasil;
            }

            let matchAngka = kelas.match(/\d+/);
            let matchRomawi = kelas.match(/\b(I{1,3}|IV|V|VI{0,3}|IX|X{1,2}|XI{0,2})\b$/i);
            let angkaSekarang = null;
            if (matchAngka) { angkaSekarang = parseInt(matchAngka[0]); } 
            else if (matchRomawi) { angkaSekarang = romawiKeAngka(matchRomawi[0].toUpperCase()); }

            if (angkaSekarang !== null) {
                let angkaNaik = angkaSekarang + 1; 
                const daftarRomawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
                if (angkaNaik <= 12) { teksNaikRomawi = `Naik ke Kelas ${daftarRomawi[angkaNaik]}${suffixTingkat}`; }
            } else if (kelasUpper.includes(' A')) {
                teksNaikRomawi = `Naik ke Kelas B${suffixTingkat}`;
            }

            // Hapus pembuatan <datalist>, langsung bersihkan isi tabel untuk disiapkan
            tbody.innerHTML = '';

           santriKelas.forEach(s => { 
                let d = det[s.nis] || {akhlaq:'', kerajinan:'', disiplin:'', rapi:'', sakit:'', izin:'', alpa:'', catatan:'', keputusan:''}; 
                let isTK = kelasUpper.includes('TK') || kelasUpper.includes('RA');
                
                tbody.innerHTML += ` 
                <tr class="set-santri-row hover:bg-gray-50 transition-all border-b border-gray-100" data-nis="${s.nis}">
                    <td class="p-3 border-r font-bold sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] text-gray-800 min-w-[130px] max-w-[150px] md:max-w-none md:min-w-[250px] whitespace-normal leading-snug">${s.nama}</td>
                    
                    <td class="p-1 border-r bg-blue-50/30"><input type="text" onclick="bukaOpsiKepribadian(this, 'Akhlaq')" class="inp-akhlaq w-10 sm:w-12 mx-auto block text-center border-2 border-blue-200 rounded p-1 font-bold text-blue-700 outline-none cursor-pointer hover:bg-blue-100 bg-white transition-colors shadow-sm" value="${d.akhlaq}" readonly placeholder="-"></td> 
<td class="p-1 border-r bg-blue-50/30"><input type="text" onclick="bukaOpsiKepribadian(this, 'Kerajinan')" class="inp-rajin w-10 sm:w-12 mx-auto block text-center border-2 border-blue-200 rounded p-1 font-bold text-blue-700 outline-none cursor-pointer hover:bg-blue-100 bg-white transition-colors shadow-sm" value="${d.kerajinan}" readonly placeholder="-"></td> 
<td class="p-1 border-r bg-blue-50/30"><input type="text" onclick="bukaOpsiKepribadian(this, 'Kedisiplinan')" class="inp-disiplin w-10 sm:w-12 mx-auto block text-center border-2 border-blue-200 rounded p-1 font-bold text-blue-700 outline-none cursor-pointer hover:bg-blue-100 bg-white transition-colors shadow-sm" value="${d.disiplin}" readonly placeholder="-"></td> 
<td class="p-1 border-r bg-blue-50/30"><input type="text" onclick="bukaOpsiKepribadian(this, 'Kerapian')" class="inp-rapi w-10 sm:w-12 mx-auto block text-center border-2 border-blue-200 rounded p-1 font-bold text-blue-700 outline-none cursor-pointer hover:bg-blue-100 bg-white transition-colors shadow-sm" value="${d.rapi}" readonly placeholder="-"></td>
                    
                    <td class="p-1 border-r bg-orange-50/30"><input type="number" class="inp-sakit w-10 sm:w-12 mx-auto block text-center border-2 border-orange-200 rounded p-1 font-bold text-orange-700 outline-none focus:border-orange-500" value="${d.sakit}"></td> 
                    <td class="p-1 border-r bg-orange-50/30"><input type="number" class="inp-izin w-10 sm:w-12 mx-auto block text-center border-2 border-orange-200 rounded p-1 font-bold text-orange-700 outline-none focus:border-orange-500" value="${d.izin}"></td> 
                    <td class="p-1 border-r bg-orange-50/30"><input type="number" class="inp-alpa w-10 sm:w-12 mx-auto block text-center border-2 border-orange-200 rounded p-1 font-bold text-orange-700 outline-none focus:border-orange-500" value="${d.alpa}"></td> 
                    
                    <!-- PERUBAHAN UI KEPUTUSAN (INPUT + TOMBOL PANAH) -->
                    <td class="p-1 border-r bg-emerald-50/30">
                        <div class="flex items-stretch w-48 mx-auto">
                            <input type="text" class="inp-keputusan w-full border-2 border-emerald-200 border-r-0 rounded-l p-1.5 text-xs font-semibold text-emerald-800 outline-none focus:border-emerald-500" value="${escapeHTML(d.keputusan)}" placeholder="Ketik/Pilih...">
                            <button type="button" onclick="bukaOpsiKeputusan(this, '${teksNaikRomawi}', '${teksTinggal}')" class="bg-emerald-100 border-2 border-emerald-200 text-emerald-700 px-2.5 rounded-r hover:bg-emerald-200 transition-all shadow-sm"><i class="fas fa-caret-down"></i></button>
                        </div>
                    </td>

                    <!-- PERUBAHAN UI CATATAN (INPUT + TOMBOL PANAH) -->
                    <td class="p-1 bg-purple-50/30">
                        <div class="flex items-stretch w-72 mx-auto">
                            <input type="text" class="inp-catatan w-full border-2 border-purple-200 border-r-0 rounded-l p-1.5 text-xs font-medium text-purple-800 outline-none focus:border-purple-500" value="${escapeHTML(d.catatan)}" placeholder="Ketik/Pilih...">
                            <button type="button" onclick="bukaOpsiCatatan(this, ${isTK})" class="bg-purple-100 border-2 border-purple-200 text-purple-700 px-2.5 rounded-r hover:bg-purple-200 transition-all shadow-sm"><i class="fas fa-caret-down"></i></button>
                        </div>
                    </td>
                </tr>`; 
            });
        }


    }).catch(e => {
        showLoading(false);
        Swal.fire('Error', 'Gagal memuat pengaturan. Periksa koneksi internet.', 'error');
    });
}

document.getElementById('formSettingRapor').addEventListener('submit', function(e){ 
    e.preventDefault(); 
    
    const btnSubmit = this.querySelector('button[type="submit"]'); 
    const originalText = btnSubmit.innerHTML; 
    
    btnSubmit.disabled = true; 
    btnSubmit.classList.add('pointer-events-none', 'opacity-70', 'cursor-not-allowed');
    btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Menyimpan...'; 
    showLoading(true); 

    const kelas = document.getElementById('settingKelas').value; 
    let setUmum = { semester: document.getElementById('set_semester').value, tahun: document.getElementById('set_tahun').value, tanggal: document.getElementById('set_tanggal').value, kepala: document.getElementById('set_kepala').value, wali: document.getElementById('set_wali').value, status_rilis: document.getElementById('set_status_rilis').value };
    let detSantri = []; 
    document.querySelectorAll('.set-santri-row').forEach(tr => { detSantri.push({ nis: tr.getAttribute('data-nis'), akhlaq: tr.querySelector('.inp-akhlaq').value, kerajinan: tr.querySelector('.inp-rajin').value, disiplin: tr.querySelector('.inp-disiplin').value, rapi: tr.querySelector('.inp-rapi').value, sakit: tr.querySelector('.inp-sakit').value, izin: tr.querySelector('.inp-izin').value, alpa: tr.querySelector('.inp-alpa').value, keputusan: tr.querySelector('.inp-keputusan').value, catatan: tr.querySelector('.inp-catatan').value }); }); 
    
    const formData = new URLSearchParams();
    formData.append('action', 'simpanPengaturan');
    formData.append('token', sessionStorage.getItem('tokenMadasa'));
    formData.append('kelas', kelas); 
    formData.append('set_umum', JSON.stringify(setUmum)); 
    formData.append('det_santri', JSON.stringify(detSantri)); 
    
    formData.append('mapel_tulis', document.getElementById('set_mapel_tulis').value.toUpperCase());
    formData.append('mapel_praktek', document.getElementById('set_mapel_praktek').value.toUpperCase());
    formData.append('mapel_baca', document.getElementById('set_mapel_baca').value.toUpperCase());
    formData.append('kamus', document.getElementById('set_kamus').value);
    
    gasFetch( {method:'POST', body:formData}).then(r=>r.json()).then(res => {
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'opacity-70', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 

        if(res.status === 'success') {
            Swal.fire('Berhasil', res.message, 'success'); 
            muatSemuaMapel(); 
        } else { 
            Swal.fire('Gagal', res.message, 'error'); 
        } 
    }).catch(e => {
        showLoading(false); 
        
        btnSubmit.disabled = false; 
        btnSubmit.classList.remove('pointer-events-none', 'opacity-70', 'cursor-not-allowed');
        btnSubmit.innerHTML = originalText; 
        
        Swal.fire('Error', 'Gagal menyimpan. Periksa koneksi internet.', 'error');
    }); 
});

function prosesUploadDrive(inputId, previewId, teksId, jenisKode) { 
    const fileInput = document.getElementById(inputId); const previewImg = document.getElementById(previewId); const teksKosong = document.getElementById(teksId); 
    fileInput.addEventListener('change', function(e) { 
        const kelas = document.getElementById('settingKelas').value; 
        if(!kelas) { Swal.fire('Tahan Dulu!', 'Silakan pilih KELAS di paling atas sebelum meng-upload stempel/ttd.', 'warning'); fileInput.value = ''; return; } 
        const file = e.target.files[0]; if (!file) return; 
        if (file.type !== "image/png") { Swal.fire('Ditolak', 'Harap masukkan format .PNG transparan!', 'error'); fileInput.value = ''; return; } 
        if (file.size > 5242880) { Swal.fire('Terlalu Besar', 'Maksimal ukuran gambar 5 MB.', 'error'); fileInput.value = ''; return; } 
        const reader = new FileReader(); 
        reader.onload = function(event) { 
            const base64String = event.target.result; previewImg.src = base64String; previewImg.classList.remove('hidden'); teksKosong.classList.add('hidden'); showLoading(true); 
            
            const formData = new URLSearchParams(); 
            formData.append('action', 'uploadGambar'); 
            formData.append('kelas', kelas); 
            formData.append('jenis', jenisKode); 
            formData.append('data', base64String); 
            formData.append('token', sessionStorage.getItem('tokenMadasa')); 
			
            gasFetch( {method:'POST', body:formData}).then(r=>r.json()).then(res => { showLoading(false); if(res.status === 'success') { Swal.fire({toast:true, position:'top-end', icon:'success', title: 'Tersimpan di Drive!', showConfirmButton:false, timer:2000}); } else { Swal.fire('Gagal Upload', res.message, 'error'); } }).catch(err => { showLoading(false); Swal.fire('Error', 'Jaringan terputus.', 'error'); }); 
        }; reader.readAsDataURL(file); 
    }); 
}
prosesUploadDrive('upload_wali', 'preview_wali', 'teks_wali', 'wali'); prosesUploadDrive('upload_kepala', 'preview_kepala', 'teks_kepala', 'kepala'); prosesUploadDrive('upload_stempel', 'preview_stempel', 'teks_stempel', 'stempel');

function exportRankingPDF() { 
    const kelas = document.getElementById('filterKelasRanking').value; 
    if (!kelas) return Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Silakan tampilkan ranking kelas terlebih dahulu sebelum melakukan export.' }); 
    const elemenTabel = document.getElementById('bodyTabelRanking').closest('.overflow-x-auto'); 
    if (elemenTabel.innerText.includes('Silakan pilih kelas') || elemenTabel.innerText.includes('Belum ada data')) { return Swal.fire({ icon: 'error', title: 'Tabel Kosong', text: 'Tidak ada data santri yang bisa diexport ke PDF.' }); } 
    showLoading(true); 
    const pdfContainer = document.createElement('div'); pdfContainer.style.padding = '30px'; pdfContainer.style.backgroundColor = 'white'; 
    pdfContainer.innerHTML = ` <div style="text-align: center; border-bottom: 3px solid #059669; padding-bottom: 15px; margin-bottom: 25px;"> <h2 style="font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 700; color: #065f46; margin: 0; text-transform: uppercase;">Madrasah Darussalam</h2> <p style="font-family: 'Inter', sans-serif; margin: 5px 0 0 0; color: #4b5563; font-size: 14px; font-weight: 500;">Laporan Peringkat Akademik Santri - Kelas: <span style="color: #059669; font-weight: bold;">${kelas}</span></p> </div> `; 
    const tabelClone = elemenTabel.cloneNode(true); tabelClone.classList.remove('overflow-x-auto', 'border', 'rounded-xl', 'border-gray-200'); pdfContainer.appendChild(tabelClone); 
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); 
    pdfContainer.innerHTML += ` <div style="margin-top: 40px; padding-top: 15px; border-top: 1px dashed #cbd5e1; text-align: center; color: #94a3b8; font-size: 11px; font-style: italic; font-family: 'Inter', sans-serif;"> <p style="margin: 0;">Dokumen ini diterbitkan dan dicetak secara otomatis melalui Sistem Informasi Penilaian Santri - Madrasah Darussalam.</p> <p style="margin: 4px 0 0 0;">Dicetak pada: <b>${tanggalCetak}</b></p> </div> `; 
    const opt = { margin: [0.3, 0.3, 0.5, 0.3], filename: `Data_Ranking_${kelas.replace(/\s+/g, '_')}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }; 
    html2pdf().set(opt).from(pdfContainer).save().then(() => { showLoading(false); Swal.fire({ icon: 'success', title: 'Alhamdulillah', text: 'File PDF berhasil dibuat!', timer: 2000, showConfirmButton: false }); }).catch(err => { showLoading(false); Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan saat memproses PDF.' }); }); 
}

function exportBintangPelajarPDF() { 
    const wadah = document.getElementById('wadahBintangPelajar'); 
    if (wadah.innerText.includes('Memuat') || wadah.innerText.includes('Belum ada data')) { return Swal.fire({ icon: 'error', title: 'Data Kosong', text: 'Tidak ada data Bintang Pelajar yang bisa diexport saat ini.' }); } 
    showLoading(true); 
    const pdfContainer = document.createElement('div'); pdfContainer.style.padding = '30px'; pdfContainer.style.backgroundColor = '#f8fafc'; 
    pdfContainer.innerHTML = ` <div style="text-align: center; border-bottom: 3px solid #d97706; padding-bottom: 15px; margin-bottom: 25px;"> <h2 style="font-family: 'Poppins', sans-serif; font-size: 26px; font-weight: 700; color: #b45309; margin: 0; text-transform: uppercase;">Madrasah Darussalam</h2> <p style="font-family: 'Inter', sans-serif; margin: 5px 0 0 0; color: #78350f; font-size: 14px; font-weight: 500;">Laporan Eksekutif: Daftar Bintang Pelajar (Juara Umum Per Kelas)</p> </div> `; 
    const clone = wadah.cloneNode(true); clone.className = 'grid grid-cols-2 gap-4'; pdfContainer.appendChild(clone); 
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); 
    pdfContainer.innerHTML += ` <div style="margin-top: 40px; padding-top: 15px; border-top: 1px dashed #cbd5e1; text-align: center; color: #64748b; font-size: 11px; font-style: italic; font-family: 'Inter', sans-serif;"> <p style="margin: 0;">Dokumen ini diterbitkan dan dicetak secara otomatis melalui Sistem Informasi Penilaian Santri - Madrasah Darussalam.</p> <p style="margin: 4px 0 0 0;">Dicetak pada: <b>${tanggalCetak}</b></p> </div> `; 
    const opt = { margin: [0.3, 0.3, 0.5, 0.3], filename: `Bintang_Pelajar_Darussalam.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } }; 
    html2pdf().set(opt).from(pdfContainer).save().then(() => { showLoading(false); Swal.fire({ icon: 'success', title: 'Alhamdulillah', text: 'Laporan Bintang Pelajar berhasil diunduh!', timer: 2000, showConfirmButton: false }); }).catch(err => { showLoading(false); Swal.fire({ icon: 'error', title: 'Gagal', text: 'Terjadi kesalahan.' }); }); 
}



function cetakDataSantri() {
    const filterKelas = document.getElementById('filterKelasSantri').value;
    const teksKelas = filterKelas === 'Semua' ? 'Semua Kelas' : filterKelas;
    let dataCetak = GLOBAL_DATA_SANTRI;
    
    if (filterKelas !== 'Semua') { dataCetak = dataCetak.filter(s => s.kelas === filterKelas); }
    if (!dataCetak || dataCetak.length === 0) {
        return Swal.fire({ icon: 'error', title: 'Data Kosong', text: 'Tidak ada data santri di kelas ini.' });
    }

    const tabelPrint = document.createElement('table');
    tabelPrint.innerHTML = `
        <thead>
            <tr>
                <th style="width: 3%;">NO</th><th style="width: 8%;">NIS</th>
                <th style="text-align: left; width: 15%;">NAMA LENGKAP</th>
                <th style="width: 5%;">L/P</th><th style="width: 10%;">KELAS</th>
                <th style="width: 15%;">TEMPAT, TGL LAHIR</th><th style="width: 15%;">NAMA ORTU</th>
                <th style="width: 10%;">NO. HP/WA</th><th style="text-align: left; width: 19%;">ALAMAT LENGKAP</th>
            </tr>
        </thead><tbody></tbody>`;
    const tbodyPrint = tabelPrint.querySelector('tbody');

    dataCetak.forEach((s, index) => {
        let jenisKelamin = s.jk === 'Laki-laki' ? 'L' : (s.jk === 'Perempuan' ? 'P' : s.jk);
        const trBaru = document.createElement('tr');
        trBaru.innerHTML = `<td>${index + 1}</td><td>${s.nis}</td><td style="text-align: left; font-weight: bold;">${s.nama}</td><td>${jenisKelamin}</td><td>${s.kelas}</td><td>${s.ttl}</td><td>${s.ayah} & ${s.ibu}</td><td>${s.hp}</td><td style="text-align: left;">${s.alamat}</td>`;
        tbodyPrint.appendChild(trBaru);
    });

    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = window.location.origin + window.location.pathname.replace(/index\.html$/i, '') + 'asset/logo.png';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return Swal.fire({ icon: 'error', title: 'Pop-up Diblokir!', text: 'Browser memblokir tab baru.' });

    printWindow.document.write(`
        <!DOCTYPE html><html lang="id"><head><title>Data_Santri_${teksKelas.replace(/\s+/g, '_')}</title>
        <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; background: #fff; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 6px 4px; text-align: center; vertical-align: middle; }
            th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; }
            .footer { text-align: center; font-size: 10px; font-style: italic; color: #555; margin-top: 20px; border-top: 1px dashed #aaa; padding-top: 10px; }
        </style></head><body>
            <div style="display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="${logoUrl}" style="width: 65px; height: 65px; object-fit: contain; margin-right: 15px;">
                <div style="flex: 1; text-align: center; padding-right: 80px;">
                    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: bold;">Madrasah Darussalam</h2>
                    <p style="margin: 5px 0 0 0; font-size: 13px;">Laporan Data Induk Santri Lengkap - Kelas: <b>${teksKelas}</b></p>
                </div>
            </div>
            ${tabelPrint.outerHTML}
           <div class="footer">Dokumen ini dicetak otomatis dari Sistem Penilaian Santri | Tanggal Cetak: ${tanggalCetak}</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 1000); };<\/script>
</body></html>
    `);
    printWindow.document.close();
}

function cetakDataNilai() {
    const kelas = document.getElementById('filterKelasDataNilai').value;
    if (!kelas) return Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Silakan tampilkan laporan terlebih dahulu.' });
    
    const elemenTabel = document.getElementById('tabelDataNilai');
    const teksTabel = document.getElementById('bodyDataNilai').innerText;
    if (teksTabel.includes('Silakan pilih kelas') || teksTabel.includes('Belum ada data')) return Swal.fire({ icon: 'error', title: 'Kosong', text: 'Tidak ada data nilai.' });
    
    const tabelClone = elemenTabel.cloneNode(true);
    tabelClone.removeAttribute('class'); tabelClone.querySelectorAll('th, td, tr, thead, tbody').forEach(el => el.removeAttribute('class'));
    
    const headerRow = tabelClone.querySelector('thead tr');
    if (headerRow && headerRow.lastElementChild) headerRow.removeChild(headerRow.lastElementChild);
    const bodyRows = tabelClone.querySelectorAll('tbody tr');
    bodyRows.forEach(tr => { if (tr.lastElementChild) tr.removeChild(tr.lastElementChild); });
    
    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = window.location.origin + window.location.pathname.replace(/index\.html$/i, '') + 'asset/logo.png';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return Swal.fire({ icon: 'error', title: 'Pop-up Diblokir!', text: 'Browser memblokir tab baru.' });
    
    printWindow.document.write(`
        <!DOCTYPE html><html lang="id"><head><title>Cetak_Nilai_${kelas.replace(/\s+/g, '_')}</title>
        <style>
            @page { size: landscape; margin: 10mm; }
            body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; background: #fff; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 6px 4px; font-size: 10px; text-align: center; white-space: nowrap; }
            th { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; text-transform: uppercase; }
            td:nth-child(3) { text-align: left; }
            .footer { text-align: center; font-size: 10px; font-style: italic; color: #555; margin-top: 20px; border-top: 1px dashed #aaa; padding-top: 10px; }
        </style></head><body>
            <div style="display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="${logoUrl}" style="width: 65px; height: 65px; object-fit: contain; margin-right: 15px;">
                <div style="flex: 1; text-align: center; padding-right: 80px;">
                    <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: bold;">Madrasah Darussalam</h2>
                    <p style="margin: 5px 0 0 0; font-size: 13px;">Laporan Rekapitulasi Nilai Santri - Kelas: <b>${kelas}</b></p>
                </div>
            </div>
            ${tabelClone.outerHTML}
            <div class="footer">Dokumen ini dicetak otomatis dari Sistem Penilaian Santri | Tanggal Cetak: ${tanggalCetak}</div>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 1000); };<\/script>
</body></html>
    `);
    printWindow.document.close();
}

function cetakRanking() {
    const kelas = document.getElementById('filterKelasRanking').value;
    if (!kelas) return Swal.fire({ icon: 'warning', title: 'Pilih Kelas', text: 'Silakan tampilkan ranking terlebih dahulu sebelum mencetak.' });

    const tbody = document.getElementById('bodyTabelRanking');
    if (tbody.innerText.includes('Silakan pilih kelas') || tbody.innerText.includes('Belum ada data')) {
         return Swal.fire({ icon: 'error', title: 'Tabel Kosong', text: 'Tidak ada data untuk dicetak.' });
    }

    const barisData = tbody.querySelectorAll('tr');
    let tabelPrintHTML = `
        <table>
            <thead>
                <tr>
                    <th style="width: 8%;">Rank</th>
                    <th style="width: 15%;">NIS</th>
                    <th style="width: 47%; text-align: left;">Nama & Detail Santri</th>
                    <th style="width: 15%;">Total Nilai</th>
                    <th style="width: 15%;">Rata-Rata</th>
                </tr>
            </thead>
            <tbody>
    `;

    barisData.forEach(tr => {
        const tds = tr.querySelectorAll('td');
        if (tds.length === 5) {
            const rank = tds[0].innerText;
            const nis = tds[1].innerText;
            
            const nama = tds[2].querySelector('p.font-bold').innerText;
            const detailLines = tds[2].querySelectorAll('.space-y-0\\.5 p');
            let detailStr = '';
            detailLines.forEach(p => { detailStr += `<div style="font-size: 11px; color: #444; margin-top: 3px;">${p.innerHTML}</div>`; });

            const total = tds[3].innerText;
            const rata = tds[4].innerText;

            tabelPrintHTML += `
                <tr>
                    <td style="text-align: center; font-weight: bold; font-size: 16px;">${rank}</td>
                    <td style="text-align: center;">${nis}</td>
                    <td style="text-align: left;">
                        <div style="font-weight: bold; font-size: 14px; margin-bottom: 5px;">${nama}</div>
                        ${detailStr}
                    </td>
                    <td style="text-align: center; font-weight: bold; font-size: 14px;">${total}</td>
                    <td style="text-align: center; font-weight: bold; font-size: 14px;">${rata}</td>
                </tr>
            `;
        }
    });
    tabelPrintHTML += `</tbody></table>`;

    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const logoUrl = window.location.origin + window.location.pathname.replace(/index\.html$/i, '') + 'asset/logo.png';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return Swal.fire({ icon: 'error', title: 'Pop-up Diblokir!', text: 'Browser memblokir tab baru.' });

    printWindow.document.write(`
        <!DOCTYPE html><html lang="id"><head><title>Cetak_Ranking_${kelas.replace(/\s+/g, '_')}</title>
        <style>
            @page { margin: 15mm; }
            body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; background: #fff; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #000; padding: 10px 8px; vertical-align: top; }
            th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: bold; text-transform: uppercase; }
            
            /* PERBAIKAN: Mencegah baris terpotong saat pindah halaman */
            tr { page-break-inside: avoid; break-inside: avoid; }
            
            .footer { text-align: center; font-size: 10px; font-style: italic; color: #555; margin-top: 20px; border-top: 1px dashed #aaa; padding-top: 10px; }
        </style></head><body>
            <div style="display: flex; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                <img src="${logoUrl}" style="width: 70px; height: 70px; object-fit: contain; margin-right: 15px;" onerror="this.style.display='none'">
                <div style="flex: 1; text-align: center; padding-right: 85px;">
                    <h2 style="margin: 0; font-size: 24px; text-transform: uppercase; font-weight: bold;">Madrasah Darussalam</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">Laporan Peringkat Akademik Santri - Kelas: <b>${kelas}</b></p>
                </div>
            </div>
            ${tabelPrintHTML}
            <div class="footer">Dokumen ini dicetak otomatis dari Sistem Penilaian Santri | Tanggal Cetak: ${tanggalCetak}</div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 1000); };<\/script>
        </body></html>
    `);
    printWindow.document.close();
}

function cetakBintangPelajar() {
    const wadah = document.getElementById('wadahBintangPelajar');
    if (wadah.innerText.includes('Memuat') || wadah.innerText.includes('Belum ada data')) {
         return Swal.fire({ icon: 'error', title: 'Data Kosong', text: 'Tidak ada data Bintang Pelajar saat ini.' });
    }

    let gridHTML = `<div style="display: flex; flex-wrap: wrap; gap: 2%; justify-content: flex-start;">`;
    
    Array.from(wadah.children).forEach(el => {
        if (el.classList.contains('col-span-full')) {
            gridHTML += `<div style="width: 100%; margin-top: 15px; margin-bottom: 10px; font-size: 16px; font-weight: bold; color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 5px;">${el.innerText}</div>`;
        } 
        else if (el.classList.contains('bg-white')) {
            const isJuaraUmum = el.innerHTML.includes('JUARA UMUM');
            
            const nomorUrutDiv = el.querySelector('.absolute.-bottom-1.-right-1');
            const nomorUrut = nomorUrutDiv ? nomorUrutDiv.innerText : '1';
            
            const kelas = el.querySelector('p.uppercase').innerText;
            const nama = el.querySelector('h4').innerText;
            const totalRata = el.querySelector('p.text-xs.text-gray-500').innerText; 
            
            const detailLines = el.querySelectorAll('.border-t p');
            let detailStr = '';
            detailLines.forEach(p => { detailStr += `<div style="margin-bottom: 4px; font-size: 11px;">• ${p.innerText}</div>`; });

            gridHTML += `
                <div style="border: 2px solid ${isJuaraUmum ? '#d97706' : '#000'}; padding: 15px; width: 49%; box-sizing: border-box; border-radius: 12px; margin-bottom: 15px; position: relative; page-break-inside: avoid;">
                    ${isJuaraUmum ? '<div style="position: absolute; top: 0; right: 0; background: #d97706; color: white; padding: 4px 8px; font-size: 10px; font-weight: bold; border-bottom-left-radius: 8px;">JUARA UMUM</div>' : ''}
                    <div style="position: absolute; top: 12px; left: 15px; font-size: 22px; font-weight: 900; color: ${isJuaraUmum ? '#d97706' : '#64748b'};">#${nomorUrut}</div>
                    <div style="text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 10px; margin-bottom: 10px;">
                        <div style="font-size: 11px; font-weight: bold; background: #e5e7eb; display: inline-block; padding: 4px 12px; border-radius: 15px; margin-bottom: 8px;">${kelas}</div>
                        <h3 style="margin: 0; font-size: 18px; font-weight: bold;">${nama}</h3>
                        <div style="font-size: 12px; margin-top: 8px; font-weight: bold;">${totalRata}</div>
                    </div>
                    <div style="color: #333;">${detailStr}</div>
                </div>
            `;
        }
    });
    gridHTML += `</div>`;

    const tanggalCetak = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const tglTtd = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }); 
    const logoUrl = window.location.origin + window.location.pathname.replace(/index\.html$/i, '') + 'asset/logo.png';
    const printWindow = window.open('', '_blank');
    if (!printWindow) return Swal.fire({ icon: 'error', title: 'Pop-up Diblokir!', text: 'Browser memblokir tab baru.' });

    printWindow.document.write(`
        <!DOCTYPE html><html lang="id"><head><title>Cetak_Bintang_Pelajar</title>
        <style>
          @page { margin: 15mm; }
          body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; background: #fff; margin: 0; padding: 0; }
          .footer { text-align: center; font-size: 10px; font-style: italic; color: #555; margin-top: 30px; border-top: 1px dashed #aaa; padding-top: 10px; }
        </style></head><body>
            <div style="display: flex; align-items: center; border-bottom: 3px solid #d97706; padding-bottom: 10px; margin-bottom: 25px;">
                <img src="${logoUrl}" style="width: 70px; height: 70px; object-fit: contain; margin-right: 15px;" onerror="this.style.display='none'">
                <div style="flex: 1; text-align: center; padding-right: 85px;">
                    <h2 style="margin: 0; font-size: 24px; text-transform: uppercase; font-weight: bold; color: #b45309;">Madrasah Darussalam</h2>
                    <p style="margin: 5px 0 0 0; font-size: 14px; font-weight: bold;">Laporan Eksekutif: Daftar Bintang Pelajar (Juara Umum Per Tingkatan)</p>
                </div>
            </div>
            
            ${gridHTML}
            
            <div style="margin-top: 40px; display: flex; justify-content: flex-end; padding-right: 20px; page-break-inside: avoid;">
                <div style="text-align: center; width: 250px;">
                    <p style="margin: 0 0 5px 0; font-size: 12px;">Bangkalan, ${tglTtd}</p>
                    <p style="margin: 0; font-size: 12px; font-weight: bold;">Panitia Ujian Madrasah</p>
                    <div style="height: 80px;"></div>
                    <p style="margin: 0; font-size: 12px; font-weight: bold; text-decoration: underline;">( .................................................... )</p>
                </div>
            </div>

            <div class="footer">Dokumen ini dicetak otomatis dari Sistem Penilaian Santri | Tanggal Cetak: ${tanggalCetak}</div>
            <script>window.onload = function() { setTimeout(function() { window.print(); }, 1000); };<\/script>
        </body></html>
    `);
    printWindow.document.close();
}

function updateWaktuLokal() {
    const sekarang = new Date();
    
    const jam = sekarang.getHours().toString().padStart(2, '0');
    const menit = sekarang.getMinutes().toString().padStart(2, '0');
    const detik = sekarang.getSeconds().toString().padStart(2, '0');
    const elemenJam = document.getElementById('waktu-jam');
    if (elemenJam) elemenJam.innerText = `${jam}:${menit}:${detik}`;

    const offsetWIB = 7 * 60 * 60 * 1000; 
    const totalHari = Math.floor((sekarang.getTime() + offsetWIB) / 86400000);
    
    const arrPasaran = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'];
    const pasaranJawa = arrPasaran[(totalHari + 3) % 5]; 

    const opsiMasehi = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    let teksMasehi = sekarang.toLocaleDateString('id-ID', opsiMasehi);
    
    let bagianTeks = teksMasehi.split(','); 
    teksMasehi = `${bagianTeks[0]} ${pasaranJawa}, ${bagianTeks[1]} M`;

    const elemenMasehi = document.getElementById('waktu-masehi');
    if (elemenMasehi) elemenMasehi.innerText = teksMasehi.toUpperCase();

    try {
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
        const parts = formatter.formatToParts(sekarang);
        
        let hDay = "", hMonth = "", hYear = "";
        parts.forEach(p => {
            if (p.type === 'day') hDay = p.value;
            if (p.type === 'month') hMonth = p.value;
            if (p.type === 'year') hYear = p.value;
        });

        const namaBulanHijriyah = [
            "", "Muharram", "Safar", "Rabiul Awal", "Rabiul Akhir", 
            "Jumadil Awal", "Jumadil Akhir", "Rajab", "Sya'ban", 
            "Ramadhan", "Syawal", "Dzulqa'dah", "Dzulhijjah"
        ];
        
        let teksHijriyah = `${hDay} ${namaBulanHijriyah[parseInt(hMonth)]} ${hYear} H`;
        
        const elemenHijriyah = document.getElementById('waktu-hijriyah');
        if (elemenHijriyah) elemenHijriyah.innerText = teksHijriyah.toUpperCase();

    } catch (e) {
        console.log("Kalender Hijriyah tidak didukung.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateWaktuLokal();
    setInterval(updateWaktuLokal, 1000);
});

// =========================================================
// FUNGSI LOAD TABEL MUTASI (DIPERBAIKI)
// =========================================================
function loadTabelMutasi() {
    const kelasAsal = document.getElementById('mutasiKelasAsal').value;
    const tbody = document.getElementById('bodyTabelMutasi');
    const cekSemua = document.getElementById('cekSemuaMutasi');
    
    // Reset checkbox master
    if (cekSemua) cekSemua.checked = false;
    tbody.innerHTML = '';

    if (!kelasAsal) return;

    const santriKelas = GLOBAL_DATA_SANTRI.filter(s => s.kelas === kelasAsal);
    
    if (santriKelas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold"><i class="fas fa-exclamation-triangle mr-2"></i>Tidak ada santri di kelas ini.</td></tr>';
        return;
    }

    // Menggunakan array untuk rendering lebih cepat & mencegah lag browser
    let barisHTML = [];
    santriKelas.forEach((s, index) => {
        barisHTML.push(`
            <tr class="hover:bg-indigo-50 transition-all cursor-pointer" onclick="const cb = this.querySelector('.cek-mutasi'); cb.checked = !cb.checked;">
                <td class="p-3 text-center border-r border-gray-100" onclick="event.stopPropagation()">
                    <input type="checkbox" class="cek-mutasi w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer" value="${s.nis}">
                </td>
                <td class="p-3 text-center font-bold text-gray-500 border-r border-gray-100">${index + 1}</td>
                <td class="p-3 text-gray-600 font-medium border-r border-gray-100">${escapeHTML(s.nis)}</td>
                <td class="p-3 font-bold text-gray-800 border-r border-gray-100">${escapeHTML(s.nama)}</td>
                <td class="p-3 text-center"><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">${escapeHTML(s.kelas)}</span></td>
            </tr>
        `);
    });
    tbody.innerHTML = barisHTML.join('');
}

function toggleSemuaMutasi(source) {
    const checkboxes = document.querySelectorAll('.cek-mutasi');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

// =========================================================
// FUNGSI PROSES MUTASI (DIPERBAIKI DENGAN PENGAMANAN FETCH)
// =========================================================
function prosesMutasi() {
    const kelasTujuan = document.getElementById('mutasiKelasTujuan').value;
    const checkboxes = document.querySelectorAll('.cek-mutasi:checked');
    
    if (checkboxes.length === 0) return Swal.fire('Pilih Santri', 'Silakan centang minimal satu santri yang akan dimutasi.', 'warning');
    if (!kelasTujuan) return Swal.fire('Pilih Tujuan', 'Silakan pilih kelas tujuan mutasi atau status Lulus.', 'warning');

    let nisList = [];
    checkboxes.forEach(cb => nisList.push(cb.value));

    Swal.fire({
        title: 'Peringatan Mutasi!',
        html: `Anda akan memindahkan <b>${nisList.length} santri</b> ke: <b class="text-indigo-600">${kelasTujuan}</b><br><br>
               <div class="bg-amber-50 border border-amber-200 p-3 rounded-xl text-amber-800 text-sm text-left shadow-inner">
                   <i class="fas fa-exclamation-triangle text-amber-600 mr-2 text-lg"></i> <b>PERHATIAN PENTING:</b><br>
                   Pastikan semua <b>Rapor</b> kelas asal sudah dicetak! Setelah dimutasi, nama santri tidak akan muncul lagi di menu cetak kelas sebelumnya.
               </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#d33',
        confirmButtonText: '<i class="fas fa-check mr-2"></i> Ya, Lanjutkan Mutasi',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            showLoading(true, "Memproses Mutasi...");
            
            try {
                const formData = new URLSearchParams();
                formData.append('action', 'mutasiSantri');
                formData.append('token', sessionStorage.getItem('tokenMadasa')); 
                formData.append('kelas_tujuan', kelasTujuan);
                formData.append('nis_list', JSON.stringify(nisList));

                // Menggunakan asyc/await untuk fetch yang lebih stabil
                const response = await gasFetch( { method: 'POST', body: formData });
                
                // PENGAMANAN UTAMA: Blokir jika server Google me-redirect ke halaman error HTML
                if (!response.ok) throw new Error("Respons server tidak valid (Bukan 200 OK)");
                
                const res = await response.json();

                if (res.status === 'success') {
                    showLoading(false); 
                    Swal.fire('Berhasil!', res.message, 'success');

                    // Reset form Mutasi setelah sukses
                    document.getElementById('mutasiKelasAsal').value = '';
                    document.getElementById('text_mutasiKelasAsal').innerText = '-- Pilih Kelas Asal --'; 
                    document.getElementById('mutasiKelasTujuan').value = '';
                    document.getElementById('text_mutasiKelasTujuan').innerText = '-- Pilih Tujuan --'; 
                    
                    const tbody = document.getElementById('bodyTabelMutasi');
                    if(tbody) {
                        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-gray-400"><i class="fas fa-check-circle text-4xl mb-2 text-emerald-400 block"></i>Mutasi selesai.</td></tr>';
                    }
                    
                    // Tarik data santri terbaru di latar belakang (mode senyap)
                    loadDataSantri(true); 
                } else {
                    showLoading(false);
                    Swal.fire('Gagal', res.message, 'error');
                }
            } catch (e) {
                showLoading(false);
                console.error("Detail Error Sistem:", e);
                Swal.fire('Error Sistem', 'Terjadi kesalahan jaringan atau server menolak permintaan.', 'error');
            }
        }
    });
}

function toggleSidebarMobile() {
    const sidebar = document.querySelector('aside');
    
    if (sidebar.classList.contains('hidden')) {
        window.history.pushState({ menu: 'sidebar' }, "", "#menu");
        
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex', 'fixed', 'inset-y-0', 'left-0', 'w-64', 'z-[60]', 'shadow-2xl');
        
        if (!document.getElementById('overlay-sidebar')) {
            const overlay = document.createElement('div');
            overlay.id = 'overlay-sidebar';
            overlay.className = 'fixed inset-0 bg-black/50 z-[50] md:hidden backdrop-blur-sm transition-all';
            
            overlay.onclick = () => { window.history.back(); }; 
            
            document.body.appendChild(overlay);
        }
        
    } else {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex', 'fixed', 'inset-y-0', 'left-0', 'w-64', 'z-[60]', 'shadow-2xl');
        
        const overlay = document.getElementById('overlay-sidebar');
        if (overlay) overlay.remove();
    }
}

function tampilkanProfilDeveloper() {
    window.history.pushState({ modal: 'profil' }, "", "#profil");

    Swal.fire({
        html: `
            <div class="text-center pt-1">
                <div class="w-20 h-20 bg-white rounded-full mx-auto flex items-center justify-center border-4 border-emerald-500 mb-3 shadow-md overflow-hidden">
                    <img src="asset/arom.png" alt="Profile" class="w-full h-full object-cover">
                </div>
                
                <h3 class="text-lg font-heading font-bold text-gray-800 mb-0.5">Arom Kobama</h3>
                <p class="text-[11px] text-emerald-600 font-bold mb-3 tracking-widest uppercase">Fullstack Developer</p>
                
                <div class="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-5 text-xs text-gray-600 text-center leading-relaxed">
                    <b class="text-gray-800">Madasa v1.0</b><br>
                    Sistem informasi ini dikembangkan dengan dedikasi untuk mempermudah digitalisasi penilaian santri.
                </div>
                
                <p class="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wider">Temukan saya di:</p>
                <div class="flex justify-center gap-3">
                    <a href="https://www.instagram.com/aromkobama/" target="_blank" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-pink-600 hover:bg-pink-100 transition-all shadow-sm"><i class="fab fa-instagram text-base"></i></a>
                    <a href="https://www.tiktok.com/@putramadasa/" target="_blank" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-black hover:bg-gray-200 transition-all shadow-sm"><i class="fab fa-tiktok text-base"></i></a>
                    <a href="https://www.facebook.com/arom.kobama.2025/" target="_blank" class="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all shadow-sm"><i class="fab fa-facebook-f text-base"></i></a>
                </div>
            </div>
        `,
        width: '320px',
        showConfirmButton: true,
        confirmButtonText: '<i class="fas fa-times mr-2"></i>Tutup',
        confirmButtonColor: '#059669',
        showCloseButton: true,
        customClass: {
            popup: 'rounded-[1.5rem] p-4',
            confirmButton: 'rounded-xl font-bold px-5 py-2 text-sm shadow-md'
        }
    }).then(() => {
        if (window.location.hash === "#profil") {
            window.history.back();
        }
    });
}

const dataMotivasiBanner = [
    { judul: "Benih Kebaikan", teks: "\"Setiap ilmu yang kau ajarkan adalah bibit amal jariyah yang akan terus mengalirkan pahala, bahkan saat engkau telah tiada.\"" },
    { judul: "Cahaya Ilmu", teks: "\"Jadilah lentera di tengah kegelapan, sebab satu kalimat hikmah yang kau sampaikan lebih berharga daripada dunia dan segala isinya.\"" },
    { judul: "Pahlawan Senyap", teks: "\"Meski jasamu sering tak terlihat, ingatlah bahwa Allah Maha Melihat setiap tetes keringat yang jatuh demi mencerdaskan ummat.\"" },
    { judul: "Ikhlas Mendidik", teks: "\"Bukan nominal yang menjadi tujuan, namun ridha Allah yang kau cari dalam setiap langkahmu memasuki ruang kelas setiap hari.\"" },
    { judul: "Jalan Surga", teks: "\"Barangsiapa menempuh jalan untuk menuntut atau mengajarkan ilmu, maka Allah akan memudahkan baginya jalan menuju surga.\"" },
    { judul: "Ladang Pahala", teks: "\"Jangan pernah mengeluh lelah, sebab setiap detik yang kau habiskan bersama murid-murid adalah investasi berharga di akhirat kelak.\"" },
    { judul: "Sabar Tanpa Tepi", teks: "\"Hadapi kenakalan murid dengan kesabaran yang indah, karena itulah ujian yang akan mengangkat derajatmu setinggi-tingginya di sisi Allah.\"" },
    { judul: "Hati Terpanggil", teks: "\"Panggilan jiwamu menjadi guru bukan sekadar profesi, melainkan amanah besar yang kelak akan dimintai pertanggungjawaban di hadapan-Nya.\"" },
    { judul: "Pelita Ummat", teks: "\"Tugasmu mulia karena engkau sedang menjaga warisan para Nabi, yakni menyebarkan ilmu yang bermanfaat bagi kehidupan manusia.\"" },
    { judul: "Tulus Mengabdi", teks: "\"Kemuliaan seorang guru terletak pada keikhlasan hati dalam berbakti, bukan pada pujian manusia maupun besaran materi yang diterima.\"" },
    { judul: "Batu Bata", teks: "\"Setiap nasihat baik yang kau berikan adalah batu bata yang sedang kau susun untuk membangun peradaban Islam yang kokoh di masa depan.\"" },
    { judul: "Kunci Hati", teks: "\"Ilmu akan sulit meresap ke dalam akal jika tidak disiram dengan keikhlasan hati. Dekati muridmu dengan kasih sayang, ajari dengan keteladanan.\"" },
    { judul: "Pewaris Peradaban", teks: "\"Jangan bersedih saat dunia terasa sempit, karena tugasmu adalah mendidik calon-calon pemimpin ummat yang akan mendoakanmu kelak.\"" },
    { judul: "Tetap Bersinar", teks: "\"Jaga semangatmu tetap menyala, karena engkau adalah sumber energi bagi murid-muridmu dalam menapaki jalan kebenaran.\"" },
    { judul: "Bakti Murni", teks: "\"Mengajar adalah bentuk ibadah yang agung. Luruskan niatmu semata-mata karena Allah, maka lelahmu akan berganti menjadi berkah.\"" },
    { judul: "Karsa Mulia", teks: "\"Niat tulusmu dalam mendidik adalah saksi bisu di hari kiamat nanti, bahwa engkau telah berusaha menjaga amanah-Nya sebaik mungkin.\"" },
    { judul: "Benih Abadi", teks: "\"Apa yang kau tanam di pikiran dan hati muridmu hari ini, akan menjadi panen kebaikan yang terus dipetik hingga akhir zaman.\"" },
    { judul: "Syukur Guru", teks: "\"Bersyukurlah karena tanganmu dipilih oleh Allah untuk membentuk karakter manusia. Itu adalah kehormatan yang tak dimiliki sembarang orang.\"" },
    { judul: "Ujian Sabar", teks: "\"Di balik setiap kesulitan mendidik, ada pahala sabar yang sedang dicatat oleh malaikat. Jangan pernah menyerah, Allah bersamamu.\"" },
    { judul: "Pemberi Harapan", teks: "\"Seringkali engkau adalah alasan seorang anak untuk terus bermimpi. Teruslah menjadi inspirasi yang membawa mereka dekat pada-Nya.\"" },
    { judul: "Etos Kerja", teks: "\"Profesionalitasmu dalam mendidik adalah cerminan iman. Berikan yang terbaik, karena engkau sedang bekerja untuk Allah SWT.\"" },
    { judul: "Cinta Ilmu", teks: "\"Mengajar adalah cara terbaik untuk terus belajar. Semakin engkau memberi, semakin Allah akan membukakan pintu hikmah untukmu.\"" },
    { judul: "Jiwa Tangguh", teks: "\"Badai tantangan dalam mendidik tidak boleh mematahkan semangatmu, karena kekuatanmu bersumber dari pertolongan Allah yang Maha Kuat.\"" },
    { judul: "Pendidik Sejati", teks: "\"Guru sejati adalah ia yang mendidik dengan cinta dan mengharap balasan hanya dari Allah, bukan dari manusia.\"" },
    { judul: "Teguh Berdiri", teks: "\"Tetaplah teguh sebagai penunjuk jalan kebaikan, meski keadaan sulit, karena setiap huruf yang kau ajarkan adalah cahaya di dalam kubur.\"" },
    { judul: "Senyum Ikhlas", teks: "\"Senyum ramahmu di depan kelas adalah sedekah. Ia mampu mencairkan hati murid yang keras dan membuka pintu hidayah.\"" },
    { judul: "Tangan Berkah", teks: "\"Tangan yang digunakan untuk menuliskan ilmu dan membimbing murid adalah tangan yang didoakan keberkahan oleh penduduk langit dan bumi.\"" },
    { judul: "Misi Suci", teks: "\"Engkau sedang berjuang mencetak generasi yang lebih baik dan lebih bertakwa dari generasimu. Teruskan perjuangan suci ini!\"" },
    { judul: "Pendar Cahaya", teks: "\"Jadilah guru yang tidak hanya transfer materi, tapi juga transfer nilai-nilai iman yang akan membimbing mereka hingga akhirat.\"" },
    { judul: "Dedikasi Hati", teks: "\"Keikhlasanmu adalah kunci keberkahan ilmu. Tanpanya, ilmu hanya akan menjadi pengetahuan, namun dengannya, ilmu menjadi hidayah.\"" },
    { judul: "Amanah Mulia", teks: "\"Mendidik manusia adalah pekerjaan para Nabi. Sadarilah betapa mulia posisi yang sedang engkau tempati saat ini.\"" },
    { judul: "Lelah Berkah", teks: "\"Lelahmu hari ini adalah saksi perjuangan di hari penghisaban. Tidurlah dengan tenang, Allah tidak menyia-nyiakan amal hambanya.\"" },
    { judul: "Waktu Emas", teks: "\"Setiap waktu yang kau habiskan di dalam kelas adalah kesempatan untuk mengukir sejarah kebaikan dalam diri seseorang.\"" }
];

let timerBannerMotivasi; 
let timeoutBannerTransisi; 

function rotasiMotivasiBanner() {
    const elJudul = document.getElementById('judulBanner');
    const elTeks = document.getElementById('teksBanner');
    
    if (!elJudul || !elTeks) return;

    clearTimeout(timeoutBannerTransisi);

    elJudul.style.opacity = '0';
    elTeks.style.opacity = '0';

    timeoutBannerTransisi = setTimeout(() => {
        const acak = Math.floor(Math.random() * dataMotivasiBanner.length);
        
        elJudul.innerText = dataMotivasiBanner[acak].judul;
        elTeks.innerText = dataMotivasiBanner[acak].teks;
        
        elJudul.style.opacity = '1';
        elTeks.style.opacity = '1';
    }, 700); 
}

function jalankanBannerOtomatis() {
    clearInterval(timerBannerMotivasi);
    rotasiMotivasiBanner();
    timerBannerMotivasi = setInterval(rotasiMotivasiBanner, 10000);
}



function buatOpsiSemuaKelasOtomatis() {
    const kelasUnik = [...new Set(GLOBAL_DATA_SANTRI.map(s => s.kelas))].filter(Boolean).sort();
    let kelompokKelas = {};
    let bobotJenjang = { "TK / RA": 1, "IBTIDAIYAH": 2, "SANAWIYAH": 3, "ALIYAH": 4 };
    
    kelasUnik.forEach(k => {
        // PERBAIKAN: Ubah paksa data menjadi teks (String) agar tidak crash jika diisi angka
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

    let kategoriUrut = Object.keys(kelompokKelas).sort((a, b) => (bobotJenjang[a] || 99) - (bobotJenjang[b] || 99));

    // MODIFIKASI: Memisahkan template HTML untuk Semua vs Kelas Aktif
    let htmlListDasar = ''; // Berisi semua kelas (termasuk Alumni)
    let htmlListAktif = ''; // Hanya kelas aktif (tanpa Alumni/DO)

    kategoriUrut.forEach(kategori => {
        let itemDasar = '';
        let itemAktif = '';

        kelompokKelas[kategori].forEach(kelas => {
            let safeKelas = kelas.replace(/'/g, "\\'");
            let isAlumni = kelas.toLowerCase().includes('lulus') || 
                           kelas.toLowerCase().includes('alumni') || 
                           kelas.toLowerCase().includes('diberhentikan');
            
            let liHTML = `<li class="custom-option-item" onclick="pilihKelasCustomGlobal('TARGET_ID', '${safeKelas}', '${safeKelas}', 'TARGET_CALLBACK')">${kelas}</li>`;
            
            itemDasar += liHTML;
            if (!isAlumni) {
                itemAktif += liHTML; // Hanya masukkan jika bukan alumni
            }
        });

        if (itemDasar !== '') {
            htmlListDasar += `<li class="custom-option-group"><i class="fas fa-layer-group mr-2 opacity-50"></i>${kategori}</li>` + itemDasar;
        }
        if (itemAktif !== '') {
            htmlListAktif += `<li class="custom-option-group"><i class="fas fa-layer-group mr-2 opacity-50"></i>${kategori}</li>` + itemAktif;
        }
    });

    // Menambahkan properti "useAktifOnly" pada setiap konfigurasi dropdown
    const listDropdown = [
        { id: 'filterKelasSantri', defaultText: 'Semua Kelas', defaultValue: 'Semua', callback: 'filterSantri', useAktifOnly: false },
        { id: 'pilihKelasNilai', defaultText: '-- Silakan Pilih Kelas Dulu --', defaultValue: '', callback: 'aktifkanFilterKedua', useAktifOnly: true },
        { id: 'filterKelasDataNilai', defaultText: '-- Pilih Kelas Terlebih Dahulu --', defaultValue: '', callback: '', useAktifOnly: true },
        { id: 'filterKelasRanking', defaultText: '-- Pilih Kelas Untuk Melihat Ranking --', defaultValue: '', callback: '', useAktifOnly: true },
        { id: 'settingKelas', defaultText: '-- Pilih Kelas --', defaultValue: '', callback: 'loadSettingRapor', useAktifOnly: true },
        { id: 'mutasiKelasAsal', defaultText: '-- Pilih Kelas Asal --', defaultValue: '', callback: 'loadTabelMutasi', useAktifOnly: true },
        { id: 'mutasiKelasTujuan', defaultText: '-- Pilih Tujuan --', defaultValue: '', callback: '', useAktifOnly: true },
        { id: 'add_kelas', defaultText: 'Pilih...', defaultValue: '', callback: '', useAktifOnly: true },
        { id: 'edit_kelas', defaultText: 'Pilih...', defaultValue: '', callback: '', useAktifOnly: false } // Edit bisa jadi perlu mengakses Alumni
    ];

    listDropdown.forEach(dropdown => {
        const listEl = document.getElementById('list_' + dropdown.id);
        if (listEl) {
            let specificHtml = `<li class="custom-option-item text-gray-400 text-center !pl-3" onclick="pilihKelasCustomGlobal('${dropdown.id}', '${dropdown.defaultValue}', '${dropdown.defaultText}', '${dropdown.callback}')">-- Reset / ${dropdown.defaultText} --</li>`;

            if (dropdown.id === 'mutasiKelasTujuan') {
                specificHtml += `
                <li class="custom-option-item text-green-600 font-bold" onclick="pilihKelasCustomGlobal('${dropdown.id}', 'Lulus / Alumni', '🎓 LULUS / ALUMNI', '')">🎓 LULUS / ALUMNI</li>
                <li class="custom-option-item text-red-600 font-bold" onclick="pilihKelasCustomGlobal('${dropdown.id}', 'Diberhentikan', '🚫 DIBERHENTIKAN (DO)', '')">🚫 DIBERHENTIKAN (DO)</li>
                <li class="custom-option-group text-center text-gray-300">───────────────</li>`;
            }

            // Terapkan list html yang sesuai (semua atau hanya aktif)
            let sourceHtml = dropdown.useAktifOnly ? htmlListAktif : htmlListDasar;
            let finalHtml = sourceHtml.replace(/TARGET_ID/g, dropdown.id).replace(/TARGET_CALLBACK/g, dropdown.callback);
            
            listEl.innerHTML = specificHtml + finalHtml;
        }
    });

    const wadahFilterKedua = document.getElementById('wadahFilterKedua');
    if (wadahFilterKedua) wadahFilterKedua.classList.add('hidden');
    const formInputNilaiBulk = document.getElementById('formInputNilaiBulk');
    if (formInputNilaiBulk) formInputNilaiBulk.classList.add('hidden');
    const formSettingRapor = document.getElementById('formSettingRapor');
    if (formSettingRapor) formSettingRapor.classList.add('hidden');
}

function toggleCustomSelectGlobal(id) {
    const list = document.getElementById('list_' + id);
    const icon = document.getElementById('icon_' + id);
    
    document.querySelectorAll('[id^="list_"]').forEach(el => {
        if (el.id !== 'list_' + id) el.classList.add('hidden');
    });
    document.querySelectorAll('[id^="icon_"]').forEach(el => {
        if (el.id !== 'icon_' + id) el.classList.remove('rotate-180');
    });

    if(list) list.classList.toggle('hidden');
    if(icon) icon.classList.toggle('rotate-180');
}

function pilihKelasCustomGlobal(id, nilai, teks, callbackName) {
    const inputEl = document.getElementById(id);
    const textEl = document.getElementById('text_' + id);
    
    if(inputEl) inputEl.value = nilai; 
    if(textEl) textEl.innerText = teks; 
    
    toggleCustomSelectGlobal(id); 
    
    if (callbackName && typeof window[callbackName] === 'function') {
        window[callbackName]();
    }
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrapper')) {
        document.querySelectorAll('[id^="list_"]').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('[id^="icon_"]').forEach(el => el.classList.remove('rotate-180'));
    }
});

async function downloadTemplateExcel() {
    showLoading(true); 

    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Data Santri');

        sheet.columns = [
            { header: 'NIS', key: 'nis', width: 15 },
            { header: 'Nama Lengkap', key: 'nama', width: 28 },
            { header: 'L/P', key: 'jk', width: 12 },
            { header: 'Tempat & Tanggal Lahir', key: 'ttl', width: 30 },
            { header: 'Kelas', key: 'kelas', width: 20 },
            { header: 'Alamat/Domisili', key: 'alamat', width: 35 },
            { header: 'Nama Ayah', key: 'ayah', width: 22 },
            { header: 'Nama Ibu', key: 'ibu', width: 22 },
            { header: 'No HP/WA', key: 'hp', width: 18 }
        ];

        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF059669' } 
            };
            cell.font = {
                color: { argb: 'FFFFFFFF' }, 
                bold: true 
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        sheet.addRow({nis: '84260001', nama: 'Ahmad Hafiz', jk: 'Laki-laki', ttl: 'Bangkalan, 12 Januari 2020', kelas: 'TK - Kelas A', alamat: 'Jl. Kenanga No. 12 Bangkalan', ayah: 'Budi Santoso', ibu: 'Siti Aminah', hp: '081234567890'});
        sheet.addRow({nis: '84260002', nama: 'Aisyah Azzahra', jk: 'Perempuan', ttl: 'Surabaya, 05 Maret 2016', kelas: 'IBT - Kelas 3', alamat: 'Jl. Melati No. 5 Surabaya', ayah: 'Ahmad Fauzi', ibu: 'Nurul Hidayah', hp: '081298765432'});
        sheet.addRow({nis: '84260003', nama: 'Muhammad Fatih', jk: 'Laki-laki', ttl: 'Sampang, 20 Agustus 2013', kelas: 'SANA - Kelas 1', alamat: 'Desa Banyuates, Sampang', ayah: 'Abdul Somad', ibu: 'Fatimah', hp: '085234567891'});
        sheet.addRow({nis: '84260004', nama: 'Zahra Nabila', jk: 'Perempuan', ttl: 'Pamekasan, 10 November 2010', kelas: 'ALIYAH - Kelas 10', alamat: 'Jl. Pahlawan, Pamekasan', ayah: 'Hasan Basri', ibu: 'Amina', hp: '087712345678'});

        sheet.getColumn('hp').eachCell((cell, rowNumber) => {
            if (rowNumber > 1) { 
                cell.numFmt = '@'; 
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Template_Import_Madasa.xlsx"; 
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showLoading(false); 
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Template Excel Siap Digunakan!',
            showConfirmButton: false,
            timer: 3000
        });
        
    } catch (error) {
        showLoading(false);
        console.error(error);
        Swal.fire('Error', 'Terjadi kesalahan saat membuat file Excel.', 'error');
    }
}

function hapusDataSantri(nis, nama) {
    Swal.fire({
        title: 'Hapus Santri?',
        html: `Apakah Anda yakin ingin menghapus <b>${nama}</b> (NIS: ${nis})?<br><br><span class="text-red-500 text-xs font-bold"><i class="fas fa-exclamation-triangle"></i> Peringatan: Data yang dihapus tidak bisa dikembalikan!</span>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-trash-alt mr-2"></i> Ya, Hapus!',
        cancelButtonText: 'Batal',
        customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'rounded-xl',
            cancelButton: 'rounded-xl'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true, "Menghapus Data...");
            
            const formData = new URLSearchParams();
            formData.append('action', 'deleteSantri');
            formData.append('token', sessionStorage.getItem('tokenMadasa'));
            formData.append('nis', nis);

            gasFetch( { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                showLoading(false);
                if(data.status === 'success') {
                    Swal.fire('Terhapus!', data.message, 'success');
                    loadDataSantri(); 
                    buatOpsiSemuaKelasOtomatis(); 
                } else {
                    Swal.fire('Gagal', data.message, 'error');
                }
            }).catch(err => {
                showLoading(false);
                Swal.fire('Error', 'Gagal menghubungi server.', 'error');
            });
        }
    });
}

function resetTahunAjaran() {
    Swal.fire({
        title: 'PERINGATAN KERAS!',
        html: `Fitur ini akan <b>MENGHAPUS SEMUA DATA NILAI DAN DETAIL RAPOR LAMA</b> di database.<br><br>
               Lakukan ini <b>HANYA</b> jika:
               <ul class="text-left text-sm mt-3 mb-4 list-disc pl-5 text-gray-700">
                   <li>Semua Rapor semester sebelumnya <b>sudah dicetak</b>.</li>
                   <li>Anda sudah <b>mem-backup</b> database Google Sheets (Buka file Database -> File -> Buat Salinan).</li>
                   <li>Semua santri <b>telah selesai dimutasi</b> ke kelas baru.</li>
               </ul>
               Ketik <b>RESET</b> di bawah ini untuk melanjutkan:`,
        input: 'text',
        inputAttributes: {
            autocapitalize: 'off',
            placeholder: 'Ketik RESET di sini...'
        },
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-exclamation-triangle mr-1"></i> Eksekusi Hapus',
        cancelButtonText: 'Batal',
        customClass: {
            popup: 'rounded-2xl',
            confirmButton: 'rounded-xl',
            cancelButton: 'rounded-xl',
            input: 'text-center font-bold text-red-600'
        },
        preConfirm: (inputValue) => {
            if (inputValue !== 'RESET') {
                Swal.showValidationMessage('Teks tidak sesuai. Ketik RESET dengan huruf besar!');
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            showLoading(true, "Mereset Database Nilai...");
            
            const fd = new URLSearchParams();
            fd.append('action', 'resetDataTahunAjaran');
            fd.append('token', sessionStorage.getItem('tokenMadasa'));

            gasFetch( { method: 'POST', body: fd })
            .then(r => r.json())
            .then(res => {
                showLoading(false);
                if (res.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Berhasil Reset!',
                        text: res.message,
                        confirmButtonColor: '#059669',
                        customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl' }
                    });
                } else {
                    Swal.fire('Gagal', res.message, 'error');
                }
            })
            .catch(e => {
                showLoading(false);
                Swal.fire('Error', 'Koneksi ke server gagal. Periksa jaringan Anda.', 'error');
            });
        }
    });
}

function downloadExcelNilai() {
    let tabelNilai = document.getElementById("tabelDataNilai"); 
    
    if (!tabelNilai) {
        Swal.fire('Gagal', 'Tabel data nilai tidak ditemukan di halaman.', 'error');
        return;
    }

    let tbody = document.getElementById("bodyDataNilai");
    if (tbody && tbody.innerText.includes("Silakan pilih kelas")) {
        Swal.fire('Perhatian', 'Belum ada data nilai yang bisa di-download.', 'warning');
        return;
    }

    let elemenKelas = document.getElementById("filterKelasDataNilai"); 
    let namaKelas = elemenKelas && elemenKelas.value !== "" ? elemenKelas.value : "Kelas_Tidak_Diketahui";
    let namaFileAman = "Rekap_Nilai_" + namaKelas.replace(/\s+/g, '_') + ".xlsx";

    try {
        if (typeof showLoading === 'function') showLoading(true, "Mempersiapkan file Excel...");
        
        let workbook = XLSX.utils.table_to_book(tabelNilai, {sheet: "Data Nilai"});
        XLSX.writeFile(workbook, namaFileAman);
        
        if (typeof showLoading === 'function') showLoading(false);
    } catch (error) {
        if (typeof showLoading === 'function') showLoading(false);
        console.error(error);
        Swal.fire('Error', 'Terjadi kesalahan saat memproses file Excel.', 'error');
    }
}

// =========================================================
// RESET SIDEBAR SAAT UKURAN LAYAR BERUBAH (RESPONSIVE FIX)
// =========================================================
window.addEventListener('resize', function() {
    // 768px adalah batas ukuran layar desktop (breakpoint 'md' pada Tailwind)
    if (window.innerWidth >= 768) {
        const sidebar = document.querySelector('aside');
        const overlay = document.getElementById('overlay-sidebar');
        
        // Jika overlay ada, berarti menu HP sedang terbuka saat layar dibesarkan
        if (sidebar && overlay) {
            // Hapus class mode HP dan kembalikan ke class bawaan Desktop
            sidebar.classList.add('hidden');
            sidebar.classList.remove('flex', 'fixed', 'inset-y-0', 'left-0', 'w-64', 'z-[60]', 'shadow-2xl');
            
            // Hapus latar belakang gelap
            overlay.remove();
            
            // Rapikan kembali URL jika ada hash #menu
            if (window.location.hash === '#menu') {
                window.history.back();
            }
        }
    }
});

// =========================================================
// FUNGSI POPUP TEMPLATE CATATAN & KEPUTUSAN GURU
// =========================================================

window.bukaOpsiKeputusan = function(btn, opsiNaik, opsiTinggal) {
    window.targetInputAktif = btn.previousElementSibling; // Menyimpan target kotak input
    const html = `
        <div class="flex flex-col gap-3 text-left mt-2">
            <button onclick="pilihOpsiTeks('${opsiNaik}')" class="p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-sm sm:text-base transition-all text-left shadow-sm flex items-center gap-3"><i class="fas fa-arrow-up text-emerald-500 text-xl"></i> <span>${opsiNaik}</span></button>
            <button onclick="pilihOpsiTeks('${opsiTinggal}')" class="p-4 border-2 border-orange-200 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-sm sm:text-base transition-all text-left shadow-sm flex items-center gap-3"><i class="fas fa-redo text-orange-500 text-xl"></i> <span>${opsiTinggal}</span></button>
            <button onclick="pilihOpsiTeks('Lulus dari Madrasah')" class="p-4 border-2 border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-sm sm:text-base transition-all text-left shadow-sm flex items-center gap-3"><i class="fas fa-graduation-cap text-blue-500 text-xl"></i> <span>Lulus dari Madrasah</span></button>
        </div>
    `;
    Swal.fire({
        title: '<span class="text-emerald-700 font-bold font-heading">Pilih Keputusan</span>',
        html: html,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: { popup: 'rounded-2xl p-4 sm:p-6' }
    });
};

window.bukaOpsiCatatan = function(btn, isTK) {
    window.targetInputAktif = btn.previousElementSibling; // Menyimpan target kotak input
    let opsi = [];
    
    if (isTK) {
    opsi = [
        "Alhamdulillah, Ananda menunjukkan perkembangan yang baik. Tetap semangat belajar, teruslah menjadi anak yang ceria, mandiri, dan rajin agar semakin berkembang.",
        
        "Masya Allah, Ananda semakin aktif dan percaya diri dalam mengikuti kegiatan pembelajaran. Terus tumbuhkan semangat belajar, rasa ingin tahu, dan kebiasaan baik setiap hari.",
        
        "Ananda adalah anak yang ceria dan penuh semangat. Teruslah belajar dengan senang hati, berani mencoba hal baru, dan menjadi anak sholeh/sholehah yang membanggakan.",
        
        "Alhamdulillah, Ananda berkembang dengan baik dan menunjukkan semangat dalam belajar. Tetap rajin, percaya diri, dan terus berusaha menjadi pribadi yang lebih baik.",
        
        "Masya Allah, Ananda menunjukkan perkembangan yang positif. Teruslah semangat belajar, menjaga sikap baik, serta meningkatkan kemandirian dalam kegiatan sehari-hari."
    ];
} else {
    opsi = [
        "Alhamdulillah, Ananda menunjukkan perkembangan yang baik dalam pembelajaran. Terus tingkatkan semangat belajar, kedisiplinan, dan usaha untuk meraih prestasi yang lebih baik.",
        
        "Ananda memiliki potensi yang baik. Tetap semangat dalam menuntut ilmu, tingkatkan keaktifan belajar, dan terus berusaha memberikan hasil terbaik.",
        
        "Perkembangan Ananda cukup baik. Terus tingkatkan motivasi belajar, tanggung jawab, dan kedisiplinan agar mampu mencapai cita-cita yang diharapkan.",
        
        "Ananda menunjukkan kemampuan yang baik dalam mengikuti pembelajaran. Tetap semangat belajar, rajin berlatih, dan terus berusaha meraih keberhasilan.",
        
        "Teruslah bersemangat dalam menuntut ilmu, memperbaiki diri, dan menjaga akhlakul karimah. Semoga Allah SWT memberikan kemudahan dan keberkahan dalam setiap langkah Ananda."
    ];
}

    let buttonsHtml = opsi.map(teks => `
        <button onclick="pilihOpsiTeks('${teks.replace(/'/g, "\\'")}')" class="p-4 border-2 border-purple-200 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 font-medium text-sm transition-all text-left shadow-sm leading-relaxed w-full flex items-start gap-3">
            <i class="fas fa-quote-left text-purple-400 mt-1"></i> <span>${teks}</span>
        </button>
    `).join('');

    const html = `<div class="flex flex-col gap-3 text-left mt-2 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">${buttonsHtml}</div>`;
    
    Swal.fire({
        title: '<span class="text-purple-700 font-bold font-heading">Pilih Catatan Guru</span>',
        html: html,
        showConfirmButton: false,
        showCloseButton: true,
        width: '700px', // Agak dilebarkan sedikit di Desktop
        customClass: { popup: 'rounded-2xl p-4 sm:p-6' }
    });
};

window.pilihOpsiTeks = function(teks) {
    if (window.targetInputAktif) {
        window.targetInputAktif.value = teks;
        
        // Animasi hijau sebentar pada kotak teks agar tahu data berhasil masuk
        window.targetInputAktif.classList.add('bg-green-100', 'transition-colors', 'duration-500');
        setTimeout(() => {
            window.targetInputAktif.classList.remove('bg-green-100');
        }, 800);
    }
    Swal.close(); // Tutup popup
};

window.bukaOpsiKepribadian = function(inputEl, namaKolom) {
    // Menyimpan target kotak input yang diklik
    window.targetInputAktif = inputEl; 
    
    const html = `
        <div class="grid grid-cols-2 gap-3 text-center mt-2">
            <button onclick="pilihOpsiTeks('A')" class="p-4 border-2 border-emerald-200 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-2xl transition-all shadow-sm">A <span class="block text-xs font-medium text-emerald-600 mt-1">Sangat Baik</span></button>
            <button onclick="pilihOpsiTeks('B')" class="p-4 border-2 border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-2xl transition-all shadow-sm">B <span class="block text-xs font-medium text-blue-600 mt-1">Baik</span></button>
            <button onclick="pilihOpsiTeks('C')" class="p-4 border-2 border-orange-200 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold text-2xl transition-all shadow-sm">C <span class="block text-xs font-medium text-orange-600 mt-1">Cukup</span></button>
            <button onclick="pilihOpsiTeks('D')" class="p-4 border-2 border-red-200 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 font-bold text-2xl transition-all shadow-sm">D <span class="block text-xs font-medium text-red-600 mt-1">Kurang</span></button>
        </div>
        <div class="mt-4">
            <button onclick="pilihOpsiTeks('')" class="w-full p-3 border border-gray-200 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm transition-all shadow-sm"><i class="fas fa-eraser mr-2"></i>Kosongkan Nilai</button>
        </div>
    `;
    
    Swal.fire({
        title: `<span class="text-blue-700 font-bold font-heading">Nilai ${namaKolom}</span>`,
        html: html,
        showConfirmButton: false,
        showCloseButton: true,
        width: '360px',
        customClass: { popup: 'rounded-2xl p-4 sm:p-6' }
    });
};