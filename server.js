const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const puppeteer = require('puppeteer'); // Asegúrate de tener puppeteer instalado
const app = express();
const port = process.env.PORT || 3000;

// --- MEJORA: CONFIGURACIÓN DE CORS ULTRA-COMPATIBLE ---
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// LÍMITE DE RECEPCIÓN AUMENTADO (Para que las imágenes de logo en Base64 no fallen)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// CABECERAS DE SEGURIDAD Y PERSISTENCIA
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ARCHIVOS ESTÁTICOS
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// VARIABLES POR DEFECTO Y PERSISTENCIA DE CONFIGURACIÓN
const CONFIG_EMPRESA = {
    nombre: "MI EMPRESA DE CONSTRUCCIÓN",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO+AQUÍ" 
};

// --- MEJORA: SISTEMA DE ALMACENAMIENTO (Simulado para Render si no usas DB) ---
let inventarioGlobal = [];
let historialFacturas = [];

const INVENTARIO_FILE = path.join(__dirname, 'inventario.json');
const HISTORIAL_FILE = path.join(__dirname, 'historial.json');

try {
    if (fs.existsSync(INVENTARIO_FILE)) {
        const dataInv = fs.readFileSync(INVENTARIO_FILE, 'utf8');
        if (dataInv) inventarioGlobal = JSON.parse(dataInv);
    }
    if (fs.existsSync(HISTORIAL_FILE)) {
        const dataHis = fs.readFileSync(HISTORIAL_FILE, 'utf8');
        if (dataHis) historialFacturas = JSON.parse(dataHis);
    }
} catch (err) {
    console.log("Error al cargar archivos de persistencia, iniciando vacíos.");
}

const guardarDatosLocales = () => {
    try {
        fs.writeFileSync(INVENTARIO_FILE, JSON.stringify(inventarioGlobal, null, 2));
        fs.writeFileSync(HISTORIAL_FILE, JSON.stringify(historialFacturas, null, 2));
    } catch (err) {
        console.error("Error al persistir datos:", err);
    }
};

// RUTA ANTI-SLEEP (Keep-alive)
app.get('/ping', (req, res) => {
    console.log("Sistema: Señal de vida recibida.");
    res.status(200).send("OK");
});

// --- MEJORA: BOT ANTI-SUSPENSIÓN (AUTO-PING) ---
const axios = require('axios'); 
setInterval(() => {
    const url = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost:' + port}/ping`;
    console.log(`Bot: Manteniendo despierto el servidor en ${url}`);
    
    fetch(url).catch(err => console.log("Bot: El servidor está despertando..."));
}, 600000); // 10 minutos

app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const publicPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else if (fs.existsSync(publicPath)) res.sendFile(publicPath);
    else res.status(404).send("Error: No se encontró la interfaz del sistema.");
});

