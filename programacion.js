const canvas = document.getElementById("robotCanvas");
const ctx = canvas.getContext("2d");

const l1 = 12;  // cm
const l2 = 12;  // cm
const herramienta = 2; // cm
const escala = 10; // píxeles por cm

// ORIGEN CENTRADO EN EL CANVAS
const origen = { x: canvas.width / 2, y: canvas.height / 2 };

let tiempo = 0;
let historial = {
    q1: [], 
    q2: [], 
    tiempo: [],
    trayectorias: []  // NUEVO: Array de trayectorias (cada movimiento es una trayectoria)
};

// Variables para la animación
let animacionActiva = false;
let brazoObjetivo = { 
    xd: 0.14, yd: 0.14, 
    q1: 0, q2: 0
};

let brazoActual = { 
    xd: 0.14, yd: 0.14, 
    q1: 0, q2: 0,
    colorEslabon1: "blue",
    colorEslabon2: "red",
    nombre: "Brazo Robot"
};

// Inicializar la gráfica
const grafica = new Chart(document.getElementById("grafica1"), {
    type: 'line',
    data: { 
        labels: [], 
        datasets: [
            { 
                label: 'q₁(t) [°]', 
                data: [], 
                borderColor: 'blue', 
                backgroundColor: 'rgba(0, 0, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false 
            },
            { 
                label: 'q₂(t) [°]', 
                data: [], 
                borderColor: 'red', 
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false 
            }
        ]
    },
    options: { 
        responsive: false, 
        animation: false,
        scales: { 
            x: { 
                title: { display: true, text: 'Tiempo (s)' },
                grid: { color: 'rgba(0,0,0,0.1)' }
            }, 
            y: { 
                title: { display: true, text: 'Ángulo (°)' },
                grid: { color: 'rgba(0,0,0,0.1)' }
            } 
        },
        plugins: {
            legend: { display: true },
            tooltip: { mode: 'index', intersect: false }
        }
    }
});

function cinematicaInversa(xd, yd) {
    const r = Math.sqrt(xd ** 2 + yd ** 2);
    const alcanceMax = l1 + l2;
    const alcanceMin = Math.abs(l1 - l2);
    
    // Verificar espacio de trabajo
    if (r > alcanceMax || r < alcanceMin) {
        throw new Error(`Punto (${xd.toFixed(2)}, ${yd.toFixed(2)}) fuera del espacio de trabajo. Alcance: [${alcanceMin.toFixed(2)}, ${alcanceMax.toFixed(2)}] cm`);
    }
    
    const c2 = (xd**2 + yd**2 - l1**2 - l2**2) / (2 * l1 * l2);
    
    // Verificar singularidades
    if (Math.abs(c2) > 1) {
        throw new Error(`Singularidad: no se puede alcanzar el punto (${xd}, ${yd})`);
    }
    
    const q2 = Math.acos(c2);
    const q1 = Math.atan2(yd, xd) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
    
    return { q1, q2 };
}

function cinematicaInversaConQ1Fijo(xd, yd, q1_deseado) {
    const x1 = l1 * Math.cos(q1_deseado);
    const y1 = l1 * Math.sin(q1_deseado);
    
    const dx = xd - x1;
    const dy = yd - y1;
    
    const q2 = Math.atan2(dy, dx) - q1_deseado;
    
    const distancia = Math.sqrt(dx**2 + dy**2);
    const error = Math.abs(distancia - l2);
    
    if (error > 0.5) {
        throw new Error(`No se puede alcanzar (${xd}, ${yd}) cm con q1 = 90°. Distancia requerida: ${distancia.toFixed(2)} cm, pero l2 = ${l2} cm`);
    }
    
    return { q1: q1_deseado, q2 };
}

