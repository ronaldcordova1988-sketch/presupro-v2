const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors'); 
const app = express();
const port = process.env.PORT || 3000;

// CONFIGURACIÓN DE CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// LÍMITE DE RECEPCIÓN (Para logos en Base64)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CABECERAS DE SEGURIDAD Y PWA
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// ARCHIVOS ESTÁTICOS
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// VARIABLES POR DEFECTO
const CONFIG_EMPRESA = {
    nombre: "MI EMPRESA DE CONSTRUCCIÓN",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO+AQUÍ" 
};

// RUTA ANTI-SLEEP
app.get('/ping', (req, res) => {
    res.sendStatus(200);
});

app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const publicPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else if (fs.existsSync(publicPath)) res.sendFile(publicPath);
    else res.status(404).send("No se encontró el archivo index.html");
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

// GENERACIÓN DE HTML PARA EL PRESUPUESTO
function generarHTMLPresupuesto(datos) {
    const { cliente = {}, materiales = [], manoObra = {}, empresa = {}, tasa = 1 } = datos;

    // Lógica de Materiales
    let totalMateriales = 0;
    const filasMateriales = materiales.map(m => {
        const cant = Number(m.cantidad || 0);
        const precio = Number(m.precio || 0);
        const subtotal = cant * precio;
        totalMateriales += subtotal;
        
        return `
            <tr>
                <td style="text-transform: uppercase; font-size: 11px;"><strong>${m.nombre || 'Producto'}</strong></td>
                <td style="text-align: center;">${cant}</td>
                <td style="text-align: right;">$${precio.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">$${subtotal.toFixed(2)}</td>
            </tr>`;
    }).join('');

    // Lógica de Mano de Obra
    const metros = Number(manoObra.metros || 0);
    const precioM2 = Number(manoObra.precioPorMetro || 0);
    const totalManoObra = metros * precioM2;

    // Totales finales
    const totalGeneralUSD = totalMateriales + totalManoObra;
    const totalGeneralBS = totalGeneralUSD * Number(tasa);

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
                body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; background-color: #f1f5f9; }
                .sheet { background: white; padding: 40px; border-radius: 15px; max-width: 800px; margin: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; }
                .logo { max-width: 150px; max-height: 70px; object-fit: contain; }
                .empresa-info { text-align: right; }
                h1 { margin: 0; color: #1e40af; font-size: 20px; text-transform: uppercase; }
                .cliente-box { background: #f8fafc; padding: 15px; border-radius: 10px; margin-bottom: 20px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                th { background-color: #334155; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
                td { border-bottom: 1px solid #e2e8f0; padding: 10px; font-size: 12px; }
                .section-title { background: #2563eb; color: white; padding: 5px 12px; border-radius: 5px; font-size: 11px; font-weight: bold; margin-bottom: 10px; display: inline-block; }
                .total-section { margin-top: 20px; background: #1e293b; color: white; padding: 20px; border-radius: 12px; }
                .total-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
                .grand-total { font-size: 22px; font-weight: 900; color: #60a5fa; border-top: 1px solid #475569; padding-top: 10px; margin-top: 10px; }
                .total-bs { font-size: 16px; color: #94a3b8; font-weight: bold; }
                .no-print-area { text-align: center; margin-top: 30px; }
                .btn-imprimir { background-color: #2563eb; color: white; padding: 15px 30px; border: none; border-radius: 10px; cursor: pointer; font-weight: bold; }
                @media print {
                    body { background: white; padding: 0; }
                    .sheet { box-shadow: none; padding: 10px; }
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
                        <p style="margin: 2px 0; font-size: 12px; color: #64748b;">Fecha: ${fechaActual}</p>
                    </div>
                </div>

                <div class="cliente-box">
                    <div>
                        <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: bold;">CLIENTE</p>
                        <p style="margin: 2px 0; font-weight: bold;">${cliente.nombre || 'No especificado'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 9px; color: #64748b; font-weight: bold;">CÉDULA / ID</p>
                        <p style="margin: 2px 0; font-weight: bold;">${cliente.id || 'N/A'}</p>
                    </div>
                </div>

                <div class="section-title">Materiales Requeridos</div>
                <table>
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">Precio</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasMateriales || '<tr><td colspan="4" style="text-align:center;">Sin materiales</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Mano de Obra</div>
                <table>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold;">SERVICIOS DE CONSTRUCCIÓN (${metros} m2)</td>
                            <td style="text-align: right;">$${precioM2.toFixed(2)} / m2</td>
                            <td style="text-align: right; font-weight: bold; width: 100px;">$${totalManoObra.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-section">
                    <div class="total-line">
                        <span>Subtotal Materiales</span>
                        <span>$ ${totalMateriales.toFixed(2)}</span>
                    </div>
                    <div class="total-line">
                        <span>Subtotal Mano de Obra</span>
                        <span>$ ${totalManoObra.toFixed(2)}</span>
                    </div>
                    <div class="total-line grand-total">
                        <span>TOTAL PRESUPUESTO</span>
                        <span>$ ${totalGeneralUSD.toFixed(2)}</span>
                    </div>
                    <div class="total-line total-bs">
                        <span>Equivalente en Bolívares (Tasa: ${tasa})</span>
                        <span>Bs. ${totalGeneralBS.toFixed(2)}</span>
                    </div>
                </div>
                <p style="font-size: 9px; color: #64748b; text-align: center; margin-top: 20px;">Este presupuesto tiene una validez de 5 días hábiles.</p>
            </div>

            <div class="no-print-area">
                <button class="btn-imprimir" onclick="window.print()">📥 DESCARGAR PDF / IMPRIMIR</button>
            </div>
        </body>
        </html>
    `;
}

app.post('/generar-presupuesto', (req, res) => {
    try {
        const html = generarHTMLPresupuesto(req.body);
        res.send(html);
    } catch (e) {
        console.error("Error en /generar-presupuesto:", e);
        res.status(500).send("Error al procesar el presupuesto.");
    }
});

// MANEJO DE ERRORES
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Error en el servidor.');
});

app.listen(port, () => {
    console.log(`Servidor PresuPro activo en puerto ${port}`);
});