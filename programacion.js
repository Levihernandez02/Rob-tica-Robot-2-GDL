/**
 * SIMULADOR DE ROBOT ARTICULADO 2 GDL (GRADOS DE LIBERTAD)
 * 
 * Este programa simula un robot de 2 GDL (Grados de Libertad) con herramienta de 2cm.
 * Incluye cinemática inversa, animación suave, gráficas de ángulos y visualización de trayectorias.
 * 
 * Características principales:
 * - Cinemática inversa para calcular ángulos articulares
 * - Animación suave entre posiciones
 * - Historial de trayectorias acumulativas
 * - Gráficas en tiempo real de los ángulos
 * - Sistema de coordenadas cartesianas visual
 * - Validación del espacio de trabajo
 */

// =============================================================================
// CONFIGURACIÓN INICIAL Y CONSTANTES
// =============================================================================

/**
 * Obtiene el contexto del canvas para dibujar el robot
 */
const canvas = document.getElementById("robotCanvas");
const ctx = canvas.getContext("2d");

// Parámetros geométricos del robot (en centímetros)
const l1 = 12;  // Longitud del primer eslabón [cm]
const l2 = 12;  // Longitud del segundo eslabón [cm]
const herramienta = 2; // Longitud de la herramienta/pinza [cm]
const escala = 10; // Factor de escala: píxeles por centímetro

/**
 * Punto de origen del sistema de coordenadas del robot
 * Centrado en el canvas para mejor visualización
 */
const origen = { x: canvas.width / 2, y: canvas.height / 2 };

// =============================================================================
// VARIABLES DE ESTADO Y ALMACENAMIENTO
// =============================================================================

/**
 * Variables para el control del tiempo y almacenamiento de datos históricos
 */
let tiempo = 0; // Contador de tiempo para las gráficas
let historial = {
    q1: [],      // Historial del ángulo q1 en grados
    q2: [],      // Historial del ángulo q2 en grados  
    tiempo: [],  // Historial de marcas de tiempo
    trayectorias: [] // Array de trayectorias (cada movimiento es una trayectoria)
};

/**
 * Variables para el control de la animación
 */
let animacionActiva = false; // Bandera para evitar animaciones superpuestas
let brazoObjetivo = { 
    xd: 14, yd: 14, // Posición objetivo del efector final [cm]
    q1: 0, q2: 0    // Ángulos articulares objetivo [radianes]
};

/**
 * Estado actual del brazo robótico
 */
let brazoActual = { 
    xd: 14, yd: 14, // Posición actual del efector final [cm]
    q1: 0, q2: 0,   // Ángulos articulares actuales [radianes]
    colorEslabon1: "blue",   // Color para visualización del primer eslabón
    colorEslabon2: "red",    // Color para visualización del segundo eslabón
    nombre: "Brazo Robot"    // Identificador del robot
};

// =============================================================================
// CONFIGURACIÓN DE GRÁFICAS CON CHART.JS
// =============================================================================

/**
 * Inicializa la gráfica para mostrar la evolución temporal de los ángulos articulares
 * Utiliza Chart.js para visualización de datos en tiempo real
 */
