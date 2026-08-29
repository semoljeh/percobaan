// === UI Toggles ===
function togglePassword() {
    const pwd = document.getElementById('password');
    const icon = document.getElementById('eyeIcon');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        pwd.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function showLoading(show, teks = "Memproses...") {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = show ? 'flex' : 'none';
    }
}

function showView(viewName) {
    // 1. Sembunyikan semua konten view
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden');
    });
    
    // 2. Tampilkan view yang dipilih
    const targetView = document.getElementById('view-' + viewName);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // 3. Update style tombol navigasi aktif di Sidebar Desktop
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('bg-emerald-700', 'text-white', 'font-medium');
        link.classList.add('text-emerald-100', 'hover:bg-emerald-700/50');
        
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${viewName}'`)) {
            link.classList.add('bg-emerald-700', 'text-white', 'font-medium');
            link.classList.remove('text-emerald-100', 'hover:bg-emerald-700/50');
        }
    });
}

// === Logika Filter & Pencarian Data Santri ===
function filterSantri() {
    const searchInput = document.getElementById('searchSantri');
    const filterKelas = document.getElementById('filterKelasSantri');
    if (!searchInput || !filterKelas) return;

    const searchText = searchInput.value.toLowerCase();
    const selectedKelas = filterKelas.value;
    const rows = document.querySelectorAll('.santri-row');
    
    let visibleCount = 0;

    rows.forEach(row => {
        const nama = row.cells[1].innerText.toLowerCase();
        const nis = row.cells[0].innerText.toLowerCase();
        const kelas = row.getAttribute('data-kelas');

        const matchSearch = nama.includes(searchText) || nis.includes(searchText);
        const matchKelas = selectedKelas === 'Semua' || kelas === selectedKelas;

        if (matchSearch && matchKelas) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const tabelContainer = document.getElementById('tabelSantri');
    const noDataPesan = document.getElementById('noDataPesan');
    
    if (visibleCount === 0) {
        if(tabelContainer) tabelContainer.parentElement.classList.add('hidden');
        if(noDataPesan) noDataPesan.classList.remove('hidden');
    } else {
        if(tabelContainer) tabelContainer.parentElement.classList.remove('hidden');
        if(noDataPesan) noDataPesan.classList.add('hidden');
    }
}

function logout() {
    Swal.fire({
        title: 'Keluar?',
        text: "Anda akan kembali ke halaman login",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            sessionStorage.removeItem('tokenMadasa'); // Hapus token dengan bersih
            document.getElementById('dashboardPage').classList.add('hidden');
            document.getElementById('loginPage').classList.remove('hidden');
            const formLogin = document.getElementById('loginForm');
            if(formLogin) formLogin.reset();
            
            showView('home'); 
        }
    });
}

// === Login Logic (Sistem Sambung Database Asli) ===
const loginFormElement = document.getElementById('loginForm');
if (loginFormElement) {
    loginFormElement.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const user = document.getElementById('username').value;
        const pass = document.getElementById('password').value;

        showLoading(true, "Mencocokkan data login...");

        const formData = new URLSearchParams();
        formData.append('action', 'login');
        formData.append('username', user); 
        formData.append('password', pass); 

        // Proses fetch ke Google Apps Script
        gasFetch( { method: 'POST', body: formData })
        .then(response => response.json())
        .then(res => {
            showLoading(false);
            if (res.status === 'success') {
                // 1. SIMPAN TOKEN RESMI KE MEMORI BROWSER
                sessionStorage.setItem('tokenMadasa', res.token);
                
                // 2. Update Nama dan Role di Header
                document.getElementById('userNameDisplay').innerText = res.name;
                document.getElementById('userRoleDisplay').innerText = res.role;

                // 3. Atur Elemen yang Boleh Dilihat Admin Saja
                const adminElements = document.querySelectorAll('.admin-only');
                if (res.role === 'Guru Kelas' || res.role === 'Wali Kelas') {
                    adminElements.forEach(el => el.style.display = 'none');
                } else {
                    adminElements.forEach(el => el.style.display = ''); 
                }

                // 4. Pindah layar ke Dashboard Utama
                document.getElementById('loginPage').classList.add('hidden');
                document.getElementById('dashboardPage').classList.remove('hidden');
                showView('home');
                
                Swal.fire({
                    icon: 'success',
                    title: 'Alhamdulillah',
                    text: `Selamat datang, ${res.name}!`,
                    timer: 1500,
                    showConfirmButton: false
                });

                // Muat ulang data otomatis
                if (typeof loadDataSantri === 'function') loadDataSantri();

            } else {
                Swal.fire('Gagal Masuk', res.message, 'error');
            }
        })
        .catch(err => {
            showLoading(false);
            Swal.fire('Error', 'Koneksi terputus ke server.', 'error');
        });
    });
}