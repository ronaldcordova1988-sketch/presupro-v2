const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const app = express();
const port = process.env.PORT || 3000;

// --- MEJORA: CONFIGURACIÓN DE CORS ULTRA-COMPATIBLE ---
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// LÍMITE DE RECEPCIÓN AUMENTADO (Para que las imágenes de logo en Base64 no fallen)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// CABECERAS DE SEGURIDAD Y PERSISTENCIA
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ARCHIVOS ESTÁTICOS
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// VARIABLES POR DEFECTO Y PERSISTENCIA DE CONFIGURACIÓN
const CONFIG_EMPRESA = {
    nombre: "MI EMPRESA DE CONSTRUCCIÓN",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO+AQUÍ" 
};

// --- MEJORA: SISTEMA DE ALMACENAMIENTO (Simulado para Render si no usas DB) ---
let inventarioGlobal = [];
let historialFacturas = [];

// RUTA ANTI-SLEEP (Keep-alive)
app.get('/ping', (req, res) => {
    console.log("Sistema: Señal de vida recibida.");
    res.status(200).send("OK");
});

app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const publicPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else if (fs.existsSync(publicPath)) res.sendFile(publicPath);
    else res.status(404).send("Error: No se encontró la interfaz del sistema.");
});

// RUTAS PWA
app.get('/manifest.json', (req, res) => {
    res.header("Content-Type", "application/manifest+json");
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
    res.header("Content-Type", "application/javascript");
    res.header("Service-Worker-Allowed", "/"); 
    res.sendFile(path.join(__dirname, 'sw.js'));
});