function moverBrazo() {
    try {
        const xd = parseFloat(document.getElementById('xd').value);
        const yd = parseFloat(document.getElementById('yd').value);
        
        const { q1, q2 } = cinematicaInversa(xd, yd);
        
        // Establecer posición objetivo
        brazoObjetivo.xd = xd;
        brazoObjetivo.yd = yd;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // crear nueva trayectoria
        const nuevaTrayectoria = [];
        historial.trayectorias.push(nuevaTrayectoria);
        
        // Iniciar animación si no está activa
        if (!animacionActiva) {
            animacionActiva = true;
            animarMovimiento(nuevaTrayectoria);
        }
        
    } catch (error) {
        alert(error.message);
    }
}

// Dibujar todas las trayectorias por cada movimientorespecto al efector final
function dibujarTodasLasTrayectorias() {
    if (historial.trayectorias.length === 0) return;
    
    ctx.strokeStyle = '#8B4513'; // Color marrón
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]); // Línea punteada
    
    // Dibujar cada trayectoria almacenada
    historial.trayectorias.forEach((trayectoria, index) => {
        if (trayectoria.length < 2) return;
        
        ctx.beginPath();
        
        // Dibujar curva que conecta todos los puntos de esta trayectoria
        ctx.moveTo(trayectoria[0].x, trayectoria[0].y);
        
        for (let i = 1; i < trayectoria.length; i++) {
            ctx.lineTo(trayectoria[i].x, trayectoria[i].y);
        }
        
        ctx.stroke();
    });
    
    ctx.setLineDash([]);
}

// Animación suave del movimiento con trayectoria
function animarMovimiento(trayectoriaActual) {
    const duracionAnimacion = 2000; // Se establece un parametro de movimiento de 2 segundos
    const fps = 60;
    const framesTotales = (duracionAnimacion / 1000) * fps;
    let frameActual = 0;
    
    const q1Inicial = brazoActual.q1;
    const q2Inicial = brazoActual.q2;
    const q1Objetivo = brazoObjetivo.q1;
    const q2Objetivo = brazoObjetivo.q2;
    
    function actualizarFrame() {
        frameActual++;
        const progreso = frameActual / framesTotales;
        
        // Usar easing function para movimiento suave
        const easing = 1 - Math.pow(1 - progreso, 3);
        
        // Interpolar ángulos
        brazoActual.q1 = q1Inicial + (q1Objetivo - q1Inicial) * easing;
        brazoActual.q2 = q2Inicial + (q2Objetivo - q2Inicial) * easing;
        
        // Calcular posición actual usando cinemática directa
        const x1 = l1 * Math.cos(brazoActual.q1);
        const y1 = l1 * Math.sin(brazoActual.q1);
        const x2 = x1 + l2 * Math.cos(brazoActual.q1 + brazoActual.q2);
        const y2 = y1 + l2 * Math.sin(brazoActual.q1 + brazoActual.q2);
        
        brazoActual.xd = x2;
        brazoActual.yd = y2;
        
        // AGREGAR PUNTO ACTUAL A LA TRAYECTORIA ACTUAL
        const x2_pantalla = origen.x + brazoActual.xd * escala;
        const y2_pantalla = origen.y - brazoActual.yd * escala;
        trayectoriaActual.push({ x: x2_pantalla, y: y2_pantalla });
        
        // Dibujar en cada frame
        dibujarRobot();
        
        if (frameActual < framesTotales) {
            requestAnimationFrame(actualizarFrame);
        } else {
            // Animación completada
            brazoActual.q1 = q1Objetivo;
            brazoActual.q2 = q2Objetivo;
            brazoActual.xd = brazoObjetivo.xd;
            brazoActual.yd = brazoObjetivo.yd;
            
            // Actualizar historial y gráfica
            tiempo += 1;
            historial.q1.push(brazoActual.q1 * (180 / Math.PI));
            historial.q2.push(brazoActual.q2 * (180 / Math.PI));
            historial.tiempo.push(tiempo);
            
            actualizarGrafica();
            mostrarInfoCinematica();
            
            animacionActiva = false;
            console.log(`Movimiento completado. Trayectorias acumuladas: ${historial.trayectorias.length}`);
        }
    }
    
    actualizarFrame();
}