const grafica = new Chart(document.getElementById("grafica1"), {
    type: 'line', // Gráfica de líneas para mostrar evolución temporal
    data: { 
        labels: [], // Eje X: tiempo
        datasets: [
            { 
                label: 'q₁(t) [°]', // Ángulo articular 1 en grados
                data: [], 
                borderColor: 'blue', 
                backgroundColor: 'rgba(0, 0, 255, 0.1)',
                borderWidth: 2,
                tension: 0.4, // Suavizado de curvas
                fill: false 
            },
            { 
                label: 'q₂(t) [°]', // Ángulo articular 2 en grados
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
        animation: false, // Desactiva animaciones para mejor rendimiento
        scales: { 
            x: { 
                title: { display: true, text: 'Tiempo (s)' }, // Eje X: tiempo en segundos
                grid: { color: 'rgba(0,0,0,0.1)' }
            }, 
            y: { 
                title: { display: true, text: 'Ángulo (°)' }, // Eje Y: ángulo en grados
                grid: { color: 'rgba(0,0,0,0.1)' }
            } 
        },
        plugins: {
            legend: { display: true }, // Muestra leyenda de datasets
            tooltip: { mode: 'index', intersect: false } // Tooltips interactivos
        }
    }
});

// =============================================================================
// FUNCIONES DE CINEMÁTICA
// =============================================================================

/**
 * CINEMÁTICA INVERSA - Calcula los ángulos articulares para una posición deseada
 * 
 * - Coordenada X deseada del efector final [cm]
 * - Coordenada Y deseada del efector final [cm]
 * Objeto con los ángulos q1 y q2 en radianes
 * Si la posición está fuera del espacio de trabajo o es singular
 * 
 * Método: Solución geométrica para robot planar 2R
 * Fórmulas derivadas de la ley de cosenos y geometría del triángulo
 */
function cinematicaInversa(xd, yd) {
    // Calcula la distancia desde el origen hasta la posición deseada
    const r = Math.sqrt(xd ** 2 + yd ** 2);
    const alcanceMax = l1 + l2;   // Alcance máximo del robot
    const alcanceMin = Math.abs(l1 - l2); // Alcance mínimo (configuración plegada)
    
    // Validación del espacio de trabajo
    if (r > alcanceMax || r < alcanceMin) {
        throw new Error(`Punto (${xd.toFixed(2)}, ${yd.toFixed(2)}) fuera del espacio de trabajo. Alcance: [${alcanceMin.toFixed(2)}, ${alcanceMax.toFixed(2)}] cm`);
    }
    
    // Cálculo del coseno del ángulo q2 usando ley de cosenos
    const c2 = (xd**2 + yd**2 - l1**2 - l2**2) / (2 * l1 * l2);
    
    // Verificación de singularidades (configuraciones límite)
    if (Math.abs(c2) > 1) {
        throw new Error(`Singularidad: no se puede alcanzar el punto (${xd}, ${yd})`);
    }
    
    // Cálculo de los ángulos articulares
    const q2 = Math.acos(c2); // Ángulo del codo (solución positiva)
    const q1 = Math.atan2(yd, xd) - Math.atan2(l2 * Math.sin(q2), l1 + l2 * Math.cos(q2));
    
    return { q1, q2 };
}

// =============================================================================
// FUNCIONES DE CONTROL Y ANIMACIÓN
// =============================================================================

/**
 * MUEVE EL BRAZO - Función principal para mover el robot a una nueva posición
 * 1. Lee las coordenadas objetivo desde los inputs
 * 2. Calcula la cinemática inversa
 * 3. Inicia la animación suave
 * 4. Maneja errores de espacio de trabajo
 */
function moverBrazo() {
    try {
        // Lectura de coordenadas objetivo desde la interfaz
        const xd = parseFloat(document.getElementById('xd').value);
        const yd = parseFloat(document.getElementById('yd').value);
        
        // Cálculo de cinemática inversa
        const { q1, q2 } = cinematicaInversa(xd, yd);
        
        // Configuración del estado objetivo
        brazoObjetivo.xd = xd;
        brazoObjetivo.yd = yd;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // Creación de nueva trayectoria (acumulativa)
        const nuevaTrayectoria = [];
        historial.trayectorias.push(nuevaTrayectoria);
        
        // Inicio de animación si no hay una en curso
        if (!animacionActiva) {
            animacionActiva = true;
            animarMovimiento(nuevaTrayectoria);
        }
        
    } catch (error) {
        alert(error.message); // Notificación de errores al usuario
    }
}

/**
 * POSICIÓN INICIAL - Mueve el robot a la posición inicial predefinida
 * Posición inicial: (14, 14) cm
 * Usa cinemática inversa normal sin restricciones de ángulo
 */
function irAPosicionInicial() {
    try {
        // Posición inicial predefinida en centímetros
        const xd_cm = 14;
        const yd_cm = 14;
        
        // Cálculo de cinemática inversa para posición inicial
        const { q1, q2 } = cinematicaInversa(xd_cm, yd_cm);
        
        // Configuración del estado objetivo
        brazoObjetivo.xd = xd_cm;
        brazoObjetivo.yd = yd_cm;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // Creación de nueva trayectoria
        const nuevaTrayectoria = [];
        historial.trayectorias.push(nuevaTrayectoria);
        
        // Actualización de la interfaz
        document.getElementById('xd').value = xd_cm;
        document.getElementById('yd').value = yd_cm;
        
        // Inicio de animación
        if (!animacionActiva) {
            animacionActiva = true;
            animarMovimiento(nuevaTrayectoria);
        }
        
        console.log(`Posición inicial establecida: (${xd_cm}, ${yd_cm}) cm`);
        
    } catch (error) {
        alert(error.message);
    }
}

/**
 * DIBUJA TRAYECTORIAS - Visualiza todas las trayectorias acumuladas
 * - Dibuja líneas punteadas marrones que representan el camino recorrido
 * - Cada movimiento genera una nueva trayectoria
 * - Las trayectorias se acumulan hasta que se limpia el historial
 */
function dibujarTodasLasTrayectorias() {
    if (historial.trayectorias.length === 0) return;
    
    // Configuración de estilo para trayectorias
    ctx.strokeStyle = '#8B4513'; // Color marrón
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]); // Línea punteada
    
    // Dibuja cada trayectoria almacenada
    historial.trayectorias.forEach((trayectoria, index) => {
        if (trayectoria.length < 2) return; // Se necesitan al menos 2 puntos
        
        ctx.beginPath();
        
        // Conecta todos los puntos de la trayectoria
        ctx.moveTo(trayectoria[0].x, trayectoria[0].y);
        for (let i = 1; i < trayectoria.length; i++) {
            ctx.lineTo(trayectoria[i].x, trayectoria[i].y);
        }
        
        ctx.stroke();
    });
    
    ctx.setLineDash([]); // Restaura línea continua
}

