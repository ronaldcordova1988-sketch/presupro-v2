// --- CONFIGURACIÓN INICIAL ---
document.addEventListener('DOMContentLoaded', () => {
    // Quitar splash screen con transición suave
    setTimeout(() => {
        const splash = document.getElementById('splash');
        if (splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.remove(), 500);
        }
    }, 2000);
    
    // Poner fecha actual
    const opciones = { year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('display-date').innerText = new Date().toLocaleDateString('es-ES', opciones);

    // Cargar ajustes guardados localmente (Nombre de empresa y Logo)
    const savedCompName = localStorage.getItem('presupro_comp_name');
    const savedLogo = localStorage.getItem('presupro_comp_logo');
    
    if (savedCompName) {
        document.getElementById('display-company').innerText = savedCompName;
        document.getElementById('in-comp-name').value = savedCompName;
    }
    if (savedLogo) {
        const img = document.getElementById('logo-img');
        img.src = savedLogo;
        img.classList.remove('hidden');
        document.getElementById('logo-txt').classList.add('hidden');
    }
});

// --- SISTEMA DE AUTENTICACIÓN ---
async function handleLogin() {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const btn = document.getElementById('btn-login');

    if (!email || !pass) return alert("Completa todos los campos");

    btn.innerText = "VERIFICANDO...";
    btn.disabled = true;

    try {
        await window.signIn(window.auth, email, pass);
    } catch (error) {
        alert("Error de acceso: Credenciales incorrectas");
        btn.innerText = "Entrar al Sistema";
        btn.disabled = false;
    }
}

async function handleLogout() {
    if (confirm("¿Cerrar sesión?")) {
        await window.logout(window.auth);
        localStorage.clear(); // Limpia caché local al salir
        location.reload();
    }
}

// --- FUNCIONES DE NAVEGACIÓN Y MODALES ---
function openModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if(id === 'modalInventory') renderInventory();
    if(id === 'modalHistory') renderHistory();
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// --- GESTIÓN DE INVENTARIO FIREBASE (MULTIUSUARIO) ---
async function addToInventory() {
    if (!window.currentUser) return;
    
    const name = document.getElementById('inv-name').value.toUpperCase().trim();
    const qty = parseFloat(document.getElementById('inv-qty').value) || 0;
    const price = parseFloat(document.getElementById('inv-price').value) || 0;

    if (!name) return alert("Escribe el nombre del producto");

    try {
        const { doc, setDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const docRef = doc(window.db, "usuarios", window.currentUser, "inventario", name);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const currentData = docSnap.data();
            await setDoc(docRef, {
                nombre: name,
                cantidad: currentData.cantidad + qty,
                precio: price > 0 ? price : currentData.precio
            });
        } else {
            await setDoc(docRef, { nombre: name, cantidad: qty, precio: price });
        }

        renderInventory();
        document.getElementById('inv-name').value = "";
        document.getElementById('inv-qty').value = "";
        document.getElementById('inv-price').value = "";
    } catch (e) {
        console.error("Error al guardar en Firebase:", e);
    }
}

async function renderInventory() {
    if (!window.currentUser) return;
    const list = document.getElementById('inventory-list');
    if (!list) return;
    
    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(window.db, "usuarios", window.currentUser, "inventario"));
        
        list.innerHTML = "";
        querySnapshot.forEach((doc) => {
            const item = doc.data();
            list.innerHTML += `
                <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100 mb-2">
                    <div>
                        <p class="font-black text-xs uppercase">${item.nombre}</p>
                        <p class="text-[10px] text-slate-500">STOCK: ${item.cantidad} | $${item.precio}</p>
                    </div>
                    <button onclick="selectFromInventory('${item.nombre}')" class="bg-blue-600 text-white text-[10px] px-3 py-1 rounded-lg font-bold uppercase">Seleccionar</button>
                </div>
            `;
        });
    } catch (e) {
        console.error("Error al leer inventario:", e);
    }
}

async function selectFromInventory(nombre) {
    if (!window.currentUser) return;
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const docRef = doc(window.db, "usuarios", window.currentUser, "inventario", nombre);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const item = docSnap.data();
        addItemRow('stock', { nombre: item.nombre, precio: item.precio });
        closeModal('modalInventory');
    }
}

// --- DESCUENTO DE STOCK AUTOMÁTICO ---
async function descontarInventario() {
    if (!window.currentUser) return;
    const { doc, updateDoc, increment } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const filas = document.querySelectorAll('.material-row');
    
    for (let fila of filas) {
        if (fila.dataset.tipo === 'stock') {
            const nombre = fila.querySelector('.nombre-material').value;
            const cant = parseFloat(fila.querySelector('.cantidad-material').value) || 0;
            if (cant > 0) {
                const docRef = doc(window.db, "usuarios", window.currentUser, "inventario", nombre);
                try {
                    await updateDoc(docRef, {
                        cantidad: increment(-cant)
                    });
                } catch (e) {
                    console.error("No se pudo descontar stock de:", nombre);
                }
            }
        }
    }
}