// GENERACIÓN DE HTML PARA EL PRESUPUESTO (Optimizado para diseño y PDF)
function generarHTMLPresupuesto(datos) {
    const { cliente = {}, materiales = [], manoObra = {}, empresa = {}, tasa = 1 } = datos;

    let totalMateriales = 0;
    const filasMateriales = materiales.map(m => {
        const cant = Number(m.cantidad || 0);
        const precio = Number(m.precio || 0);
        const subtotal = cant * precio;
        totalMateriales += subtotal;
        
        return `
            <tr>
                <td style="text-transform: uppercase; font-size: 11px; word-wrap: break-word; max-width: 250px;"><strong>${m.nombre || 'Producto'}</strong></td>
                <td style="text-align: center;">${cant}</td>
                <td style="text-align: right;">$${precio.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="text-align: right; font-weight: bold;">$${subtotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>`;
    }).join('');

    const metros = Number(manoObra.metros || 0);
    const precioM2 = Number(manoObra.precioPorMetro || 0);
    const totalManoObra = metros * precioM2;

    const totalGeneralUSD = totalMateriales + totalManoObra;
    const tasaFinal = Number(tasa) > 0 ? Number(tasa) : 1;
    const totalGeneralBS = totalGeneralUSD * tasaFinal;

    const nombreFinal = empresa.nombre || CONFIG_EMPRESA.nombre;
    const logoFinal = empresa.logo || CONFIG_EMPRESA.logoUrl;
    const fechaActual = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>PresuPro - ${cliente.nombre || 'Presupuesto'}</title>
            <style>
                @page { size: A4; margin: 0; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #f1f5f9; margin: 0; }
                .sheet { background: white; padding: 40px; border-radius: 15px; max-width: 800px; margin: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); min-height: 297mm; display: flex; flex-direction: column; }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .logo { max-width: 180px; max-height: 90px; object-fit: contain; }
                .empresa-info { text-align: right; }
                h1 { margin: 0; color: #1e40af; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
                .cliente-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; table-layout: fixed; }
                th { background-color: #334155 !important; color: white !important; padding: 12px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
                td { border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 12px; }
                .section-title { background: #2563eb !important; color: white !important; padding: 6px 15px; border-radius: 5px; font-size: 12px; font-weight: bold; margin-bottom: 10px; display: inline-block; text-transform: uppercase; }
                .total-section { margin-top: auto; background: #1e293b !important; color: white !important; padding: 25px; border-radius: 12px; }
                .total-line { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; }
                .grand-total { font-size: 24px; font-weight: 900; color: #60a5fa !important; border-top: 1px solid #475569; padding-top: 12px; margin-top: 10px; }
                .total-bs { font-size: 16px; color: #cbd5e1; opacity: 0.9; }
                .no-print-area { text-align: center; margin-top: 30px; padding-bottom: 50px; }
                .btn-imprimir { background-color: #2563eb; color: white; padding: 18px 40px; border: none; border-radius: 12px; cursor: pointer; font-weight: bold; font-size: 18px; transition: transform 0.2s; box-shadow: 0 4px 14px rgba(37,99,235,0.4); }
                .btn-imprimir:active { transform: scale(0.95); }
                @media print {
                    body { background: white; padding: 0; }
                    .sheet { box-shadow: none; padding: 30px; border-radius: 0; width: 100%; max-width: 100%; }
                    .no-print-area { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="sheet">
                <div class="header">
                    <img src="${logoFinal}" alt="Logo" class="logo">
                    <div class="empresa-info">
                        <h1>${nombreFinal}</h1>
                        <p style="margin: 4px 0; font-size: 13px; color: #64748b; font-weight: 600;">Fecha: ${fechaActual}</p>
                    </div>
                </div>

                <div class="cliente-box">
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">CLIENTE</p>
                        <p style="margin: 4px 0; font-size: 15px; font-weight: bold; color: #0f172a;">${cliente.nombre || 'No especificado'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">CÉDULA / ID</p>
                        <p style="margin: 4px 0; font-size: 15px; font-weight: bold; color: #0f172a;">${cliente.id || 'N/A'}</p>
                    </div>
                </div>

                <div class="section-title">Materiales Requeridos</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50%;">Descripción</th>
                            <th style="text-align: center; width: 15%;">Cant.</th>
                            <th style="text-align: right; width: 15%;">Precio</th>
                            <th style="text-align: right; width: 20%;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasMateriales || '<tr><td colspan="4" style="text-align:center;">Sin materiales registrados</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Mano de Obra / Servicios</div>
                <table>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold; width: 50%;">SERVICIOS DE CONSTRUCCIÓN (${metros} m2)</td>
                            <td style="text-align: center; width: 15%; color: #64748b;">—</td>
                            <td style="text-align: right; width: 15%; font-weight: 500;">$${precioM2.toFixed(2)} / m2</td>
                            <td style="text-align: right; font-weight: bold; width: 20%;">$${totalManoObra.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-section">
                    <div class="total-line">
                        <span>Subtotal Materiales</span>
                        <span>$ ${totalMateriales.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="total-line">
                        <span>Subtotal Mano de Obra</span>
                        <span>$ ${totalManoObra.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="total-line grand-total">
                        <span>TOTAL PRESUPUESTO</span>
                        <span>$ ${totalGeneralUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="total-line total-bs">
                        <span>Equivalente en Bolívares (Tasa: ${tasaFinal})</span>
                        <span>Bs. ${totalGeneralBS.toLocaleString('es-VE', {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
                <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 30px; font-style: italic;">
                    Este presupuesto tiene una validez de 5 días hábiles a partir de la fecha de emisión.
                </p>
            </div>

            <div class="no-print-area">
                <button class="btn-imprimir" onclick="window.print()">📥 DESCARGAR PDF / IMPRIMIR</button>
            </div>
        </body>
        </html>
    `;
}

// --- MEJORA: RUTAS PARA HISTORIAL E INVENTARIO ---

// Obtener inventario
app.get('/api/inventario', (req, res) => {
    res.status(200).json(inventarioGlobal);
});

// Guardar/Actualizar inventario
app.post('/api/inventario', (req, res) => {
    inventarioGlobal = req.body;
    res.status(200).json({ message: "Inventario actualizado" });
});

// Obtener historial de facturas
app.get('/api/historial', (req, res) => {
    res.status(200).json(historialFacturas);
});

// Borrar factura del historial
app.delete('/api/historial/:id', (req, res) => {
    const { id } = req.params;
    historialFacturas = historialFacturas.filter(f => f.id !== id);
    res.status(200).json({ message: "Factura eliminada" });
});

// --- MEJORA: MANEJO DE POST ROBUSTO Y GUARDADO EN HISTORIAL ---
app.post('/generar-presupuesto', (req, res) => {
    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({ error: "Error: El servidor recibió una solicitud vacía." });
        }
        
        // Guardar en el historial automáticamente al generar
        const nuevaFactura = {
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            datos: req.body
        };
        historialFacturas.push(nuevaFactura);

        const html = generarHTMLPresupuesto(req.body);
        res.status(200).send(html);
    } catch (e) {
        console.error("Error crítico en generación:", e);
        res.status(500).json({ error: "Error interno del servidor al procesar datos." });
    }
});

// MANEJO DE ERRORES Y RUTAS NO ENCONTRADAS
app.use((err, req, res, next) => {
    console.error("Fallo general:", err.stack);
    res.status(500).json({ error: 'Fallo crítico en el motor de PresuPro.' });
});

process.on('SIGTERM', () => {
    console.info('SIGTERM signal received. Closing HTTP server.');
    server.close(() => {
        console.log('HTTP server closed.');
    });
});

const server = app.listen(port, () => {
    console.log(`Servidor PresuPro Activo en puerto ${port}`);
});