// Esta funcion nos permite reordenar nuestro robot a su posicion inicial
function irAPosicionInicial() {
    try {
        const xd_metros = 0.0015;
        const yd_metros = 0.0015;
        const xd_cm = xd_metros * 100;
        const yd_cm = yd_metros * 100;
        const q1_inicial = 90 * Math.PI / 180;
        
        const { q1, q2 } = cinematicaInversaConQ1Fijo(xd_cm, yd_cm, q1_inicial);
        
        // Establecer posición objetivo
        brazoObjetivo.xd = xd_cm;
        brazoObjetivo.yd = yd_cm;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // crear nueva trayectoria 
        const nuevaTrayectoria = [];
        historial.trayectorias.push(nuevaTrayectoria);
        
        // Actualizar inputs de posición
        document.getElementById('xd').value = xd_cm;
        document.getElementById('yd').value = yd_cm;
        
        // Iniciar animación si no está activa
        if (!animacionActiva) {
            animacionActiva = true;
            animarMovimiento(nuevaTrayectoria);
        }
        
    } catch (error) {
        alert(error.message);
    }
}
// Actualizar datos de la gráfica
function actualizarGrafica() {
    grafica.data.labels = historial.tiempo;
    grafica.data.datasets[0].data = historial.q1;
    grafica.data.datasets[1].data = historial.q2;
    grafica.update('none');
}

// Dibujar el robot en el canvas que se integro 
function dibujarRobot() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar todas las trayectorias acumuladas primero estas quedaran por detrás
    dibujarTodasLasTrayectorias();
    
    dibujarAreaTrabajo();
    dibujarSistemaCoordenadas();
    
    const q1 = brazoActual.q1;
    const q2 = brazoActual.q2;
    
    // Aqui tenemos la funcionalidad de la cinemática directa
    const x1 = origen.x + l1 * Math.cos(q1) * escala;
    const y1 = origen.y - l1 * Math.sin(q1) * escala;
    const x2 = x1 + l2 * Math.cos(q1 + q2) * escala;
    const y2 = y1 - l2 * Math.sin(q1 + q2) * escala;
    
    // Dibujar trayectoria actual (línea punteada verde)
    if (animacionActiva) {
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        const x2_actual = origen.x + brazoActual.xd * escala;
        const y2_actual = origen.y - brazoActual.yd * escala;
        const x2_objetivo = origen.x + brazoObjetivo.xd * escala;
        const y2_objetivo = origen.y - brazoObjetivo.yd * escala;
        ctx.moveTo(x2_actual, y2_actual);
        ctx.lineTo(x2_objetivo, y2_objetivo);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Dibujar eslabón 1 (l1) - AZUL
    ctx.lineWidth = 6;
    ctx.strokeStyle = brazoActual.colorEslabon1;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    ctx.moveTo(origen.x, origen.y);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    
    // Dibujar eslabón 2 (l2) - ROJO
    ctx.strokeStyle = brazoActual.colorEslabon2;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // Dibujar articulaciones
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = 'darkred';
    ctx.beginPath();
    ctx.arc(x1, y1, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // Dibujar efector final que seran punto naranja cuando este se encuentre en trabajo activo o 
    // púrpura si esta en modo inicial en la punta de l2 EF
    ctx.fillStyle = animacionActiva ? 'orange' : 'purple';
    ctx.beginPath();
    ctx.arc(x2, y2, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Etiquetas de coordenadas necesarias para poder visualizar en el canvas
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText(`${"EF"}: (${brazoActual.xd.toFixed(1)}, ${brazoActual.yd.toFixed(1)}) cm`, x2 + 10, y2 - 10);
    
    // Indicador de animación para el efector final
    if (animacionActiva) {
        ctx.fillStyle = 'orange';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('→ Movimiento en progreso ←', canvas.width / 2, 30);
        
        // Mostrar información de trayectorias acumuladas
        ctx.fillStyle = '#8B4513';
        ctx.font = '12px Arial';
        ctx.fillText(`Trayectorias: ${historial.trayectorias.length}`, canvas.width / 2, 50);
    }
    
    // Etiquetas de los eslabones
    ctx.fillStyle = brazoActual.colorEslabon1;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`l1 = ${l1} cm`, origen.x + 20, origen.y - 20);
    
    ctx.fillStyle = brazoActual.colorEslabon2;
    ctx.fillText(`l2 = ${l2} cm`, x1 + 20, y1 - 20);
}

function dibujarAreaTrabajo() {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    const radioMax = (l1 + l2) * escala;
    const radioMin = Math.abs(l1 - l2) * escala;
    
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, radioMax, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, radioMin, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.setLineDash([]);
}

function dibujarSistemaCoordenadas() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Eje X
    ctx.beginPath();
    ctx.moveTo(0, origen.y);
    ctx.lineTo(canvas.width, origen.y);
    ctx.stroke();

    // Eje Y
    ctx.beginPath();
    ctx.moveTo(origen.x, 0);
    ctx.lineTo(origen.x, canvas.height);
    ctx.stroke();

    const intervalo = 10 * escala;
    const maxX = 30;
    const maxY = 30;

    for (let x = -maxX; x <= maxX; x += 10) {
        const xPixel = origen.x + x * escala;
        ctx.beginPath();
        ctx.moveTo(xPixel, origen.y - 5);
        ctx.lineTo(xPixel, origen.y + 5);
        ctx.stroke();
        ctx.fillText(x.toString(), xPixel, origen.y + 15);
    }

    for (let y = -maxY; y <= maxY; y += 10) {
        const yPixel = origen.y - y * escala;
        ctx.beginPath();
        ctx.moveTo(origen.x - 5, yPixel);
        ctx.lineTo(origen.x + 5, yPixel);
        ctx.stroke();
        if (y !== 0) {
            ctx.fillText(y.toString(), origen.x - 15, yPixel);
        }
    }

    ctx.textAlign = 'left';
    ctx.fillText('X', canvas.width - 15, origen.y - 10);
    ctx.textAlign = 'center';
    ctx.fillText('Y', origen.x + 10, 15);

    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.fillText('(0,0)', origen.x + 10, origen.y + 15);
}

