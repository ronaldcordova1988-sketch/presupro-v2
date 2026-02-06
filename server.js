const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Servir archivos estáticos de forma prioritaria
// Esto asegura que manifest.json, sw.js y los iconos sean visibles
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// VARIABLES POR DEFECTO (Se usan si el usuario no configura nada en Ajustes)
const CONFIG_EMPRESA = {
    nombre: "MI EMPRESA DE CONSTRUCCIÓN",
    logoUrl: "https://via.placeholder.com/150x50?text=LOGO+AQUÍ" 
};

app.get('/', (req, res) => {
    const rootPath = path.join(__dirname, 'index.html');
    const publicPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(rootPath)) res.sendFile(rootPath);
    else if (fs.existsSync(publicPath)) res.sendFile(publicPath);
    else res.status(404).send("No se encontró el archivo index.html en la raíz ni en /public");
});

// Ruta explícita para el manifest (ayuda a algunos generadores de APK)
app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'manifest.json'));
});

// Ruta explícita para el Service Worker
app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'sw.js'));
});

function generarHTMLPresupuesto(datos) {
    const { cliente, materiales, manoObra, empresa } = datos;

    // --- LÓGICA DE SUMA DE MATERIALES ---
    let totalMateriales = 0;
    const filasMateriales = materiales.map(m => {
        const cant = Number(m.cantidad || 0);
        const precio = Number(m.precio || 0);
        const subtotal = cant * precio;
        totalMateriales += subtotal;
        
        return `
            <tr>
                <td style="text-transform: uppercase; font-size: 12px;"><strong>${m.nombre || 'Producto'}</strong></td>
                <td style="text-align: center;">${cant}</td>
                <td style="text-align: right;">$${precio.toFixed(2)}</td>
                <td style="text-align: right; font-weight: bold;">$${subtotal.toFixed(2)}</td>
            </tr>`;
    }).join('');

    // --- LÓGICA DE MANO DE OBRA ---
    const metros = Number(manoObra.metros || 0);
    const precioM2 = Number(manoObra.precioPorMetro || 0);
    const totalManoObra = metros * precioM2;

    // --- SUMA CRÍTICA DEFINITIVA ---
    const totalGeneral = totalMateriales + totalManoObra;

    // Personalización dinámica
    const nombreFinal = empresa.nombre || CONFIG_EMPRESA.nombre;
    const logoFinal = empresa.logo || CONFIG_EMPRESA.logoUrl;

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Presupuesto - ${cliente.nombre}</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; max-width: 850px; margin: auto; background-color: #f1f5f9; }
                .sheet { background: white; padding: 50px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
                .logo { max-width: 180px; max-height: 90px; object-fit: contain; }
                .empresa-info { text-align: right; }
                h1 { margin: 0; color: #1e40af; font-size: 24px; text-transform: uppercase; font-weight: 900; }
                .cliente-box { background: #f8fafc; padding: 20px; border-radius: 15px; margin-bottom: 30px; border: 1px solid #e2e8f0; display: grid; grid-template-columns: 1fr 1fr; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                th { background-color: #334155; color: white; padding: 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
                td { border-bottom: 1px solid #e2e8f0; padding: 12px; font-size: 13px; }
                .section-title { background: #2563eb; color: white; padding: 8px 15px; border-radius: 8px; font-size: 12px; font-weight: bold; display: inline-block; margin-top: 20px; text-transform: uppercase; }
                .total-section { margin-top: 40px; background: #1e293b; color: white; padding: 30px; border-radius: 20px; }
                .total-line { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px; opacity: 0.9; }
                .grand-total { font-size: 28px; font-weight: 900; color: #60a5fa; border-top: 1px solid #475569; padding-top: 15px; margin-top: 15px; }
                .no-print-area { text-align: center; margin-top: 40px; }
                .btn-imprimir { 
                    background-color: #2563eb; color: white; padding: 20px 40px; 
                    font-size: 16px; border: none; border-radius: 15px; cursor: pointer;
                    font-weight: bold; box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.4);
                }
                @media print {
                    body { background: white; padding: 0; }
                    .sheet { box-shadow: none; padding: 20px; }
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
                        <p style="margin: 5px 0 0 0; color: #64748b; font-weight: bold;">DOCUMENTO DE PRESUPUESTO</p>
                    </div>
                </div>

                <div class="cliente-box">
                    <div>
                        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">Cliente</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">${cliente.nombre || 'No especificado'}</p>
                    </div>
                    <div style="text-align: right;">
                        <p style="margin: 0; font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase;">ID / Cédula</p>
                        <p style="margin: 5px 0 0 0; font-weight: bold; font-size: 16px;">${cliente.id || 'N/A'}</p>
                    </div>
                </div>

                <div class="section-title">Detalle de Materiales</div>
                <table>
                    <thead>
                        <tr>
                            <th>Descripción del Producto</th>
                            <th style="text-align: center;">Cant.</th>
                            <th style="text-align: right;">P. Unit</th>
                            <th style="text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasMateriales || '<tr><td colspan="4" style="text-align:center;">No hay materiales cargados</td></tr>'}
                    </tbody>
                </table>

                <div class="section-title">Mano de Obra</div>
                <table>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th style="text-align: center;">Medición (m2)</th>
                            <th style="text-align: right;">Costo x m2</th>
                            <th style="text-align: right;">Total MO</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight: bold;">SERVICIOS PROFESIONALES DE CONSTRUCCIÓN</td>
                            <td style="text-align: center;">${metros}</td>
                            <td style="text-align: right;">$${precioM2.toFixed(2)}</td>
                            <td style="text-align: right; font-weight: bold;">$${totalManoObra.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="total-section">
                    <div class="total-line">
                        <span>Resumen Materiales</span>
                        <span>$${totalMateriales.toFixed(2)}</span>
                    </div>
                    <div class="total-line">
                        <span>Resumen Mano de Obra</span>
                        <span>$${totalManoObra.toFixed(2)}</span>
                    </div>
                    <div class="total-line grand-total">
                        <span>TOTAL A PAGAR</span>
                        <span>$${totalGeneral.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="no-print-area">
                <button class="btn-imprimir" onclick="window.print()">📥 DESCARGAR PRESUPUESTO (PDF)</button>
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
        console.error(e);
        res.status(500).send("Error interno al procesar los datos.");
    }
});

app.listen(port, () => {
    console.log(`Servidor activo en http://localhost:${port}`);
});