// --- GESTIÓN DE MATERIALES ---
function addItemRow(tipo = 'externo', data = null) {
    const container = document.getElementById('items-container');
    const div = document.createElement('div');
    
    const isStock = (tipo === 'stock');
    const borderColor = isStock ? "border-blue-200 bg-blue-50/20" : "border-slate-100 bg-white";
    const badge = isStock ? "📦 MI TIENDA" : "🛒 COMPRA FUERA";

    div.className = `material-row ${borderColor} p-4 rounded-2xl shadow-sm border flex gap-3 items-center animate-slide-up`;
    div.dataset.tipo = tipo; 
    
    div.innerHTML = `
        <div class="flex-1">
            <div class="mb-1">
                <span class="text-[7px] font-black px-2 py-0.5 rounded-full ${isStock ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'} uppercase">${badge}</span>
            </div>
            <input type="text" placeholder="Producto" 
                   value="${data ? data.nombre : ''}" 
                   ${isStock ? 'readonly' : ''} 
                   class="nombre-material font-bold text-sm uppercase w-full bg-transparent outline-none">
            <div class="flex gap-4 mt-1">
                <input type="number" placeholder="Cant" oninput="calcTotal()" 
                       class="cantidad-material text-xs text-slate-500 w-16 bg-slate-50 rounded px-1 outline-none">
                <input type="number" placeholder="Precio $" oninput="calcTotal()" 
                       value="${data ? data.precio : ''}"
                       class="precio-material text-xs text-slate-500 w-20 bg-slate-50 rounded px-1 outline-none">
            </div>
        </div>
        <button onclick="this.parentElement.remove(); calcTotal();" class="text-red-400 p-2 text-xl">×</button>
    `;
    
    container.appendChild(div);
    calcTotal();
}

// --- LÓGICA DE CÁLCULO ---
function calcTotal() {
    let totalMateriales = 0;
    const filas = document.querySelectorAll('.material-row');
    filas.forEach(fila => {
        const cant = parseFloat(fila.querySelector('.cantidad-material').value) || 0;
        const precio = parseFloat(fila.querySelector('.precio-material').value) || 0;
        totalMateriales += (cant * precio);
    });

    const m2 = parseFloat(document.getElementById('mo-m2').value) || 0;
    const precioMO = parseFloat(document.getElementById('mo-price').value) || 0;
    const totalMO = m2 * precioMO;

    const totalGeneral = totalMateriales + totalMO;
    const tasa = parseFloat(document.getElementById('tasa-cambio').value) || 1;

    document.getElementById('total-amount').innerText = `$ ${totalGeneral.toFixed(2)}`;
    document.getElementById('total-converted').innerText = `BS ${(totalGeneral * tasa).toFixed(2)}`;
    return { totalGeneral, totalMO, totalMateriales };
}

// --- GUARDAR Y EDITAR FACTURAS (MULTIUSUARIO) ---
async function guardarFacturaFirebase() {
    if (!window.currentUser) return;
    
    const btn = document.querySelector('button[onclick="guardarFacturaFirebase()"]');
    btn.disabled = true;
    btn.innerText = "GUARDANDO...";

    const listaMateriales = [];
    document.querySelectorAll('.material-row').forEach(fila => {
        listaMateriales.push({
            nombre: fila.querySelector('.nombre-material').value,
            cantidad: fila.querySelector('.cantidad-material').value,
            precio: fila.querySelector('.precio-material').value,
            tipo: fila.dataset.tipo
        });
    });

    const factura = {
        fecha: new Date().getTime(),
        cliente: document.getElementById('display-client-name').innerText,
        clienteId: document.getElementById('in-client-id').value,
        materiales: listaMateriales,
        m2: document.getElementById('mo-m2').value,
        precioMO: document.getElementById('mo-price').value,
        total: document.getElementById('total-amount').innerText
    };

    try {
        const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        await addDoc(collection(window.db, "usuarios", window.currentUser, "facturas"), factura);
        alert("Factura guardada en tu historial");
    } catch (e) {
        alert("Error al guardar factura");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<span>💾</span> GUARDAR";
    }
}