function mostrarInfoCinematica() {
    const q1_grados = (brazoActual.q1 * 180 / Math.PI).toFixed(1);
    const q2_grados = (brazoActual.q2 * 180 / Math.PI).toFixed(1);
    
    const info = `Información Cinemática:
${brazoActual.nombre}:
  Posición actual: (${brazoActual.xd.toFixed(1)}, ${brazoActual.yd.toFixed(1)}) cm
  Posición en metros: (${(brazoActual.xd/100).toFixed(3)}, ${(brazoActual.yd/100).toFixed(3)}) m
  q₁: ${q1_grados}°
  q₂: ${q2_grados}°
  Trayectorias acumuladas: ${historial.trayectorias.length}
  Longitudes:
    l1: ${l1} cm (azul)
    l2: ${l2} cm (rojo)`;
    
    console.log(info);
}

function limpiarHistorial() {
    tiempo = 0;
    historial = {
        q1: [], 
        q2: [], 
        tiempo: [],
        trayectorias: []  // Limpiar todas las trayectorias
    };
    actualizarGrafica();
    dibujarRobot(); // Redibujar para quitar todas las trayectorias
}

function inicializarBrazo() {
    try {
        const { q1, q2 } = cinematicaInversa(brazoActual.xd, brazoActual.yd);
        brazoActual.q1 = q1;
        brazoActual.q2 = q2;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // AGREGAR POSICIÓN INICIAL A UNA TRAYECTORIA
        const x2_inicial = origen.x + brazoActual.xd * escala;
        const y2_inicial = origen.y - brazoActual.yd * escala;
        const trayectoriaInicial = [{ x: x2_inicial, y: y2_inicial }];
        historial.trayectorias.push(trayectoriaInicial);
        
        document.getElementById('xd').value = brazoActual.xd;
        document.getElementById('yd').value = brazoActual.yd;
    } catch (error) {
        console.error('Error inicializando el brazo:', error.message);
    }
}

document.getElementById('xd').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') moverBrazo();
});
document.getElementById('yd').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') moverBrazo();
});

inicializarBrazo();
dibujarRobot();