/**
 * ANIMACIÓN DE MOVIMIENTO - Controla la transición suave entre posiciones
 * 
 * - Array para almacenar puntos de la trayectoria actual
 * - Interpolación suave de ángulos usando función de easing
 * - Muestreo de trayectoria a 60 FPS
 * - Duración total: 2 segundos
 * - Actualización en tiempo real de la visualización
 */
function animarMovimiento(trayectoriaActual) {
    const duracionAnimacion = 2000; // Duración total en milisegundos
    const fps = 60; // Cuadros por segundo
    const framesTotales = (duracionAnimacion / 1000) * fps;
    let frameActual = 0;
    
    // Estado inicial para interpolación
    const q1Inicial = brazoActual.q1;
    const q2Inicial = brazoActual.q2;
    const q1Objetivo = brazoObjetivo.q1;
    const q2Objetivo = brazoObjetivo.q2;
    
    /**
     * ACTUALIZACIÓN DE FRAME - Función recursiva para animación
     */
    function actualizarFrame() {
        frameActual++;
        const progreso = frameActual / framesTotales;
        
        // Función de easing cúbica para movimiento suave
        const easing = 1 - Math.pow(1 - progreso, 3);
        
        // Interpolación lineal de ángulos
        brazoActual.q1 = q1Inicial + (q1Objetivo - q1Inicial) * easing;
        brazoActual.q2 = q2Inicial + (q2Objetivo - q2Inicial) * easing;
        
        // CINEMÁTICA DIRECTA - Calcula posición actual a partir de ángulos
        const x1 = l1 * Math.cos(brazoActual.q1);
        const y1 = l1 * Math.sin(brazoActual.q1);
        const x2 = x1 + l2 * Math.cos(brazoActual.q1 + brazoActual.q2);
        const y2 = y1 + l2 * Math.sin(brazoActual.q1 + brazoActual.q2);
        
        brazoActual.xd = x2;
        brazoActual.yd = y2;
        
        // Registro de punto en la trayectoria (coordenadas de pantalla)
        const x2_pantalla = origen.x + brazoActual.xd * escala;
        const y2_pantalla = origen.y - brazoActual.yd * escala;
        trayectoriaActual.push({ x: x2_pantalla, y: y2_pantalla });
        
        // Actualización visual
        dibujarRobot();
        
        // Control de finalización de animación
        if (frameActual < framesTotales) {
            requestAnimationFrame(actualizarFrame);
        } else {
            // ANIMACIÓN COMPLETADA
            brazoActual.q1 = q1Objetivo;
            brazoActual.q2 = q2Objetivo;
            brazoActual.xd = brazoObjetivo.xd;
            brazoActual.yd = brazoObjetivo.yd;
            
            // Actualización de historial para gráficas
            tiempo += 1;
            historial.q1.push(brazoActual.q1 * (180 / Math.PI)); // Conversión a grados
            historial.q2.push(brazoActual.q2 * (180 / Math.PI));
            historial.tiempo.push(tiempo);
            
            actualizarGrafica();
            mostrarInfoCinematica();
            
            animacionActiva = false;
            console.log(`Movimiento completado. Trayectorias acumuladas: ${historial.trayectorias.length}`);
        }
    }
    
    // Inicio del bucle de animación
    actualizarFrame();
}

/**
 * ACTUALIZA GRÁFICA - Refresca la visualización de datos angulares
 */
function actualizarGrafica() {
    grafica.data.labels = historial.tiempo;
    grafica.data.datasets[0].data = historial.q1;
    grafica.data.datasets[1].data = historial.q2;
    grafica.update('none'); // Actualización sin animación
}

// =============================================================================
// FUNCIONES DE VISUALIZACIÓN
// =============================================================================

