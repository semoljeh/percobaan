/**
 * FUNGSI UNTUK MENAMPILKAN TOMBOL WHATSAPP (Anti-Bug & Smooth Drag)
 * Tampilan murni icon tanpa teks dan tanpa efek pantulan cahaya
 */
function tampilkanWidgetWA() {
    // 1. Cek jika widget sudah ada agar tidak duplikat
    if (document.getElementById('wa-widget')) return;

    // 2. Buat elemen HTML (Hanya Icon WA murni)
const waHTML = `
    <div id="wa-widget" class="fixed bottom-6 right-6 z-[9999] flex flex-col items-center cursor-grab select-none" style="touch-action: none; position: fixed; transition: transform 0.3s;">
        <a id="wa-link" href="https://wa.me/6282333166659?text=Assalamu'alaikum%20Admin,%20afwan,%20saya%20membutuhkan%20bantuan%20terkait%20Sistem%20Madasa." target="_blank" class="relative flex items-center justify-center w-12 h-12 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-2xl transition-transform transform hover:scale-105 pointer-events-auto">
            <i class="fab fa-whatsapp text-2xl relative z-10"></i>
        </a>
    </div>
`;
    
    // Suntikkan ke body
    document.body.insertAdjacentHTML('beforeend', waHTML);

    // 3. Logika Efek Geser (Drag & Drop) - Disempurnakan
    const waWidget = document.getElementById('wa-widget');
    const waLink = document.getElementById('wa-link');

    let isDragging = false;
    let isMoved = false; 
    let startX, startY;
    let initialX, initialY; // Untuk menghitung toleransi gesekan (threshold)

    // --- MOUSE (Desktop) ---
    waWidget.addEventListener('mousedown', function(e) {
        isDragging = true; 
        isMoved = false;
        initialX = e.clientX;
        initialY = e.clientY;
        
        let rect = waWidget.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        waWidget.style.cursor = 'grabbing';
        waWidget.style.transition = 'none'; // Matikan transisi agar geseran tidak lag
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        // Toleransi gerak 5 piksel (mencegah klik tidak sengaja terbaca sebagai geser)
        if (Math.abs(e.clientX - initialX) > 5 || Math.abs(e.clientY - initialY) > 5) {
            isMoved = true;
        }

        if (isMoved) {
            e.preventDefault(); 
            let newX = e.clientX - startX;
            let newY = e.clientY - startY;
            
            // Batasan agar tidak keluar layar
            newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));
            
            waWidget.style.left = newX + 'px';
            waWidget.style.top = newY + 'px';
            waWidget.style.bottom = 'auto'; 
            waWidget.style.right = 'auto';  
        }
    });

    document.addEventListener('mouseup', function() { 
        isDragging = false; 
        waWidget.style.cursor = 'grab'; 
        waWidget.style.transition = 'transform 0.3s'; // Kembalikan efek hover
    });

    // --- TOUCH (Mobile/HP) ---
    waWidget.addEventListener('touchstart', function(e) {
        isDragging = true; 
        isMoved = false;
        let touch = e.touches[0];
        initialX = touch.clientX;
        initialY = touch.clientY;
        
        let rect = waWidget.getBoundingClientRect();
        startX = touch.clientX - rect.left;
        startY = touch.clientY - rect.top;
        
        waWidget.style.transition = 'none'; 
    }, {passive: false});

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        
        let touch = e.touches[0];
        // Toleransi gerak 5 piksel untuk layar sentuh
        if (Math.abs(touch.clientX - initialX) > 5 || Math.abs(touch.clientY - initialY) > 5) {
            isMoved = true;
        }

        if (isMoved) {
            e.preventDefault(); // Matikan scroll layar hanya jika benar-benar digeser
            let newX = touch.clientX - startX;
            let newY = touch.clientY - startY;
            
            newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
            newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));
            
            waWidget.style.left = newX + 'px';
            waWidget.style.top = newY + 'px';
            waWidget.style.bottom = 'auto'; 
            waWidget.style.right = 'auto';
        }
    }, {passive: false});

    document.addEventListener('touchend', function() { 
        isDragging = false; 
        waWidget.style.transition = 'transform 0.3s';
    });

    // --- PENCEGAH BUG KLIK ---
    waLink.addEventListener('click', function(e) { 
        if (isMoved) {
            e.preventDefault(); // Batalkan aksi klik jika elemen habis digeser
        }
    });
}