// RUTAS PWA
app.get('/manifest.json', (req, res) => {
    res.header("Content-Type", "application/manifest+json");
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.header("Content-Type", "application/javascript");
    res.header("Service-Worker-Allowed", "/"); 
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// --- MEJORA: FUNCIÓN FORMATEO DE MONEDA ROBUSTO ---
const formatearMoneda = (valor, moneda = 'USD') => {
    const opciones = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    };
    if (moneda === 'USD') {
        return '$ ' + Number(valor).toLocaleString('en-US', opciones);
    } else {
        return 'Bs. ' + Number(valor).toLocaleString('es-VE', opciones);
    }
};

// GENERACIÓN DE HTML PARA EL PRESUPUESTO (Optimizado para diseño y PDF)
function generarHTMLPresupuesto(datos) {
    const { cliente = {}, materiales = [], manoObra = {}, empresa = {}, tasa = 1 } = datos;

    let totalMateriales = 0;
    const filasMateriales = materiales.map(m => {
        const cant = Number(m.cantidad || 0);
        const precio = Number(m.precio || 0);
        const subtotal = cant * precio;
        totalMateriales += subtotal;
        
        return `
            <tr>
                <td style="text-transform: uppercase; font-size: 11px; word-wrap: break-word; max-width: 250px;"><strong>${m.nombre || 'Producto'}</strong></td>
                <td style="text-align: center;">${cant}</td>
                <td style="text-align: right;">${formatearMoneda(precio)}</td>
                <td style="text-align: right; font-weight: bold;">${formatearMoneda(subtotal)}</td>
            </tr>`;
    }).join('');

    const metros = Number(manoObra.metros || 0);
    const precioM2 = Number(manoObra.precioPorMetro || 0);
    const totalManoObra = metros * precioM2;

    const totalGeneralUSD = totalMateriales + totalManoObra;
    const tasaFinal = Number(tasa) > 0 ? Number(tasa) : 1;
    const totalGeneralBS = totalGeneralUSD * tasaFinal;

    const nombreFinal = empresa.nombre || CONFIG_EMPRESA.nombre;
    const logoFinal = empresa.logo || CONFIG_EMPRESA.logoUrl;
    const fechaActual = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <style>
                @page { size: A4; margin: 10mm; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; padding: 0; color: #1e293b; background-color: #ffffff; margin: 0; }
                .sheet { background: white; padding: 30px; max-width: 100%; margin: auto; min-height: 297mm; display: flex; flex-direction: column; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .logo { max-width: 180px; max-height: 90px; object-fit: contain; }
                .empresa-info { text-align: right; }
                h1 { margin: 0; color: #1e40af; font-size: 22px; text-transform: uppercase; }
                .cliente-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                th { background-color: #334155 !important; color: white !important; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
                td { border-bottom: 1px solid #e2e8f0; padding: 8px 10px; font-size: 12px; }
                .section-title { background: #2563eb !important; color: white !important; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 8px; display: inline-block; text-transform: uppercase; }
                .total-section { margin-top: auto; background: #1e293b !important; color: white !important; padding: 20px; border-radius: 10px; }
                .total-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
                .grand-total { font-size: 20px; font-weight: 900; color: #60a5fa !important; border-top: 1px solid #475569; padding-top: 10px; margin-top: 10px; }
                
                @media print {
                    .no-print-area { display: none !important; }
                    body { background: white; }
                    .sheet { padding: 0; box-shadow: none; }
                    tr { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <img src="${logoFinal}" alt="Logo" class="logo">
                    <div class="empresa-info">
                        <h1>${nombreFinal}</h1>
                        <p style="margin: 4px 0; font-size: 12px; color: #64748b; font-weight: 600;">Fecha: ${fechaActual}</p>
                    </div>
                </div>

                <div class="cliente-box">
                    <div>
                        <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase;">CLIENTE</p>
                        <p style="margin: 4px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${cliente.nombre || 'No especificado'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase;">CÉDULA / ID</p>
                        <p style="margin: 4px 0; font-size: 14px; font-weight: bold; color: #0f172a;">${cliente.id || 'N/A'}</p>
                    </div>
                </div>

                <div class="section-title">Materiales Requeridos</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Descripción</th>
                            <th style="text-align: center; width: 15%;">Cant.</th>
                            <th style="text-align: right; width: 15%;">Precio</th>
                            <th style="text-align: right; width: 20%;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasMateriales || '<tr><td colspan="4" style="text-align:center;">Sin materiales registrados</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Mano de Obra / Servicios</div>
                <table>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold; width: 50%;">SERVICIOS DE CONSTRUCCIÓN (${metros} m2)</td>
                            <td style="text-align: center; width: 15%; color: #64748b;">—</td>
                            <td style="text-align: right; width: 15%; font-weight: 500;">${formatearMoneda(precioM2)} / m2</td>
                            <td style="text-align: right; font-weight: bold; width: 20%;">${formatearMoneda(totalManoObra)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-section">
                    <div class="total-line">
                        <span>Subtotal Materiales</span>
                        <span>${formatearMoneda(totalMateriales)}</span>
                    </div>
                    <div class="total-line">
                        <span>Subtotal Mano de Obra</span>
                        <span>${formatearMoneda(totalManoObra)}</span>
                    </div>
                    <div class="total-line grand-total">
                        <span>TOTAL PRESUPUESTO</span>
                        <span>${formatearMoneda(totalGeneralUSD)}</span>
                    </div>
                    <div class="total-line" style="color: #cbd5e1; font-size: 14px;">
                        <span>Equivalente Tasa: ${tasaFinal}</span>
                        <span>${formatearMoneda(totalGeneralBS, 'BS')}</span>
                    </div>
                </div>
                <p style="font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; font-style: italic;">
                    Este presupuesto tiene una validez de 5 días hábiles.
                </p>
            </div>
            <div class="no-print-area" style="text-align:center; padding: 20px;">
                <button onclick="window.print()" style="padding: 15px 30px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">📥 DESCARGAR / IMPRIMIR</button>
            </div>
        </body>
        </html>
    `;
}

// --- MEJORA: RUTAS PARA HISTORIAL E INVENTARIO ---

app.get('/api/inventario', (req, res) => {
    res.status(200).json(inventarioGlobal);
});

app.post('/api/inventario', (req, res) => {
    inventarioGlobal = req.body;
    guardarDatosLocales();
    res.status(200).json({ message: "Inventario actualizado" });
});

app.delete('/api/inventario/:nombre', (req, res) => {
    const { nombre } = req.params;
    inventarioGlobal = inventarioGlobal.filter(item => item.nombre !== nombre);
    guardarDatosLocales();
    res.status(200).json({ message: "Producto eliminado del inventario" });
});

app.put('/api/inventario/:nombre', (req, res) => {
    const { nombre } = req.params;
    const datosActualizados = req.body;
    const index = inventarioGlobal.findIndex(item => item.nombre === nombre);
    if (index !== -1) {
        inventarioGlobal[index] = { ...inventarioGlobal[index], ...datosActualizados };
        guardarDatosLocales();
        res.status(200).json({ message: "Producto actualizado" });
    } else {
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

app.post('/api/inventario/reponer', (req, res) => {
    const { nombre, cantidad } = req.body;
    const index = inventarioGlobal.findIndex(item => item.nombre === nombre);
    if (index !== -1) {
        const nuevaCantidad = Number(inventarioGlobal[index].cantidad || 0) + Number(cantidad);
        inventarioGlobal[index].cantidad = nuevaCantidad;
        guardarDatosLocales();
        res.status(200).json({ message: "Stock repuesto", nuevoStock: nuevaCantidad });
    } else {
        res.status(404).json({ error: "Producto no encontrado" });
    }
});

app.get('/api/historial', (req, res) => {
    res.status(200).json(historialFacturas);
});

app.put('/api/historial/:id', (req, res) => {
    const { id } = req.params;
    const datosActualizados = req.body;
    const index = historialFacturas.findIndex(f => f.id === id);
    if (index !== -1) {
        historialFacturas[index].datos = datosActualizados;
        historialFacturas[index].ultimaEdicion = new Date().toISOString();
        guardarDatosLocales();
        res.status(200).json({ message: "Factura actualizada con éxito" });
    } else {
        res.status(404).json({ error: "No se encontró la factura para editar" });
    }
});

app.delete('/api/historial/:id', (req, res) => {
    const { id } = req.params;
    historialFacturas = historialFacturas.filter(f => f.id !== id);
    guardarDatosLocales();
    res.status(200).json({ message: "Factura eliminada" });
});

// --- MEJORA: GENERACIÓN DE PDF PROFESIONAL CON PUPPETEER ---
app.post('/generar-presupuesto', async (req, res) => {
    let browser;
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Error: Datos vacíos." });
        }

        // Persistencia en historial
        const nuevaFactura = {
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            datos: req.body
        };
        historialFacturas.push(nuevaFactura);
        guardarDatosLocales();

        const htmlContenido = generarHTMLPresupuesto(req.body);

        // CONFIGURACIÓN ROBUSTA PARA RENDER
        browser = await puppeteer.launch({
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--single-process'
            ],
            headless: 'new'
        });

        const page = await browser.newPage();
        
        // Esperar a que el contenido cargue para que el logo no salga roto
        await page.setContent(htmlContenido, { waitUntil: 'networkidle0' });
        
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        });

        await browser.close();

        const nombreArchivo = `Presupuesto_${req.body.cliente?.nombre || 'SinNombre'}.pdf`.replace(/\s+/g, '_');
        res.contentType("application/pdf");
        res.setHeader('Content-Disposition', `attachment; filename=${nombreArchivo}`);
        res.send(pdfBuffer);

    } catch (e) {
        if (browser) await browser.close();
        console.error("Error crítico en generación PDF:", e);
        // Si falla el PDF, enviamos el HTML como fallback para que el usuario pueda imprimir desde el navegador
        const fallbackHtml = generarHTMLPresupuesto(req.body);
        res.status(200).send(fallbackHtml);
    }
});

// MANEJO DE ERRORES Y RUTAS NO ENCONTRADAS
app.use((err, req, res, next) => {
    console.error("Fallo general:", err.stack);
    res.status(500).json({ error: 'Fallo crítico en el motor de PresuPro.' });
});

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received. Closing HTTP server.');
    server.close(() => {
        console.log('HTTP server closed.');
    });
});

const server = app.listen(port, () => {
    console.log(`
    ---------------------------------------------------
    🚀 SERVIDOR PRESUPRO V3 - ESTABLE Y OPTIMIZADO
    📍 Puerto: ${port}
    📦 Puppeteer: Configurado para Render
    💰 Moneda: Formateo USD/BS Activo
    ---------------------------------------------------
    `);
});