/**
 * DIBUJA EL ROBOT - Función principal de renderizado
 * 
 * - Orden de dibujo:
 * 1. Trayectorias históricas (fondo)
 * 2. Área de trabajo
 * 3. Sistema de coordenadas
 * 4. Eslabones y articulaciones
 * 5. Efector final y etiquetas
 */
function dibujarRobot() {
    // Limpieza del canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Orden de dibujo (de fondo a primer plano)
    dibujarTodasLasTrayectorias(); // Trayectorias en el fondo
    dibujarAreaTrabajo();          // Área de trabajo
    dibujarSistemaCoordenadas();   // Sistema cartesiano
    
    // CINEMÁTICA DIRECTA - Conversión de ángulos a coordenadas de pantalla
    const q1 = brazoActual.q1;
    const q2 = brazoActual.q2;
    
    const x1 = origen.x + l1 * Math.cos(q1) * escala;
    const y1 = origen.y - l1 * Math.sin(q1) * escala;
    const x2 = x1 + l2 * Math.cos(q1 + q2) * escala;
    const y2 = y1 - l2 * Math.sin(q1 + q2) * escala;
    
    // Trayectoria actual (línea verde punteada durante animación)
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
    
    // DIBUJO DE ESLABONES
    // Eslabón 1 (base a primera articulación)
    ctx.lineWidth = 6;
    ctx.strokeStyle = brazoActual.colorEslabon1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(origen.x, origen.y);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    
    // Eslabón 2 (primera a segunda articulación)
    ctx.strokeStyle = brazoActual.colorEslabon2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    // ARTICULACIONES
    // Articulación base
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Articulación intermedia
    ctx.fillStyle = 'darkred';
    ctx.beginPath();
    ctx.arc(x1, y1, 6, 0, 2 * Math.PI);
    ctx.fill();
    
    // EFECTOR FINAL (punto naranja/púrpura)
    ctx.fillStyle = animacionActiva ? 'orange' : 'purple';
    ctx.beginPath();
    ctx.arc(x2, y2, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // ETIQUETAS INFORMATIVAS
    // Coordenadas del efector final
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText(`${"EF"}: (${brazoActual.xd.toFixed(1)}, ${brazoActual.yd.toFixed(1)}) cm`, x2 + 10, y2 - 10);
    
    // Indicador de animación en curso
    if (animacionActiva) {
        ctx.fillStyle = 'orange';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('→ Movimiento en progreso ←', canvas.width / 2, 30);
        
        // Contador de trayectorias
        ctx.fillStyle = '#8B4513';
        ctx.font = '12px Arial';
        ctx.fillText(`Trayectorias: ${historial.trayectorias.length}`, canvas.width / 2, 50);
    }
    
    // Etiquetas de longitudes
    ctx.fillStyle = brazoActual.colorEslabon1;
    ctx.font = 'bold 14px Arial';
    ctx.fillText(`l1 = ${l1} cm`, origen.x + 20, origen.y - 20);
    
    ctx.fillStyle = brazoActual.colorEslabon2;
    ctx.fillText(`l2 = ${l2} cm`, x1 + 20, y1 - 20);
}

/**
 * DIBUJA ÁREA DE TRABAJO - Muestra los límites de alcance del robot
 */
function dibujarAreaTrabajo() {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Círculos concéntricos que representan alcance mínimo y máximo
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

/**
 * DIBUJA SISTEMA DE COORDENADAS - Ejes cartesianos con escala
 */
function dibujarSistemaCoordenadas() {
    // Configuración de estilo para ejes
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Eje X (horizontal)
    ctx.beginPath();
    ctx.moveTo(0, origen.y);
    ctx.lineTo(canvas.width, origen.y);
    ctx.stroke();

    // Eje Y (vertical)
    ctx.beginPath();
    ctx.moveTo(origen.x, 0);
    ctx.lineTo(origen.x, canvas.height);
    ctx.stroke();

    // ESCALAS NUMÉRICAS - Marcas cada 10 cm
    const intervalo = 10 * escala;
    const maxX = 30; // Límite de visualización en X [cm]
    const maxY = 30; // Límite de visualización en Y [cm]

    // Marcas en eje X
    for (let x = -maxX; x <= maxX; x += 10) {
        const xPixel = origen.x + x * escala;
        ctx.beginPath();
        ctx.moveTo(xPixel, origen.y - 5);
        ctx.lineTo(xPixel, origen.y + 5);
        ctx.stroke();
        ctx.fillText(x.toString(), xPixel, origen.y + 15);
    }

    // Marcas en eje Y
    for (let y = -maxY; y <= maxY; y += 10) {
        const yPixel = origen.y - y * escala; // Invertido porque Y crece hacia arriba
        ctx.beginPath();
        ctx.moveTo(origen.x - 5, yPixel);
        ctx.lineTo(origen.x + 5, yPixel);
        ctx.stroke();
        if (y !== 0) {
            ctx.fillText(y.toString(), origen.x - 15, yPixel);
        }
    }

    // Etiquetas de ejes
    ctx.textAlign = 'left';
    ctx.fillText('X', canvas.width - 15, origen.y - 10);
    ctx.textAlign = 'center';
    ctx.fillText('Y', origen.x + 10, 15);

    // Punto de origen (0,0)
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(origen.x, origen.y, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.fillText('(0,0)', origen.x + 10, origen.y + 15);
}

// =============================================================================
// FUNCIONES DE UTILIDAD Y DIAGNÓSTICO
// =============================================================================

/**
 * MUESTRA INFORMACIÓN CINEMÁTICA - Log detallado en consola
 * 
 * - Proporciona información útil para:
 * - Depuración de movimientos
 * - Análisis de configuración articular
 * - Verificación de cálculos
 */
function mostrarInfoCinematica() {
    const q1_grados = (brazoActual.q1 * 180 / Math.PI).toFixed(1);
    const q2_grados = (brazoActual.q2 * 180 / Math.PI).toFixed(1);
    
    const info = `INFORMACIÓN CINEMÁTICA - Robot 2 GDL
========================
${brazoActual.nombre}:
• Posición del efector: (${brazoActual.xd.toFixed(1)}, ${brazoActual.yd.toFixed(1)}) cm
• Ángulos articulares:
  - q₁: ${q1_grados}° (articulación base)
  - q₂: ${q2_grados}° (articulación de codo)
• Estadísticas:
  - Trayectorias acumuladas: ${historial.trayectorias.length}
  - Movimientos registrados: ${historial.tiempo.length}
• Configuración geométrica:
  - l1: ${l1} cm (eslabón base - azul)
  - l2: ${l2} cm (eslabón distal - rojo)
  - Herramienta: ${herramienta} cm (pinza)
========================`;
    
    console.log(info);
}

/**
 * LIMPIA HISTORIAL - Reinicia todos los datos almacenados
 * - Limpia historial de ángulos y tiempos
 * - Elimina todas las trayectorias acumuladas
 * - Reinicia contadores temporales
 * - Actualiza visualizaciones
 */
function limpiarHistorial() {
    tiempo = 0;
    historial = {
        q1: [], 
        q2: [], 
        tiempo: [],
        trayectorias: [] // Limpieza completa de trayectorias
    };
    actualizarGrafica();
    dibujarRobot(); // Redibujado para reflejar cambios
}

/**
 * INICIALIZA EL BRAZO - Configuración inicial del robot
 * - Calcula cinemática inversa para posición inicial
 * - Configura estado actual y objetivo
 * - Prepara primera trayectoria
 * - Actualiza interfaz de usuario
 */
function inicializarBrazo() {
    try {
        // Cálculo de configuración inicial
        const { q1, q2 } = cinematicaInversa(brazoActual.xd, brazoActual.yd);
        brazoActual.q1 = q1;
        brazoActual.q2 = q2;
        brazoObjetivo.q1 = q1;
        brazoObjetivo.q2 = q2;
        
        // Inicialización de trayectoria inicial
        const x2_inicial = origen.x + brazoActual.xd * escala;
        const y2_inicial = origen.y - brazoActual.yd * escala;
        const trayectoriaInicial = [{ x: x2_inicial, y: y2_inicial }];
        historial.trayectorias.push(trayectoriaInicial);
        
        // Sincronización con interfaz
        document.getElementById('xd').value = brazoActual.xd;
        document.getElementById('yd').value = brazoActual.yd;
        
    } catch (error) {
        console.error('Error en inicialización del brazo:', error.message);
    }
}

// =============================================================================
// CONFIGURACIÓN DE EVENT LISTENERS
// =============================================================================

/**
 * Configuración de eventos de teclado para mejor usabilidad
 * Enter en campos de entrada activa el movimiento
 */
document.getElementById('xd').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') moverBrazo();
});
document.getElementById('yd').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') moverBrazo();
});

// =============================================================================
// INICIALIZACIÓN DEL SISTEMA
// =============================================================================

/**
 * Punto de entrada principal - Inicializa y renderiza el robot
 */
inicializarBrazo();
dibujarRobot();