async function renderHistory() {
    if (!window.currentUser) return;
    const list = document.getElementById('history-list');
    try {
        const { collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const q = query(collection(window.db, "usuarios", window.currentUser, "facturas"), orderBy("fecha", "desc"));
        const snap = await getDocs(q);
        
        list.innerHTML = "";
        snap.forEach(docSnap => {
            const f = docSnap.data();
            const d = new Date(f.fecha).toLocaleDateString();
            list.innerHTML += `
                <div class="bg-slate-50 p-4 rounded-2xl border mb-2">
                    <p class="text-[10px] font-bold text-blue-600">${d}</p>
                    <p class="font-black text-xs uppercase">${f.cliente}</p>
                    <p class="text-xs text-slate-500">${f.total}</p>
                    <button onclick="cargarFactura('${docSnap.id}')" class="mt-2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded">EDITAR / CARGAR</button>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

async function cargarFactura(id) {
    if (!window.currentUser) return;
    const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snap = await getDoc(doc(window.db, "usuarios", window.currentUser, "facturas", id));
    if (snap.exists()) {
        const f = snap.data();
        nuevaFactura(false); 
        document.getElementById('display-client-name').innerText = f.cliente;
        document.getElementById('in-client-id').value = f.clienteId;
        document.getElementById('mo-m2').value = f.m2;
        document.getElementById('mo-price').value = f.precioMO;
        f.materiales.forEach(m => {
            addItemRow(m.tipo, { nombre: m.nombre, precio: m.precio });
            const filas = document.querySelectorAll('#items-container .material-row');
            const ultimaFila = filas[filas.length - 1];
            ultimaFila.querySelector('.cantidad-material').value = m.cantidad;
        });
        calcTotal();
        closeModal('modalHistory');
    }
}

function nuevaFactura(preguntar = true) {
    if (preguntar && !confirm("¿Limpiar todo para una nueva factura?")) return;
    document.getElementById('items-container').innerHTML = "";
    document.getElementById('mo-m2').value = "";
    document.getElementById('mo-price').value = "";
    document.getElementById('in-client-name').value = "";
    document.getElementById('in-client-id').value = "";
    document.getElementById('display-client-name').innerText = "Tocar para añadir datos";
    calcTotal();
}

// --- ENVÍO AL SERVIDOR ---
async function enviarAlServidor() {
    const btn = document.querySelector('button[onclick="enviarAlServidor()"]');
    btn.disabled = true;
    btn.innerText = "GENERANDO...";

    // Descontar inventario antes de generar PDF
    await descontarInventario();

    const listaMateriales = [];
    document.querySelectorAll('.material-row').forEach(fila => {
        listaMateriales.push({
            nombre: fila.querySelector('.nombre-material').value || "Producto",
            cantidad: fila.querySelector('.cantidad-material').value || 0,
            precio: fila.querySelector('.precio-material').value || 0,
            subtotal: (parseFloat(fila.querySelector('.cantidad-material').value) || 0) * (parseFloat(fila.querySelector('.precio-material').value) || 0)
        });
    });

    const totales = calcTotal();

    const datos = {
        cliente: {
            nombre: document.getElementById('display-client-name').innerText,
            id: document.getElementById('in-client-id').value || "N/A"
        },
        empresa: {
            nombre: document.getElementById('display-company').innerText,
            logo: document.getElementById('logo-img').src 
        },
        materiales: listaMateriales,
        manoObra: {
            metros: document.getElementById('mo-m2').value || 0,
            precioPorMetro: document.getElementById('mo-price').value || 0,
            totalMO: totales.totalMO
        },
        totalGeneral: totales.totalGeneral,
        tasa: document.getElementById('tasa-cambio').value
    };

    try {
        const response = await fetch('/generar-presupuesto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });

        if (response.ok) {
            const html = await response.text();
            const win = window.open('', '_blank');
            win.document.write(html);
            win.document.close();
        } else {
            alert("Error al conectar con el servidor.");
        }
    } catch (error) {
        alert("Error de conexión. Verifica que el servidor esté activo.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = "<span>📥</span> PDF";
    }
}

// --- PERSONALIZACIÓN ---
function saveClientData() {
    const nombre = document.getElementById('in-client-name').value;
    if(nombre) {
        document.getElementById('display-client-name').innerText = nombre.toUpperCase();
        closeModal('modalClient');
    }
}

function saveSettings() {
    const name = document.getElementById('in-comp-name').value;
    if(name) {
        const upperName = name.toUpperCase();
        document.getElementById('display-company').innerText = upperName;
        localStorage.setItem('presupro_comp_name', upperName);
    }
    closeModal('modalSettings');
}

function previewLogo(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('logo-img');
            const base64Logo = e.target.result;
            img.src = base64Logo;
            img.classList.remove('hidden');
            document.getElementById('logo-txt').classList.add('hidden');
            // Guardar logo en persistencia local
            localStorage.setItem('presupro_comp_logo', base64Logo);
        }
        reader.readAsDataURL(input.files[0]);
    }
}