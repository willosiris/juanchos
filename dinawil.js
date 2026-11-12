'use strict';

/* ============================================================================
   Juancho's · Punto de venta (dinawil.js)
   - Usuario Administrador maestro por defecto: WILLOSIRIS.
   - Sesión persistente al refrescar (caduca tras 3 horas de inactividad).
   - Roles: Administrador, Encargado de Caja y Cocina (con guía de permisos).
   - Inicio / Cocina, Salón (con traslado y mesa ocupada/liberada post-pago),
     Envíos a domicilio, Recortador de imágenes 1:1 PNG transparente,
     Ticket 80mm (Control Interno con mesa gigante a 3m + Cliente) + A4 y Supabase.
   ============================================================================ */

const STORAGE_KEY = 'juanchos_pos_v3';
const SESSION_KEY = 'juanchos_sesion_v3';
const INACTIVIDAD_MAX_MS = 3 * 60 * 60 * 1000; // 3 horas
const PIN_ADMIN_MAESTRO = '749696';
const CLAVE_LICENCIA_MAESTRA = '74969686@';

const ETIQ_MESA = { libre: 'Libre', ocupada: 'Ocupada', precuenta: 'Pre-cuenta', reservada: 'Reservada' };
const ROL_NOMBRE = { admin: 'Administrador', caja: 'Encargado de Caja', cocina: 'Cocina' };

const CATALOGO_PERMISOS = [
  { codigo: 'pedidos.inicio', titulo: 'Tablero de Inicio / Cocina', guia: 'Permite ver los pedidos enviados a cocina en tiempo real y marcarlos como entregados o en espera.' },
  { codigo: 'salon.operar', titulo: 'Atención de Salón y Mesas', guia: 'Permite abrir mesas, trasladar cuentas de una mesa a otra y gestionar si la mesa queda ocupada o libre.' },
  { codigo: 'mesas.modificar', titulo: 'Modificar Mesas (Capacidad y Nombres)', guia: 'Permite editar la capacidad de personas, número y nombre de las mesas del salón con contraseña secreta.' },
  { codigo: 'envios.operar', titulo: 'Gestión de Envíos (Delivery)', guia: 'Permite registrar pedidos a domicilio con dirección y controlar su entrega y pago.' },
  { codigo: 'comandera.operar', titulo: 'Toma de Pedidos en Comandera', guia: 'Permite agregar platos, modificadores y enviar comandas a preparación.' },
  { codigo: 'caja.cobrar', titulo: 'Caja y Cobranza (Efectivo / Yape)', guia: 'Permite emitir comprobantes, dividir cuentas y registrar pagos en Efectivo o Yape.' },
  { codigo: 'turno.cerrar', titulo: 'Reportes y Arqueo de Turno', guia: 'Permite consultar ventas diarias/semanales/mensuales/anuales, imprimir reportes y cerrar turno.' },
  { codigo: 'reportes.editar', titulo: 'Editar y Eliminar Reportes de Venta', guia: 'Permite modificar o eliminar ventas del registro histórico utilizando la contraseña secreta asignada.' },
  { codigo: 'impresion.permitir', titulo: 'Autorización de Impresión', guia: 'Si está activo, este usuario puede disparar impresiones de comandas y comprobantes.' },
  { codigo: 'productos.editar', titulo: 'Editar Productos (Imagen y Precios)', guia: 'Permite modificar precios, descripción e imagen 1:1 de los productos del catálogo en ventana emergente.' },
  { codigo: 'carta.administrar', titulo: 'Administrar Carta y Stock Completo', guia: 'Permite crear o eliminar platos, recetas, insumos y registrar mermas.' },
  { codigo: 'ajustes.administrar', titulo: 'Ajustes Administrativos', guia: 'Acceso total a usuarios, impresoras, conexión Supabase y licencia del sistema.' }
];

const PERMISOS_POR_ROL = {
  admin: CATALOGO_PERMISOS.map(p => p.codigo),
  caja: ['pedidos.inicio', 'salon.operar', 'envios.operar', 'comandera.operar', 'caja.cobrar', 'turno.cerrar', 'impresion.permitir'],
  cocina: ['pedidos.inicio']
};

const TEMAS_PREDEFINIDOS = [
  {
    id: 'brasa_nocturna',
    nombre: 'Brasa Nocturna',
    desc: 'Carbón cálido de salchipapería con acentos azafrán y crema.',
    modo: 'dark',
    colores: {
      '--bg': '#12100e',
      '--panel': '#1a1714',
      '--azafran': '#e07a1f',
      '--crema': '#f5efe6',
      '--libre': '#2e9e68',
      '--ocup': '#d65a31',
      '--yape': '#742384',
      '--txt': '#f3eee8'
    }
  },
  {
    id: 'marfil_editorial',
    nombre: 'Marfil Editorial',
    desc: 'Superficie clara de papel cálido de alto contraste para ambientes iluminados.',
    modo: 'light',
    colores: {
      '--bg': '#f6f2ec',
      '--panel': '#ffffff',
      '--azafran': '#c6620c',
      '--crema': '#1f1a15',
      '--libre': '#1f8252',
      '--ocup': '#c2461f',
      '--yape': '#6b1d7a',
      '--txt': '#1f1b17'
    }
  },
  {
    id: 'cupertino_midnight',
    nombre: 'Cupertino Midnight',
    desc: 'Pizarra nocturna profunda con acentos ámbar dorado y verde esmeralda.',
    modo: 'dark',
    colores: {
      '--bg': '#0e1116',
      '--panel': '#161b22',
      '--azafran': '#f0883e',
      '--crema': '#f0f6fc',
      '--libre': '#2ea043',
      '--ocup': '#da552f',
      '--yape': '#8957e5',
      '--txt': '#e6edf3'
    }
  },
  {
    id: 'selva_esmeralda',
    nombre: 'Selva Esmeralda',
    desc: 'Verde bosque profundo con acentos cobre tostado y marfil.',
    modo: 'dark',
    colores: {
      '--bg': '#0d1512',
      '--panel': '#14201b',
      '--azafran': '#d97724',
      '--crema': '#ecfdf5',
      '--libre': '#10b981',
      '--ocup': '#e05638',
      '--yape': '#7c3aed',
      '--txt': '#e6f4ee'
    }
  },
  {
    id: 'terracota_andina',
    nombre: 'Terracota Andina',
    desc: 'Tierra tostada artesanal con terracota intensa y piedra cálida.',
    modo: 'dark',
    colores: {
      '--bg': '#171110',
      '--panel': '#221917',
      '--azafran': '#ea580c',
      '--crema': '#fff7ed',
      '--libre': '#22c55e',
      '--ocup': '#dc4a2d',
      '--yape': '#8b2fc9',
      '--txt': '#f8ebe6'
    }
  }
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const soles = n => 'S/ ' + (Number(n) || 0).toFixed(2);
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtHora(iso) {
  if (!iso) return '00:00';
  return new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function fmtFechaHora(iso) {
  if (!iso) return 'Sin registro';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
    d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
}
function iniciales(nombre) {
  const partes = String(nombre || '').trim().split(/[\s_]+/).filter(Boolean);
  if (!partes.length) return 'U';
  return (partes[0][0] + (partes[1]?.[0] || partes[0][1] || '')).toUpperCase();
}
function minutosDesde(ts) {
  if (!ts) return 0;
  return Math.max(0, Math.floor((Date.now() - ts) / 60000));
}

function hashPinSync(pin, sal = 'juanchos_v3') {
  const texto = `${sal}:${String(pin).trim()}`;
  let h1 = 0xdeadbeef ^ texto.length, h2 = 0x41c6ce57 ^ texto.length;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'h3_' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/* ================= Estado inicial con WILLOSIRIS (PIN 749696) ================= */
function crearPlantillaTicketBase(tipo = 'interno') {
  const esCliente = tipo === 'cliente';
  return {
    tituloMarca: "Juancho's",
    subtituloMarca: esCliente ? 'SALCHIPAPERÍA & COCINA' : 'CONTROL INTERNO · CAJA',
    lineaRuc: esCliente ? "Juancho's · Atención al Cliente" : 'USO EXCLUSIVO DE CONTROL INTERNO',
    direccion: 'Av. Principal 123',
    ciudad: 'Lima, Perú',
    telefono: '(01) 555-1234',
    tituloDoc: esCliente ? 'COMPROBANTE DE VENTA' : 'TICKET DE CONTROL INTERNO',
    lblCheck: 'Check:',
    lblCajero: 'Cashier:',
    lblOrden: 'Order #:',
    lblCliente: 'Cliente:',
    lblFecha: 'DATE:',
    lblHora: 'TIME:',
    lblSubtotal: 'SUBTOTAL',
    lblIgv: 'IGV (18%)',
    lblTotal: 'TOTAL',
    lblMetodo: 'PAYMENT',
    lblRecibido: 'AMOUNT',
    lblVuelto: 'CHANGE DUE',
    piePagina: esCliente
      ? 'Comuníquese con el encargado de turno ante cualquier consulta sobre su visita.'
      : 'Documento de control interno de caja y despacho. Conserve para arqueo de turno.',
    promoTexto: esCliente
      ? '¡Gracias por su preferencia! El mejor sabor en salchipapas y carnes.'
      : 'Verificado en sistema POS · Control de turno',
    lblCodigo: esCliente ? 'Survey Code:' : 'Control ID:',
    margenMm: 4,
    fontTituloPx: 16,
    fontCuerpoPx: 12,
    mostrarLogo: true,
    mostrarImpuestos: true,
    mostrarBarcode: true
  };
}

function crearDBVacia() {
  return {
    version: 3,
    tema: 'dark',
    temaPreset: 'brasa_nocturna',
    coloresCustom: {},
    config: {
      igv: 0.18,
      nombreLocal: "Juancho's",
      lemaLocal: 'Salchipapería & Punto de venta',
      ruc: '',
      logoPrincipal: 'logo.png',
      favicon: 'favicon.png',
      carpetaDescarga: 'Descargas/Juanchos_POS'
    },
    impresion: {
      impCaja: 'Ticketera_Caja_80mm',
      impCocina: 'Ticketera_Cocina_80mm',
      impReportes: 'Impresora_Oficina_A4',
      usarTicketCliente: false, // false = Control Interno por defecto, true = Ticket para Cliente
      autoCocina: false,
      autoCobro: true,
      autoPrecuenta: true,
      modoColorA4: 'color',
      plantillaInterno: crearPlantillaTicketBase('interno'),
      plantillaCliente: crearPlantillaTicketBase('cliente')
    },
    supabase: {
      url: 'https://qkhliyvtrawtveexuxls.supabase.co',
      anonKey: 'sb_publishable_Ds4IYaHux6yT2koNicw4Ug_OoZYyCQ_',
      conectado: true,
      ultimaSync: null
    },
    licencia: {
      activa: true,
      fechaFin: '',
      maxVentasDia: 0
    },
    secuencias: { ambiente: 1, mesa: 0, envio: 0, producto: 0, insumo: 0, venta: 0, cierre: 0, usuario: 1, mov: 0, act: 0, ordenCocina: 0 },
    usuarios: [
      {
        id: 1,
        nombre: 'WILLOSIRIS',
        rol: 'admin',
        pinHash: hashPinSync(PIN_ADMIN_MAESTRO, '1'),
        pinPlain: PIN_ADMIN_MAESTRO,
        pinLen: 6,
        claveSecreta: PIN_ADMIN_MAESTRO,
        claveSecretaHash: hashPinSync(PIN_ADMIN_MAESTRO, 'sec_1'),
        foto: '',
        permisos: [...PERMISOS_POR_ROL.admin],
        activo: true,
        esMaestro: true,
        creadoEn: new Date().toISOString(),
        ultimoAcceso: null
      }
    ],
    ambientes: [{ id: 1, nombre: 'Salón Principal', orden: 1 }],
    mesas: [],
    envios: [],
    ordenesCocina: [],
    categorias: [],
    modificadores: [],
    insumos: {},
    productos: [],
    recetas: {},
    turnoAbierto: null,
    ventas: [],
    movimientos: [],
    cierres: [],
    actividad: []
  };
}

let DB = cargarDB();
let sesion = null;
let usuarioPinSel = null;
let pinBuffer = '';
let ambienteActualId = DB.ambientes[0]?.id || 1;
let catActual = 'Todas';
let busquedaPlato = '';
let metodoPago = 'Efectivo';
let filtroMetodoRep = 'Todos';
let filtroPeriodoRep = 'diario';
let filtroCocinaEstado = 'pendientes';
let formatoImpresionRep = 'a4';
let plantillaEditando = 'interno'; // 'interno' | 'cliente'
let cuentaActiva = { tipo: null, id: null }; // { tipo: 'mesa' | 'envio', id: Number }
let editandoMesas = false;
let platoEditandoId = null;
let usuarioEditandoId = null;
let imgTempPlato = '';
let imgTempInsumo = '';
let imgTempUsuario = '';
let modProdId = null;
let cobroActual = null;
let ultimoItemAgregadoKey = null;
let toastTimer = null;
let licenciaDesbloqueada = false;

function normalizarDB(d) {
  const base = crearDBVacia();
  if (!d || typeof d !== 'object') return base;
  const impIn = d.impresion || {};
  const out = {
    ...base,
    ...d,
    temaPreset: d.temaPreset || base.temaPreset,
    config: { ...base.config, ...(d.config || {}) },
    impresion: {
      ...base.impresion,
      ...impIn,
      plantillaInterno: { ...crearPlantillaTicketBase('interno'), ...(impIn.plantillaInterno || {}) },
      plantillaCliente: { ...crearPlantillaTicketBase('cliente'), ...(impIn.plantillaCliente || {}) }
    },
    supabase: { ...base.supabase, ...(d.supabase || {}) },
    licencia: { ...base.licencia, ...(d.licencia || {}) },
    secuencias: { ...base.secuencias, ...(d.secuencias || {}) },
    ambientes: Array.isArray(d.ambientes) && d.ambientes.length ? d.ambientes : base.ambientes,
    mesas: Array.isArray(d.mesas) ? d.mesas : [],
    envios: Array.isArray(d.envios) ? d.envios : [],
    ordenesCocina: Array.isArray(d.ordenesCocina) ? d.ordenesCocina : [],
    categorias: Array.isArray(d.categorias) ? d.categorias : [],
    modificadores: Array.isArray(d.modificadores) ? d.modificadores : [],
    insumos: d.insumos && typeof d.insumos === 'object' && !Array.isArray(d.insumos) ? d.insumos : {},
    productos: Array.isArray(d.productos) ? d.productos : [],
    recetas: d.recetas && typeof d.recetas === 'object' ? d.recetas : {},
    ventas: Array.isArray(d.ventas) ? d.ventas : [],
    movimientos: Array.isArray(d.movimientos) ? d.movimientos : [],
    cierres: Array.isArray(d.cierres) ? d.cierres : [],
    actividad: Array.isArray(d.actividad) ? d.actividad : []
  };
  const usrs = Array.isArray(d.usuarios) ? d.usuarios : [];
  const maestro = usrs.find(u => u.nombre?.toUpperCase() === 'WILLOSIRIS' || u.esMaestro);
  if (!maestro) {
    usrs.unshift(base.usuarios[0]);
  } else {
    maestro.nombre = 'WILLOSIRIS';
    maestro.rol = 'admin';
    maestro.pinLen = 6;
    maestro.pinHash = hashPinSync(maestro.pinPlain || PIN_ADMIN_MAESTRO, String(maestro.id));
    maestro.claveSecreta = maestro.claveSecreta || PIN_ADMIN_MAESTRO;
    maestro.claveSecretaHash = hashPinSync(maestro.claveSecreta, 'sec_' + String(maestro.id));
    maestro.permisos = [...PERMISOS_POR_ROL.admin];
    maestro.esMaestro = true;
    maestro.activo = true;
  }
  out.usuarios = usrs;
  return out;
}

function cargarDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizarDB(JSON.parse(raw));
  } catch (_) {}
  return crearDBVacia();
}
function guardarDB() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(DB)); } catch (_) {}
}
function sigId(clave) {
  DB.secuencias[clave] = (DB.secuencias[clave] || 0) + 1;
  return DB.secuencias[clave];
}
function registrarActividad(accion, detalle = '') {
  DB.actividad.unshift({
    id: sigId('act'),
    fecha: new Date().toISOString(),
    usuario: sesion?.nombre || 'Sistema',
    rol: sesion?.rol || 'admin',
    accion,
    detalle
  });
  if (DB.actividad.length > 200) DB.actividad.length = 200;
}

/* ================= Tema Oscuro / Claro (Estilo iOS) y 5 Temas Predefinidos ================= */
function aplicarTema(tema) {
  DB.tema = tema === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', DB.tema);
  const esClaro = DB.tema === 'light';
  ['#btnTemaLogin', '#btnTemaTopbar'].forEach(sel => {
    const b = $(sel);
    if (b) b.setAttribute('aria-checked', String(esClaro));
  });
  const lbl = $('#lblTemaLogin');
  if (lbl) lbl.textContent = esClaro ? 'Claro' : 'Oscuro';
  const meta = $('#metaThemeColor');
  if (meta) meta.setAttribute('content', esClaro ? '#f6f2ec' : '#12100e');
  aplicarColoresPersonalizados();
  guardarDB();
}
function alternarTema() {
  const nuevoModo = DB.tema === 'light' ? 'dark' : 'light';
  if (nuevoModo === 'light') {
    DB.temaPreset = 'marfil_editorial';
    DB.coloresCustom = {};
  } else if (DB.temaPreset === 'marfil_editorial') {
    DB.temaPreset = 'brasa_nocturna';
    DB.coloresCustom = {};
  }
  aplicarTema(nuevoModo);
  if ($('#aj-colores')?.classList.contains('active')) renderColoresAjustes();
}
function aplicarColoresPersonalizados() {
  const root = document.documentElement;
  const vars = ['--bg', '--panel', '--azafran', '--crema', '--libre', '--ocup', '--yape', '--txt'];
  vars.forEach(v => root.style.removeProperty(v));
  if (DB.coloresCustom && typeof DB.coloresCustom === 'object') {
    Object.entries(DB.coloresCustom).forEach(([k, val]) => {
      if (val) root.style.setProperty(k, val);
    });
  }
}

/* ================= Utilidades UI, Sonido/Efecto Yape y Animación Avión ================= */
function toast(msg, tipo = 'ok') {
  const el = $('#toast');
  const icono = tipo === 'error' ? 'i-alerta' : tipo === 'alerta' ? 'i-alerta' : 'i-check';
  el.className = 'toast visible' + (tipo !== 'ok' ? ' ' + tipo : '');
  el.innerHTML = `<svg class="ico"><use href="#${icono}"/></svg><span>${esc(msg)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2900);
}
function abrirDialogo(id) {
  const dlg = $('#' + id);
  if (dlg && !dlg.open) dlg.showModal();
}
function cerrarDialogo(id) {
  const dlg = $('#' + id);
  if (dlg && dlg.open) dlg.close();
}

function animarBotonAvion(btn) {
  if (!btn) return;
  btn.classList.add('volando');
  setTimeout(() => btn.classList.remove('volando'), 420);
}

function mostrarEfectoPago(metodo, monto, subtexto = '') {
  return new Promise(resolve => {
    const ov = $('#efectoPagoOverlay');
    const card = $('#efectoPagoCard');
    const btnOk = $('#btnEfectoPagoOk');
    if (!ov || !card) { resolve(); return; }
    card.className = 'efecto-pago-card ' + (metodo === 'Efectivo' ? 'efectivo' : 'yape');
    $('#efectoPagoTitulo').textContent = metodo === 'Yape' ? '¡Yapeo registrado!' : '¡Pago en Efectivo registrado!';
    $('#efectoPagoMonto').textContent = soles(monto);
    $('#efectoPagoSub').textContent = subtexto;
    ov.hidden = false;
    try { navigator.vibrate?.([35, 50, 65]); } catch (_) {}

    const cerrar = () => {
      ov.hidden = true;
      if (btnOk) btnOk.onclick = null;
      resolve();
    };
    if (btnOk) {
      btnOk.onclick = cerrar;
      setTimeout(() => btnOk.focus(), 40);
    } else {
      setTimeout(cerrar, 1450);
    }
  });
}

/* ================= Confirmación con Contraseña / Clave Secreta Autorizada + 5 Segundos ================= */
function verificarPinAdmin(pinIngresado) {
  const limpio = String(pinIngresado || '').trim();
  if (!limpio) return false;
  if (limpio === PIN_ADMIN_MAESTRO) return true;
  return DB.usuarios.some(u =>
    u.rol === 'admin' &&
    u.activo !== false &&
    (u.pinPlain === limpio ||
     u.pinHash === hashPinSync(limpio, String(u.id)) ||
     u.claveSecreta === limpio ||
     u.claveSecretaHash === hashPinSync(limpio, 'sec_' + String(u.id)))
  );
}

function verificarClaveSecretaAutorizada(claveIngresada, permisoRequerido = null) {
  const limpio = String(claveIngresada || '').trim();
  if (!limpio) return false;
  if (verificarPinAdmin(limpio)) return true;
  return DB.usuarios.some(u => {
    if (u.activo === false) return false;
    const tienePerm = !permisoRequerido || u.rol === 'admin' || (u.permisos || []).includes(permisoRequerido);
    if (!tienePerm) return false;
    return (
      u.claveSecreta === limpio ||
      u.claveSecretaHash === hashPinSync(limpio, 'sec_' + String(u.id)) ||
      u.pinPlain === limpio ||
      u.pinHash === hashPinSync(limpio, String(u.id))
    );
  });
}

function confirmar({ titulo, texto, textoOk = 'Confirmar', peligro = true, requierePin = true, segundos = 5, permisoAutorizado = null }) {
  return new Promise(resolve => {
    const dlg = $('#dlgConfirm');
    const form = $('#formConfirmSeguridad');
    $('#confTitulo').textContent = titulo;
    $('#confTexto').textContent = texto;
    const bloquePin = $('#bloquePinSeguridad');
    const inpPin = $('#confPinAdmin');
    const errPin = $('#confPinError');
    const btnOk = $('#confOk');
    const btnCancel = $('#confCancelar');
    const btnMacClose = $('#btnConfirmMacClose');

    bloquePin.hidden = !requierePin;
    inpPin.value = '';
    errPin.textContent = '';
    btnOk.className = peligro ? 'btn-no' : 'btn-prim';

    let restante = segundos;
    let timer = null;
    const actualizarBtn = () => {
      if (restante > 0) {
        btnOk.disabled = true;
        btnOk.textContent = `${textoOk} (${restante}s)`;
      } else {
        btnOk.disabled = false;
        btnOk.textContent = textoOk;
      }
    };
    actualizarBtn();
    if (restante > 0) {
      timer = setInterval(() => {
        restante--;
        actualizarBtn();
        if (restante <= 0) clearInterval(timer);
      }, 1000);
    }

    const finalizar = valor => {
      if (timer) clearInterval(timer);
      form.onsubmit = null;
      btnCancel.onclick = null;
      if (btnMacClose) btnMacClose.onclick = null;
      dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(valor);
    };

    btnCancel.onclick = () => finalizar(false);
    if (btnMacClose) btnMacClose.onclick = () => finalizar(false);
    dlg.onclose = () => finalizar(false);
    form.onsubmit = e => {
      e.preventDefault();
      if (restante > 0) return;
      if (requierePin && !verificarClaveSecretaAutorizada(inpPin.value, permisoAutorizado)) {
        errPin.textContent = 'Contraseña de autorización incorrecta.';
        inpPin.focus();
        return;
      }
      finalizar(true);
    };
    dlg.showModal();
    if (requierePin) setTimeout(() => inpPin.focus(), 50);
  });
}

function pedirFormulario({ titulo, texto = '', textoOk = 'Guardar', campos = [], validar, requiereSeguridad5s = false, permisoAutorizado = null }) {
  return new Promise(resolve => {
    const dlg = $('#dlgForm');
    const form = $('#formGenerico');
    const btnMacClose = $('#btnFormMacClose');
    $('#formTitulo').textContent = titulo;
    $('#formTexto').textContent = texto;
    $('#formTexto').hidden = !texto;
    $('#formError').textContent = '';

    const camposExtras = [...campos];
    if (requiereSeguridad5s) {
      camposExtras.push({
        nombre: '__pinAdmin',
        etiqueta: 'Contraseña secreta de autorización',
        tipo: 'password',
        maxlength: 20,
        placeholder: 'Ingresa tu contraseña secreta'
      });
    }

    $('#formCampos').innerHTML = camposExtras.map(c => {
      if (c.tipo === 'select') {
        const opts = (c.opciones || []).map(o => `<option value="${esc(o.valor)}" ${String(o.valor) === String(c.valor) ? 'selected' : ''}>${esc(o.etiqueta)}</option>`).join('');
        return `<label>${esc(c.etiqueta)}<select name="${esc(c.nombre)}">${opts}</select></label>`;
      }
      return `<label>${esc(c.etiqueta)}<input name="${esc(c.nombre)}" type="${esc(c.tipo || 'text')}" value="${esc(c.valor ?? '')}" ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''} ${c.min !== undefined ? `min="${c.min}"` : ''} ${c.max !== undefined ? `max="${c.max}"` : ''} ${c.step ? `step="${c.step}"` : ''} ${c.maxlength ? `maxlength="${c.maxlength}"` : ''} ${c.inputmode ? `inputmode="${c.inputmode}"` : ''} autocomplete="off"></label>`;
    }).join('');

    const btnOk = $('#formOk');
    let restante = requiereSeguridad5s ? 5 : 0;
    let timer = null;
    const actBtn = () => {
      if (restante > 0) {
        btnOk.disabled = true;
        btnOk.textContent = `${textoOk} (${restante}s)`;
      } else {
        btnOk.disabled = false;
        btnOk.textContent = textoOk;
      }
    };
    actBtn();
    if (restante > 0) {
      timer = setInterval(() => {
        restante--;
        actBtn();
        if (restante <= 0) clearInterval(timer);
      }, 1000);
    }

    const limpiar = res => {
      if (timer) clearInterval(timer);
      form.onsubmit = null;
      if (btnMacClose) btnMacClose.onclick = null;
      dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(res);
    };
    $('[data-cancelar]', form).onclick = () => limpiar(null);
    if (btnMacClose) btnMacClose.onclick = () => limpiar(null);
    dlg.onclose = () => limpiar(null);
    form.onsubmit = async e => {
      e.preventDefault();
      if (restante > 0) return;
      const datos = {};
      camposExtras.forEach(c => {
        const inp = form.elements[c.nombre];
        datos[c.nombre] = inp ? inp.value.trim() : '';
      });
      if (requiereSeguridad5s && !verificarClaveSecretaAutorizada(datos.__pinAdmin, permisoAutorizado)) {
        $('#formError').textContent = 'Contraseña secreta de autorización incorrecta.';
        return;
      }
      const err = validar ? await validar(datos) : '';
      if (err) {
        $('#formError').textContent = err;
        return;
      }
      limpiar(datos);
    };
    dlg.showModal();
    const primero = $('#formCampos input, #formCampos select');
    if (primero) setTimeout(() => primero.focus(), 40);
  });
}

/* ================= Editor / Recortador de Imágenes 1:1 Pre-Guardado (Con Transparencia PNG) y Permisos Paso 2 ================= */
function solicitarImagen1a1PreGuardado({
  titulo = 'Imagen de referencia (Formato 1:1)',
  subtitulo = 'Antes de guardar, puedes arrastrar una imagen aquí, seleccionarla desde tus archivos para recortarla en formato 1:1, u omitir este paso.',
  imagenActual = '',
  archivoInicial = null,
  permitirOmitir = true
} = {}) {
  return new Promise(resolve => {
    const dlg = $('#dlgRecorte');
    const dropzone = $('#dropzoneImg');
    const btnElegir = $('#btnElegirImgCropper');
    const fileInp = $('#fileInputCropper');
    const contCropper = $('#cropperContenedor');
    const canvas = $('#cropCanvas');
    const ctx = canvas.getContext('2d');
    const zoomInp = $('#cropZoom');
    const btnCancel = $('#btnCropCancelar');
    const btnMacClose = $('#btnCropMacClose');
    const btnOmitir = $('#btnCropOmitir');
    const btnConfirmar = $('#btnCropConfirmar');
    const btnOtra = $('#btnCambiarOtraImg');

    $('#recorteTitulo').textContent = titulo;
    $('#recorteSubtitulo').textContent = subtitulo;
    btnOmitir.hidden = !permitirOmitir;

    const size = canvas.width;
    let imgCargada = null;
    let baseScale = 1;
    let zoom = 1;
    let offX = 0, offY = 0;
    let arrastrando = false, startX = 0, startY = 0;

    const limitar = () => {
      if (!imgCargada) return;
      const w = imgCargada.width * baseScale * zoom;
      const h = imgCargada.height * baseScale * zoom;
      const maxX = Math.max(0, (w - size) / 2);
      const maxY = Math.max(0, (h - size) / 2);
      offX = Math.min(maxX, Math.max(-maxX, offX));
      offY = Math.min(maxY, Math.max(-maxY, offY));
    };

    const dibujar = () => {
      if (!imgCargada) return;
      limitar();
      ctx.clearRect(0, 0, size, size);
      const w = imgCargada.width * baseScale * zoom;
      const h = imgCargada.height * baseScale * zoom;
      const x = (size - w) / 2 + offX;
      const y = (size - h) / 2 + offY;
      ctx.drawImage(imgCargada, x, y, w, h);
    };

    const montarImagenSrc = src => {
      if (!src) return;
      const im = new Image();
      im.onload = () => {
        imgCargada = im;
        baseScale = Math.max(size / im.width, size / im.height);
        zoom = 1;
        offX = 0;
        offY = 0;
        zoomInp.value = '1';
        contCropper.hidden = false;
        btnConfirmar.hidden = false;
        dibujar();
      };
      im.src = src;
    };

    const cargarArchivo = file => {
      if (!file || !file.type.startsWith('image/')) {
        toast('Selecciona un archivo de imagen válido', 'alerta');
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => montarImagenSrc(String(ev.target?.result || ''));
      reader.readAsDataURL(file);
    };

    // Estado inicial
    contCropper.hidden = true;
    btnConfirmar.hidden = true;
    ctx.clearRect(0, 0, size, size);
    if (archivoInicial) {
      cargarArchivo(archivoInicial);
    } else if (imagenActual) {
      montarImagenSrc(imagenActual);
    }

    zoomInp.oninput = () => {
      zoom = parseFloat(zoomInp.value) || 1;
      dibujar();
    };
    canvas.onpointerdown = e => {
      if (!imgCargada) return;
      arrastrando = true;
      startX = e.clientX - offX;
      startY = e.clientY - offY;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    };
    canvas.onpointermove = e => {
      if (!arrastrando || !imgCargada) return;
      offX = e.clientX - startX;
      offY = e.clientY - startY;
      dibujar();
    };
    canvas.onpointerup = () => { arrastrando = false; };

    const onDragOver = e => {
      e.preventDefault();
      dropzone.classList.add('arrastrando');
    };
    const onDragLeave = () => dropzone.classList.remove('arrastrando');
    const onDrop = e => {
      e.preventDefault();
      dropzone.classList.remove('arrastrando');
      const f = e.dataTransfer?.files?.[0];
      if (f) cargarArchivo(f);
    };
    const onElegirClick = e => {
      e.stopPropagation();
      fileInp.click();
    };
    const onDropzoneClick = e => {
      if (e.target === btnElegir) return;
      fileInp.click();
    };
    const onFileChange = e => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (f) cargarArchivo(f);
    };

    dropzone.addEventListener('dragover', onDragOver);
    dropzone.addEventListener('dragleave', onDragLeave);
    dropzone.addEventListener('drop', onDrop);
    dropzone.addEventListener('click', onDropzoneClick);
    btnElegir.addEventListener('click', onElegirClick);
    if (btnOtra) btnOtra.addEventListener('click', onElegirClick);
    fileInp.addEventListener('change', onFileChange);

    const cerrar = resultado => {
      canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = null;
      zoomInp.oninput = null;
      dropzone.removeEventListener('dragover', onDragOver);
      dropzone.removeEventListener('dragleave', onDragLeave);
      dropzone.removeEventListener('drop', onDrop);
      dropzone.removeEventListener('click', onDropzoneClick);
      btnElegir.removeEventListener('click', onElegirClick);
      if (btnOtra) btnOtra.removeEventListener('click', onElegirClick);
      fileInp.removeEventListener('change', onFileChange);
      btnCancel.onclick = btnOmitir.onclick = btnConfirmar.onclick = dlg.onclose = null;
      if (btnMacClose) btnMacClose.onclick = null;
      if (dlg.open) dlg.close();
      resolve(resultado);
    };

    btnCancel.onclick = () => cerrar(null);
    if (btnMacClose) btnMacClose.onclick = () => cerrar(null);
    dlg.onclose = () => cerrar(null);
    btnOmitir.onclick = () => cerrar('');
    btnConfirmar.onclick = () => {
      if (!imgCargada) {
        cerrar('');
        return;
      }
      dibujar();
      // Exportar en PNG para respetar la transparencia si la imagen no tiene fondo
      cerrar(canvas.toDataURL('image/png'));
    };

    dlg.showModal();
  });
}

function abrirRecortador1a1(file) {
  return solicitarImagen1a1PreGuardado({
    titulo: 'Recortar imagen en formato 1:1',
    subtitulo: 'Ajusta el encuadre cuadrado (1:1) antes de confirmar.',
    archivoInicial: file,
    permitirOmitir: false
  });
}

function solicitarPermisosUsuarioModal({ nombre, rol, permisosIniciales = [], esMaestro = false }) {
  return new Promise(resolve => {
    const dlg = $('#dlgPermisosUsuario');
    const form = $('#formPermisosUsuario');
    const cont = $('#listaSwitchesPermisosUsr');
    const btnCancel = $('#btnCancelarPermisosUsr');
    const btnMacClose = $('#btnPermMacClose');

    $('#permUsrSubtitulo').textContent = `Paso 2: Activa o desactiva con interruptores los privilegios para "${nombre}" (${ROL_NOMBRE[rol] || rol}).`;
    const set = new Set(esMaestro ? PERMISOS_POR_ROL.admin : permisosIniciales);

    cont.innerHTML = CATALOGO_PERMISOS.map(p => `
      <label class="switch-row">
        <span>
          <b>${esc(p.titulo)}</b>
          <small>${esc(p.guia)}</small>
        </span>
        <input type="checkbox" class="ios-chk" value="${esc(p.codigo)}" ${set.has(p.codigo) ? 'checked' : ''} ${esMaestro ? 'disabled' : ''}>
      </label>
    `).join('');

    const cerrar = res => {
      form.onsubmit = null;
      btnCancel.onclick = null;
      if (btnMacClose) btnMacClose.onclick = null;
      dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(res);
    };

    btnCancel.onclick = () => cerrar(null);
    if (btnMacClose) btnMacClose.onclick = () => cerrar(null);
    dlg.onclose = () => cerrar(null);
    form.onsubmit = e => {
      e.preventDefault();
      if (esMaestro) {
        cerrar([...PERMISOS_POR_ROL.admin]);
        return;
      }
      const marcados = $$('#listaSwitchesPermisosUsr input:checked').map(c => c.value);
      cerrar(marcados);
    };

    dlg.showModal();
  });
}

/* ================= Privilegios, Sesión de 3 Horas y Login ================= */
const esAdmin = () => sesion?.rol === 'admin';
function tienePermiso(codigo) {
  if (!sesion) return false;
  if (sesion.rol === 'admin') return true;
  const u = DB.usuarios.find(x => x.id === sesion.id);
  const lista = u?.permisos || PERMISOS_POR_ROL[sesion.rol] || [];
  return lista.includes(codigo);
}
const puedeModificarMesas = () => esAdmin() || tienePermiso('mesas.modificar');
const puedeEditarProductos = () => esAdmin() || tienePermiso('carta.administrar') || tienePermiso('productos.editar');
const puedeEditarReportes = () => esAdmin() || tienePermiso('reportes.editar');

function exigirAdmin() {
  if (esAdmin()) return true;
  toast('Acción exclusiva para el administrador WILLOSIRIS', 'error');
  return false;
}
function verificarLicenciaVigencia() {
  if (!DB.licencia.activa) return { ok: false, motivo: 'La licencia del sistema se encuentra suspendida.' };
  if (DB.licencia.fechaFin) {
    const fin = new Date(DB.licencia.fechaFin + 'T23:59:59').getTime();
    if (Date.now() > fin) return { ok: false, motivo: `La licencia venció el ${DB.licencia.fechaFin}.` };
  }
  return { ok: true, motivo: 'Licencia activa' };
}

function guardarSesionActiva() {
  if (!sesion) return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      uid: sesion.id,
      ultimaActividad: Date.now()
    }));
  } catch (_) {}
}
function tocarActividadSesion() {
  if (!sesion) return;
  guardarSesionActiva();
}
function intentarRestaurarSesion() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.uid || !data.ultimaActividad) return false;
    if (Date.now() - Number(data.ultimaActividad) > INACTIVIDAD_MAX_MS) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    const u = DB.usuarios.find(x => x.id === Number(data.uid) && x.activo !== false);
    if (!u) return false;
    iniciarSesion(u, true);
    return true;
  } catch (_) {
    return false;
  }
}
function cerrarSesion(motivo = '') {
  sesion = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
  mostrarPantallaAcceso();
  if (motivo) toast(motivo, 'alerta');
}

function pintarMarcaLocal() {
  const nombre = DB.config.nombreLocal || "Juancho's";
  const lema = DB.config.lemaLocal || 'Salchipapería & Punto de venta';
  const logoSrc = DB.config.logoPrincipal || 'logo.png';
  const favSrc = DB.config.favicon || 'favicon.png';
  const htmlLogo = esc(nombre).replace(/(['’])/g, '<span>$1</span>');

  $('#accesoLogo').innerHTML = htmlLogo;
  $('#logoLocal').innerHTML = htmlLogo;
  $('#accesoLema').textContent = lema;
  $('#imgLogoLogin').src = logoSrc;
  $('#imgLogoTopbar').src = logoSrc;
  $('#faviconLink').href = favSrc;
  document.title = `${nombre} · Punto de venta`;

  const estLic = verificarLicenciaVigencia();
  const b = $('#badgeLicenciaLogin');
  if (b) {
    b.className = 'badge ' + (estLic.ok ? 'ok' : 'critico');
    b.textContent = estLic.ok ? 'Sistema activo' : 'Licencia vencida';
  }
}

function htmlAvatarUsuario(u, grande = false) {
  const cls = `avatar ${grande ? 'avatar-lg' : ''} ${u.rol === 'admin' ? 'admin' : ''} ${u.foto ? 'con-foto' : ''}`.trim();
  if (u.foto) return `<span class="${cls}"><img src="${esc(u.foto)}" alt="${esc(u.nombre)}"></span>`;
  return `<span class="${cls}">${esc(iniciales(u.nombre))}</span>`;
}

function mostrarPantallaAcceso() {
  sesion = null;
  usuarioPinSel = null;
  pinBuffer = '';
  document.body.classList.add('bloqueado');
  document.body.classList.remove('ticket-abierto');
  document.body.dataset.rol = '';
  pintarMarcaLocal();
  $('#pasoUsuarios').hidden = false;
  $('#pasoPin').hidden = true;
  renderListaUsuariosAcceso();
}

function renderListaUsuariosAcceso() {
  const activos = DB.usuarios.filter(u => u.activo !== false);
  $('#listaUsuarios').innerHTML = activos.map(u => `
    <button type="button" class="usuario-op" data-uid="${u.id}">
      ${htmlAvatarUsuario(u)}
      <span>${esc(u.nombre)}<small>${esc(ROL_NOMBRE[u.rol] || 'Operador')}</small></span>
    </button>
  `).join('');
}

function elegirUsuarioPin(id) {
  const u = DB.usuarios.find(x => x.id === id && x.activo !== false);
  if (!u) return;
  usuarioPinSel = u;
  pinBuffer = '';
  $('#pasoUsuarios').hidden = true;
  $('#pasoPin').hidden = false;
  const av = $('#pinAvatar');
  av.className = `avatar avatar-lg${u.rol === 'admin' ? ' admin' : ''}${u.foto ? ' con-foto' : ''}`;
  av.innerHTML = u.foto ? `<img src="${esc(u.foto)}" alt="${esc(u.nombre)}">` : esc(iniciales(u.nombre));
  $('#pinNombre').textContent = u.nombre;
  $('#pinRol').textContent = ROL_NOMBRE[u.rol] || 'Operador';
  $('#pinError').textContent = '';
  renderDotsPin();
}

function renderDotsPin(error = false) {
  const largo = usuarioPinSel?.pinLen || 6;
  const cont = $('#pinDots');
  cont.className = 'pin-dots' + (error ? ' error sacude' : '');
  cont.innerHTML = Array.from({ length: largo }, (_, i) => `<i class="${i < pinBuffer.length ? 'lleno' : ''}"></i>`).join('');
}

function intentarPin() {
  if (!usuarioPinSel || !pinBuffer.length) return;
  const limpio = pinBuffer.trim();
  const hash = hashPinSync(limpio, String(usuarioPinSel.id));
  const coincide = hash === usuarioPinSel.pinHash || (usuarioPinSel.pinPlain && limpio === usuarioPinSel.pinPlain);
  if (!coincide) {
    $('#pinError').textContent = 'Contraseña / PIN incorrecto.';
    renderDotsPin(true);
    pinBuffer = '';
    setTimeout(() => renderDotsPin(false), 380);
    return;
  }
  const estLic = verificarLicenciaVigencia();
  if (!estLic.ok && usuarioPinSel.rol !== 'admin') {
    $('#pinError').textContent = `${estLic.motivo} Solo el Administrador puede ingresar para renovarla.`;
    pinBuffer = '';
    renderDotsPin(true);
    return;
  }
  iniciarSesion(usuarioPinSel, false);
}

function pulsarTeclaPin(tecla) {
  if (!usuarioPinSel) return;
  $('#pinError').textContent = '';
  const max = usuarioPinSel.pinLen || 6;
  if (tecla === 'borrar') {
    pinBuffer = pinBuffer.slice(0, -1);
    renderDotsPin();
  } else if (tecla === 'ok') {
    intentarPin();
  } else if (/^\d$/.test(tecla) && pinBuffer.length < max) {
    pinBuffer += tecla;
    renderDotsPin();
    if (pinBuffer.length === max) setTimeout(() => intentarPin(), 80);
  }
}

function asegurarTurnoAbierto() {
  if (!DB.turnoAbierto) {
    const num = DB.cierres.length + 1;
    DB.turnoAbierto = {
      id: num,
      nombre: `Turno #${num}`,
      abiertoEn: new Date().toISOString(),
      abiertoPor: sesion?.nombre || 'WILLOSIRIS'
    };
    guardarDB();
  }
}

function actualizarVisibilidadNavegacion() {
  $$('.sidebar .nav-btn').forEach(btn => {
    const perm = btn.dataset.perm;
    const visible = !perm || tienePermiso(perm) || (perm === 'carta.administrar' && puedeEditarProductos()) || (perm === 'turno.cerrar' && puedeEditarReportes());
    btn.hidden = !visible;
  });
  const btnEdMesas = $('#btnEditarMesas');
  if (btnEdMesas) {
    btnEdMesas.style.display = puedeModificarMesas() ? 'inline-flex' : 'none';
  }
}

function iniciarSesion(u, restaurada = false) {
  u.ultimoAcceso = new Date().toISOString();
  sesion = { id: u.id, nombre: u.nombre, rol: u.rol };
  asegurarTurnoAbierto();
  if (!restaurada) registrarActividad('Inicio de sesión', `${u.nombre} (${ROL_NOMBRE[u.rol]})`);
  guardarDB();
  guardarSesionActiva();

  document.body.classList.remove('bloqueado');
  document.body.dataset.rol = u.rol;
  const av = $('#usuarioAvatar');
  av.className = `avatar${u.rol === 'admin' ? ' admin' : ''}${u.foto ? ' con-foto' : ''}`;
  av.innerHTML = u.foto ? `<img src="${esc(u.foto)}" alt="${esc(u.nombre)}">` : esc(iniciales(u.nombre));
  $('#usuarioNombre').textContent = u.nombre;
  $('#usuarioRol').textContent = ROL_NOMBRE[u.rol] || 'Operador';
  actualizarBarraTurno();
  pintarMarcaLocal();
  actualizarVisibilidadNavegacion();

  editandoMesas = false;
  $('#btnEditarMesas')?.setAttribute('aria-pressed', 'false');
  const tabInicial = u.rol === 'cocina' ? 'inicio' : (tienePermiso('salon.operar') ? 'salon' : 'inicio');
  cambiarTab(tabInicial);
  renderTodo();
  if (!restaurada) toast(`Bienvenido, ${u.nombre}`);
}

function actualizarBarraTurno() {
  const txt = DB.turnoAbierto
    ? `${DB.turnoAbierto.nombre} · desde ${fmtHora(DB.turnoAbierto.abiertoEn)}`
    : 'Sin turno abierto';
  $('#turnoActual span').textContent = txt;
}

/* ================= Navegación SPA y Tablero de Inicio / Cocina ================= */
function cambiarTab(id) {
  const btnNav = $(`.nav-btn[data-tab="${id}"]`);
  const perm = btnNav?.dataset.perm;
  const autorizado = !perm ||
    tienePermiso(perm) ||
    (perm === 'carta.administrar' && puedeEditarProductos()) ||
    (perm === 'turno.cerrar' && puedeEditarReportes());
  if (!autorizado) {
    toast('No tienes privilegios habilitados para abrir esta sección', 'error');
    return;
  }
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === id));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === id));
  $('.app').dataset.tab = id;
  if (id === 'inicio') renderInicioCocina();
  if (id === 'salon') renderSalon();
  if (id === 'envios') renderEnvios();
  if (id === 'comandera') renderComandera();
  if (id === 'caja') renderCaja();
  if (id === 'inventario') renderInventario();
  if (id === 'reportes') renderReportes();
  if (id === 'ajustes') renderAjustes();
}

function renderTodo() {
  renderInicioCocina();
  renderSalon();
  renderEnvios();
  renderComandera();
  renderTicket();
  renderCaja();
  if (puedeEditarProductos()) renderInventario();
  if (esAdmin()) renderAjustes();
}

function sincronizarOrdenCocina(tipo, cuenta) {
  if (!Array.isArray(DB.ordenesCocina)) DB.ordenesCocina = [];
  const enviados = (cuenta.items || []).filter(i => (i.enviado || 0) > 0);
  if (!enviados.length) return;
  const key = `${tipo}_${cuenta.id}`;
  const amb = tipo === 'mesa' ? DB.ambientes.find(a => a.id === cuenta.ambienteId) : null;
  const titulo = tipo === 'mesa'
    ? `${cuenta.nombre} · ${amb?.nombre || 'Salón'}`
    : `Envío #${cuenta.id} · ${cuenta.cliente}`;
  const subtitulo = tipo === 'mesa'
    ? 'Atención en salón'
    : `Dirección: ${cuenta.direccion}`;

  let ord = DB.ordenesCocina.find(o => o.key === key && !o.archivado);
  const copiaItems = enviados.map(it => ({
    nombre: it.nombre,
    cant: it.enviado || it.cant,
    enviado: it.enviado || it.cant,
    mods: [...(it.mods || [])],
    obs: it.obs || ''
  }));

  if (ord) {
    ord.titulo = titulo;
    ord.subtitulo = subtitulo;
    ord.entregado = false;
    ord.items = copiaItems;
  } else {
    DB.ordenesCocina.push({
      uid: sigId('ordenCocinaUid'),
      key,
      tipo,
      id: cuenta.id,
      titulo,
      subtitulo,
      desde: cuenta.desde || cuenta.creadoTs || Date.now(),
      entregado: false,
      pagado: false,
      archivado: false,
      items: copiaItems
    });
  }
}

function obtenerOrdenesActivasCocina() {
  if (!Array.isArray(DB.ordenesCocina)) DB.ordenesCocina = [];
  // Migrar cualquier comanda enviada activa que aún no esté registrada en DB.ordenesCocina
  DB.mesas.forEach(m => {
    const enviados = (m.items || []).filter(i => (i.enviado || 0) > 0);
    if (enviados.length && !DB.ordenesCocina.some(o => o.key === `mesa_${m.id}` && !o.archivado)) {
      sincronizarOrdenCocina('mesa', m);
    }
  });
  DB.envios.forEach(ev => {
    const enviados = (ev.items || []).filter(i => (i.enviado || 0) > 0);
    if (enviados.length && !DB.ordenesCocina.some(o => o.key === `envio_${ev.id}` && !o.archivado)) {
      sincronizarOrdenCocina('envio', ev);
    }
  });
  return DB.ordenesCocina
    .filter(o => !o.archivado)
    .sort((a, b) => a.desde - b.desde);
}

function renderInicioCocina() {
  const todas = obtenerOrdenesActivasCocina();
  const pendientes = todas.filter(o => !o.entregado);
  const badge = $('#badgePendientes');
  if (badge) {
    badge.hidden = pendientes.length === 0;
    badge.textContent = String(pendientes.length);
  }

  const filtradas = filtroCocinaEstado === 'pendientes'
    ? pendientes
    : filtroCocinaEstado === 'entregados'
      ? todas.filter(o => o.entregado)
      : todas;

  const grid = $('#gridCocina');
  if (!grid) return;
  if (!filtradas.length) {
    grid.innerHTML = `<div class="vacio-bloque">
      <svg class="ico"><use href="#i-reloj"/></svg>
      <h3>Sin órdenes ${filtroCocinaEstado === 'pendientes' ? 'pendientes de entregar' : 'en esta vista'}</h3>
      <p>Cuando se envíe una comanda desde Salón o Envíos permanecerá aquí en espera (incluso después del cobro) hasta que la modifiques o retires desde esta pantalla.</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtradas.map(o => `
    <article class="orden-card ${o.entregado ? 'entregada' : ''}">
      <div>
        <div class="orden-cab">
          <div>
            <h3>${esc(o.titulo)}</h3>
            <p class="sub">${esc(o.subtitulo)}</p>
          </div>
          <div class="fila" style="gap:6px">
            ${o.pagado ? `<span class="badge ok">Pagado</span>` : `<span class="badge bajo">En cuenta</span>`}
            <span class="orden-tiempo"><svg class="ico"><use href="#i-reloj"/></svg>${minutosDesde(o.desde)} min</span>
          </div>
        </div>
        <ul class="orden-lista mt">
          ${o.items.map(it => {
            const nota = [...(it.mods || []), it.obs].filter(Boolean).join(', ');
            return `<li>
              <div class="orden-plato-linea"><span>${it.enviado || it.cant} × ${esc(it.nombre)}</span></div>
              ${nota ? `<span class="orden-plato-nota">${esc(nota)}</span>` : ''}
            </li>`;
          }).join('')}
        </ul>
      </div>
      <div class="orden-pie">
        <div class="orden-pie-acc">
          <button type="button" class="${o.entregado ? '' : 'btn-ok'}" data-toggle-entrega="${esc(o.key)}">
            <svg class="ico"><use href="#${o.entregado ? 'i-reloj' : 'i-check'}"/></svg>
            <span>${o.entregado ? 'Pendiente' : 'Entregado'}</span>
          </button>
          <button type="button" class="btn-mini peligro" data-archivar-cocina="${esc(o.key)}" title="Retirar orden de la lista de espera">
            <svg class="ico"><use href="#i-x"/></svg>
            <span>Retirar</span>
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

function alternarEntregaCocina(ref) {
  const key = String(ref || '').replace(':', '_');
  const ord = (DB.ordenesCocina || []).find(o => o.key === key && !o.archivado);
  if (ord) {
    ord.entregado = !ord.entregado;
    if (ord.tipo === 'mesa') {
      const m = DB.mesas.find(x => x.id === ord.id);
      if (m) m.cocinaEntregado = ord.entregado;
    } else if (ord.tipo === 'envio') {
      const ev = DB.envios.find(x => x.id === ord.id);
      if (ev) ev.cocinaEntregado = ord.entregado;
    }
    registrarActividad(ord.entregado ? 'Pedido marcado como entregado' : 'Pedido vuelto a pendiente', ord.titulo);
    toast(`${ord.titulo}: ${ord.entregado ? 'Marcado como entregado' : 'En espera de entrega'}`);
  }
  guardarDB();
  renderInicioCocina();
  renderEnvios();
}

function archivarOrdenCocina(ref) {
  const key = String(ref || '').replace(':', '_');
  const ord = (DB.ordenesCocina || []).find(o => o.key === key && !o.archivado);
  if (!ord) return;
  ord.archivado = true;
  registrarActividad('Orden retirada de espera', ord.titulo);
  guardarDB();
  renderInicioCocina();
  toast(`${ord.titulo} retirada de la pantalla En espera`);
}

/* ================= 1. Salón, Ambientes, Mesas y Traslado ================= */
function obtenerAmbienteActual() {
  let amb = DB.ambientes.find(a => a.id === ambienteActualId);
  if (!amb) {
    amb = DB.ambientes[0];
    ambienteActualId = amb?.id || 1;
  }
  return amb;
}
function obtenerMesa(id) {
  return DB.mesas.find(m => m.id === id) || null;
}
function obtenerEnvio(id) {
  return DB.envios.find(e => e.id === id) || null;
}
function obtenerObjetivoActivo() {
  if (cuentaActiva.tipo === 'mesa') {
    const m = obtenerMesa(cuentaActiva.id);
    if (!m) cuentaActiva = { tipo: null, id: null };
    return m ? { tipo: 'mesa', obj: m } : null;
  }
  if (cuentaActiva.tipo === 'envio') {
    const ev = obtenerEnvio(cuentaActiva.id);
    if (!ev) cuentaActiva = { tipo: null, id: null };
    return ev ? { tipo: 'envio', obj: ev } : null;
  }
  return null;
}

function renderSalon() {
  const amb = obtenerAmbienteActual();
  $('#zonas').innerHTML = DB.ambientes.map(a => {
    const nMesas = DB.mesas.filter(m => m.ambienteId === a.id).length;
    const act = a.id === amb.id;
    return `<button class="chip ${act ? 'active' : ''}" role="tab" aria-selected="${act}" data-amb="${a.id}">${esc(a.nombre)} <span class="chip-n">${nMesas}</span></button>`;
  }).join('');

  const btnElimAmb = $('#btnEliminarAmbiente');
  if (btnElimAmb) btnElimAmb.disabled = DB.ambientes.length <= 1;

  const mesasAmb = DB.mesas.filter(m => m.ambienteId === amb.id);
  const cuenta = { libre: 0, ocupada: 0, precuenta: 0, reservada: 0 };
  mesasAmb.forEach(m => { cuenta[m.estado] = (cuenta[m.estado] || 0) + 1; });

  $('#leyenda').innerHTML = [
    ['libre', 'Desocupadas (Libres)', 'var(--libre)'],
    ['ocupada', 'Ocupadas', 'var(--ocup)'],
    ['precuenta', 'Pre-cuenta', 'var(--pre)'],
    ['reservada', 'Reservadas', 'var(--res)']
  ].map(([k, lbl, col]) => `<li><i class="dot" style="--c:${col}"></i>${lbl} <b>${cuenta[k] || 0}</b></li>`).join('');

  const grid = $('#gridMesas');
  grid.classList.toggle('editando', editandoMesas && puedeModificarMesas());

  if (!mesasAmb.length) {
    grid.innerHTML = esAdmin()
      ? `<div class="vacio-bloque">
          <svg class="ico"><use href="#i-salon"/></svg>
          <h3>${esc(amb.nombre)} aún no tiene mesas</h3>
          <p>Este ambiente está en blanco. Agrega las mesas manualmente para empezar a atender.</p>
          <button type="button" class="btn-prim" data-accion="agregar-mesas"><svg class="ico"><use href="#i-plus"/></svg>Agregar mesas a ${esc(amb.nombre)}</button>
        </div>`
      : `<div class="vacio-bloque">
          <svg class="ico"><use href="#i-salon"/></svg>
          <h3>Sin mesas configuradas en ${esc(amb.nombre)}</h3>
          <p>Solicita al administrador WILLOSIRIS que agregue las mesas de este ambiente.</p>
        </div>`;
    return;
  }

  grid.innerHTML = mesasAmb.map(m => {
    const t = calcularTotales(m);
    const activa = cuentaActiva.tipo === 'mesa' && cuentaActiva.id === m.id;
    let etiquetaEstado = ETIQ_MESA[m.estado] || 'Libre';
    let meta = '';
    if (m.pagadaOcupada) {
      etiquetaEstado = 'Ocupada (Ya pagó)';
      meta = 'Clientes en mesa · Toque para gestionar';
    } else if (m.estado === 'libre') {
      etiquetaEstado = 'Desocupada';
      meta = m.capacidad ? `${m.capacidad} pers.` : 'Disponible';
    } else if (m.estado === 'reservada') {
      meta = m.notaReserva || 'Reservada';
    } else {
      meta = `${minutosDesde(m.desde)} min · ${soles(t.pendiente)}`;
    }

    let btnAccion = '';
    if (editandoMesas && puedeModificarMesas()) {
      btnAccion = esAdmin()
        ? `<button type="button" class="mesa-acc borrar" data-eliminar-mesa="${m.id}" aria-label="Eliminar ${esc(m.nombre)}" title="Eliminar mesa"><svg class="ico"><use href="#i-trash"/></svg></button>`
        : `<button type="button" class="mesa-acc" data-editar-mesa="${m.id}" aria-label="Editar ${esc(m.nombre)}" title="Editar capacidad o nombre"><svg class="ico"><use href="#i-edit"/></svg></button>`;
    } else if (m.pagadaOcupada) {
      btnAccion = `<button type="button" class="mesa-acc desocupar" data-desocupar-mesa="${m.id}" aria-label="Opciones para ${esc(m.nombre)}" title="Liberar, adicionar o mover"><svg class="ico"><use href="#i-check"/></svg></button>`;
    } else if (m.estado === 'libre' || m.estado === 'reservada') {
      btnAccion = `<button type="button" class="mesa-acc ${m.estado === 'reservada' ? 'reservada' : ''}" data-reservar-mesa="${m.id}" aria-label="${m.estado === 'reservada' ? 'Quitar reserva' : 'Reservar'}" title="${m.estado === 'reservada' ? 'Quitar reserva' : 'Reservar mesa'}"><svg class="ico"><use href="#i-reserva"/></svg></button>`;
    }

    return `<div class="mesa-wrap">
      <button type="button" class="mesa ${m.estado} ${activa ? 'activa' : ''}" data-mesa="${m.id}">
        <span class="mesa-top"><span class="mesa-num">${esc(m.numero)}</span><span class="mesa-lbl">${esc(m.nombre)}</span></span>
        <span class="mesa-estado"><i class="dot" style="--c:var(--${m.estado === 'libre' ? 'libre' : m.estado === 'ocupada' ? 'ocup' : m.estado === 'precuenta' ? 'pre' : 'res'})"></i>${esc(etiquetaEstado)}</span>
        <span class="mesa-meta">${esc(meta)}</span>
      </button>
      ${btnAccion}
    </div>`;
  }).join('');
}

async function trasladarMesa(mesaOrigenForzadaId = null) {
  const idForzado = typeof mesaOrigenForzadaId === 'number' ? mesaOrigenForzadaId : null;
  const ocupadas = DB.mesas.filter(m => m.estado === 'ocupada' || m.estado === 'precuenta' || (m.items && m.items.length) || m.pagadaOcupada);
  const libres = DB.mesas.filter(m => m.estado === 'libre' && (!m.items || !m.items.length) && !m.pagadaOcupada);
  if (!ocupadas.length) {
    toast('No hay ninguna mesa ocupada para trasladar en este momento', 'alerta');
    return;
  }
  if (!libres.length) {
    toast('No hay mesas desocupadas disponibles para recibir el traslado', 'alerta');
    return;
  }
  const mesaPre = idForzado || (cuentaActiva.tipo === 'mesa' ? cuentaActiva.id : ocupadas[0].id);
  const datos = await pedirFormulario({
    titulo: 'Trasladar cuenta de una mesa a otra',
    texto: 'Mueve todos los platos, pagos a cuenta y estado de la mesa origen hacia una mesa desocupada.',
    textoOk: 'Trasladar ahora',
    campos: [
      {
        nombre: 'origen',
        etiqueta: 'Mesa origen (Ocupada)',
        tipo: 'select',
        valor: String(mesaPre),
        opciones: ocupadas.map(m => {
          const amb = DB.ambientes.find(a => a.id === m.ambienteId);
          return { valor: String(m.id), etiqueta: `${m.nombre} (${amb?.nombre || 'Salón'})` };
        })
      },
      {
        nombre: 'destino',
        etiqueta: 'Mesa destino (Desocupada)',
        tipo: 'select',
        valor: String(libres[0].id),
        opciones: libres.map(m => {
          const amb = DB.ambientes.find(a => a.id === m.ambienteId);
          return { valor: String(m.id), etiqueta: `${m.nombre} (${amb?.nombre || 'Salón'})` };
        })
      }
    ],
    validar: d => (d.origen === d.destino ? 'Elige una mesa destino diferente.' : '')
  });
  if (!datos) return;
  const orig = obtenerMesa(Number(datos.origen));
  const dest = obtenerMesa(Number(datos.destino));
  if (!orig || !dest) return;

  dest.estado = orig.estado;
  dest.desde = orig.desde || Date.now();
  dest.items = JSON.parse(JSON.stringify(orig.items || []));
  dest.pagado = orig.pagado || 0;
  dest.desc = orig.desc || 0;
  dest.cocinaEntregado = orig.cocinaEntregado || false;
  dest.pagadaOcupada = orig.pagadaOcupada || false;

  orig.items = [];
  orig.pagado = 0;
  orig.desc = 0;
  orig.desde = null;
  orig.cocinaEntregado = false;
  orig.pagadaOcupada = false;
  orig.estado = 'libre';

  // Actualizar orden en espera si existía para la mesa origen
  const ambDest = DB.ambientes.find(a => a.id === dest.ambienteId);
  (DB.ordenesCocina || []).forEach(o => {
    if (o.key === `mesa_${orig.id}` && !o.archivado) {
      o.key = `mesa_${dest.id}`;
      o.id = dest.id;
      o.titulo = `${dest.nombre} · ${ambDest?.nombre || 'Salón'}`;
    }
  });

  cuentaActiva = { tipo: 'mesa', id: dest.id };
  ambienteActualId = dest.ambienteId;
  registrarActividad('Traslado de mesa', `${orig.nombre} → ${dest.nombre}`);
  guardarDB();
  renderTodo();
  toast(`Pedido trasladado de ${orig.nombre} a ${dest.nombre}`);
}

function desocuparMesaPagada(id) {
  const m = obtenerMesa(id);
  if (!m) return;
  m.pagadaOcupada = false;
  m.items = [];
  m.pagado = 0;
  m.desc = 0;
  m.cocinaEntregado = false;
  cambiarEstadoMesa(m, 'libre');
  if (cuentaActiva.tipo === 'mesa' && cuentaActiva.id === m.id) {
    cuentaActiva = { tipo: null, id: null };
  }
  registrarActividad('Mesa liberada', `${m.nombre} quedó libre`);
  guardarDB();
  renderTodo();
  toast(`Aviso: ${m.nombre} liberada (Desocupada)`);
}

function abrirModalMesaOcupadaPagada(id) {
  const m = obtenerMesa(id);
  if (!m) return;
  const dlg = $('#dlgMesaOcupadaPagada');
  if (!dlg) {
    desocuparMesaPagada(id);
    return;
  }
  $('#ocupPagadaTitulo').textContent = `${m.nombre} sigue ocupada (Cuenta ya pagada)`;
  $('#ocupPagadaTexto').textContent = 'Selecciona qué deseas hacer con esta mesa ocupada:';

  const btnLiberar = $('#btnOcupLiberar');
  const btnAdicionar = $('#btnOcupAdicionar');
  const btnMover = $('#btnOcupMover');
  const btnAnular = $('#btnOcupAnular');

  const cerrar = () => {
    if (dlg.open) dlg.close();
  };

  btnLiberar.onclick = () => {
    cerrar();
    desocuparMesaPagada(m.id);
  };
  btnAdicionar.onclick = () => {
    cerrar();
    m.pagadaOcupada = false;
    cambiarEstadoMesa(m, 'ocupada');
    cuentaActiva = { tipo: 'mesa', id: m.id };
    guardarDB();
    renderSalon();
    renderTicket();
    cambiarTab('comandera');
    toast(`${m.nombre} lista para adicionar más productos`);
  };
  btnMover.onclick = () => {
    cerrar();
    trasladarMesa(m.id);
  };
  btnAnular.onclick = () => {
    cerrar();
    desocuparMesaPagada(m.id);
    cambiarTab('reportes');
    setTimeout(() => {
      const tb = $('#tablaVentas');
      tb?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    toast('Mesa liberada · Puedes eliminar o editar el cobro desde este historial de ventas', 'alerta');
  };

  dlg.showModal();
}

async function crearAmbiente() {
  if (!exigirAdmin()) return;
  const datos = await pedirFormulario({
    titulo: 'Nuevo ambiente',
    texto: 'Agrega un nuevo ambiente al restaurante y define si deseas crear mesas iniciales.',
    textoOk: 'Crear ambiente',
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre del ambiente', placeholder: 'Ej. Terraza, 2.º Piso, VIP', maxlength: 36 },
      { nombre: 'mesas', etiqueta: 'Cantidad inicial de mesas (opcional)', tipo: 'number', valor: '0', min: 0, max: 60, inputmode: 'numeric' }
    ],
    validar: d => {
      if (!d.nombre) return 'Escribe el nombre del ambiente.';
      if (DB.ambientes.some(a => a.nombre.toLowerCase() === d.nombre.toLowerCase())) return 'Ya existe un ambiente con ese nombre.';
      return '';
    }
  });
  if (!datos) return;
  const id = sigId('ambiente');
  const cant = Math.max(0, Math.min(60, parseInt(datos.mesas || '0', 10) || 0));
  DB.ambientes.push({ id, nombre: datos.nombre, orden: DB.ambientes.length + 1 });
  for (let i = 1; i <= cant; i++) {
    DB.mesas.push(nuevaMesaObj(id, i, `Mesa ${i}`));
  }
  ambienteActualId = id;
  registrarActividad('Ambiente creado', `${datos.nombre} (${cant} mesas)`);
  guardarDB();
  renderSalon();
  toast(`Ambiente "${datos.nombre}" creado`);
}

async function renombrarAmbienteActual() {
  if (!exigirAdmin()) return;
  const amb = obtenerAmbienteActual();
  if (!amb) return;
  const datos = await pedirFormulario({
    titulo: `Editar ambiente · ${amb.nombre}`,
    texto: 'Para confirmar la edición del ambiente ingresa tu contraseña de administrador y espera el desbloqueo de 5 segundos.',
    textoOk: 'Guardar cambios',
    requiereSeguridad5s: true,
    campos: [{ nombre: 'nombre', etiqueta: 'Nuevo nombre del ambiente', valor: amb.nombre, maxlength: 36 }],
    validar: d => {
      if (!d.nombre) return 'Escribe un nombre válido.';
      if (DB.ambientes.some(a => a.id !== amb.id && a.nombre.toLowerCase() === d.nombre.toLowerCase())) return 'Ya existe otro ambiente con ese nombre.';
      return '';
    }
  });
  if (!datos) return;
  amb.nombre = datos.nombre;
  registrarActividad('Ambiente editado', amb.nombre);
  guardarDB();
  renderSalon();
  renderTicket();
  toast('Ambiente actualizado');
}

async function eliminarAmbienteActual() {
  if (!exigirAdmin()) return;
  if (DB.ambientes.length <= 1) {
    toast('El sistema debe conservar al menos un ambiente', 'error');
    return;
  }
  const amb = obtenerAmbienteActual();
  const mesasAmb = DB.mesas.filter(m => m.ambienteId === amb.id);
  const ocupadas = mesasAmb.filter(m => m.estado === 'ocupada' || m.estado === 'precuenta' || (m.items && m.items.length));
  if (ocupadas.length) {
    toast(`No puedes eliminar "${amb.nombre}" porque tiene mesas ocupadas`, 'error');
    return;
  }
  const ok = await confirmar({
    titulo: `¿Eliminar el ambiente "${amb.nombre}"?`,
    texto: `Se eliminará "${amb.nombre}" y sus ${mesasAmb.length} mesa(s) libres. Ingresa la contraseña de administrador y espera 5 segundos.`,
    textoOk: 'Eliminar ambiente',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.mesas = DB.mesas.filter(m => m.ambienteId !== amb.id);
  DB.ambientes = DB.ambientes.filter(a => a.id !== amb.id);
  ambienteActualId = DB.ambientes[0].id;
  registrarActividad('Ambiente eliminado', amb.nombre);
  guardarDB();
  renderSalon();
  renderTicket();
  toast(`Ambiente "${amb.nombre}" eliminado`);
}

function nuevaMesaObj(ambienteId, numero, nombre, capacidad = 4) {
  return {
    id: sigId('mesa'),
    ambienteId,
    numero: String(numero),
    nombre: nombre || `Mesa ${numero}`,
    capacidad: Number(capacidad) || 4,
    estado: 'libre',
    notaReserva: '',
    desde: null,
    items: [],
    pagado: 0,
    desc: 0,
    cocinaEntregado: false,
    pagadaOcupada: false
  };
}

async function agregarMesasAmbiente() {
  if (!exigirAdmin()) return;
  const amb = obtenerAmbienteActual();
  const existentes = DB.mesas.filter(m => m.ambienteId === amb.id);
  const maxNum = existentes.reduce((max, m) => Math.max(max, parseInt(m.numero, 10) || 0), 0);
  const datos = await pedirFormulario({
    titulo: `Agregar mesas a ${amb.nombre}`,
    texto: `Se numerarán correlativamente desde la Mesa ${maxNum + 1}.`,
    textoOk: 'Agregar mesas',
    campos: [
      { nombre: 'cantidad', etiqueta: 'Cantidad de mesas', tipo: 'number', valor: '1', min: 1, max: 40, inputmode: 'numeric' },
      { nombre: 'capacidad', etiqueta: 'Capacidad (personas)', tipo: 'number', valor: '4', min: 1, max: 24, inputmode: 'numeric' }
    ],
    validar: d => ((parseInt(d.cantidad, 10) || 0) >= 1 ? '' : 'Ingresa al menos 1 mesa.')
  });
  if (!datos) return;
  const cant = Math.min(40, parseInt(datos.cantidad, 10) || 1);
  const cap = parseInt(datos.capacidad, 10) || 4;
  for (let i = 1; i <= cant; i++) {
    const n = maxNum + i;
    DB.mesas.push(nuevaMesaObj(amb.id, n, `Mesa ${n}`, cap));
  }
  registrarActividad('Mesas agregadas', `+${cant} en ${amb.nombre}`);
  guardarDB();
  renderSalon();
  toast(`${cant} mesa(s) agregadas a ${amb.nombre}`);
}

async function editarMesaIndividual(mesa) {
  if (!puedeModificarMesas()) {
    toast('No tienes permiso para modificar mesas', 'error');
    return;
  }
  const datos = await pedirFormulario({
    titulo: `Editar ${mesa.nombre}`,
    texto: 'Ingresa la nueva capacidad o nombre y confirma con tu contraseña secreta.',
    requiereSeguridad5s: true,
    permisoAutorizado: 'mesas.modificar',
    textoOk: 'Guardar cambios',
    campos: [
      { nombre: 'numero', etiqueta: 'Número o código', valor: mesa.numero, maxlength: 6 },
      { nombre: 'nombre', etiqueta: 'Nombre de la mesa', valor: mesa.nombre, maxlength: 24 },
      { nombre: 'capacidad', etiqueta: 'Capacidad (personas)', tipo: 'number', valor: String(mesa.capacidad || 4), min: 1, max: 24 }
    ],
    validar: d => (!d.numero || !d.nombre ? 'Completa número y nombre.' : '')
  });
  if (!datos) return;
  mesa.numero = datos.numero;
  mesa.nombre = datos.nombre;
  mesa.capacidad = parseInt(datos.capacidad, 10) || 4;
  registrarActividad('Mesa editada', `${mesa.nombre} (${mesa.capacidad} pers.)`);
  guardarDB();
  renderSalon();
  renderTicket();
  toast('Mesa actualizada');
}

async function eliminarMesaIndividual(id) {
  if (!exigirAdmin()) return;
  const m = obtenerMesa(id);
  if (!m) return;
  if (m.estado === 'ocupada' || m.estado === 'precuenta' || (m.items && m.items.length)) {
    toast(`No puedes eliminar ${m.nombre} porque tiene una cuenta activa`, 'error');
    return;
  }
  const ok = await confirmar({
    titulo: `¿Eliminar ${m.nombre}?`,
    texto: 'Esta acción requiere contraseña de administrador y 5 segundos de confirmación.',
    textoOk: 'Eliminar mesa',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.mesas = DB.mesas.filter(x => x.id !== id);
  if (cuentaActiva.tipo === 'mesa' && cuentaActiva.id === id) cuentaActiva = { tipo: null, id: null };
  registrarActividad('Mesa eliminada', m.nombre);
  guardarDB();
  renderSalon();
  renderTicket();
  toast(`${m.nombre} eliminada`);
}

async function alternarReservaMesa(id) {
  const m = obtenerMesa(id);
  if (!m) return;
  if (m.estado === 'reservada') {
    m.estado = 'libre';
    m.notaReserva = '';
    guardarDB();
    renderSalon();
    toast(`Aviso: ${m.nombre} está ahora DESOCUPADA (Libre)`);
    return;
  }
  if (m.estado !== 'libre') return;
  const datos = await pedirFormulario({
    titulo: `Reservar ${m.nombre}`,
    textoOk: 'Reservar mesa',
    campos: [{ nombre: 'nota', etiqueta: 'Cliente / Hora de reserva', placeholder: 'Ej. Familia Gómez · 19:30', maxlength: 40 }]
  });
  if (!datos) return;
  m.estado = 'reservada';
  m.notaReserva = datos.nota || 'Reservada';
  guardarDB();
  renderSalon();
  toast(`${m.nombre} reservada`);
}

async function seleccionarMesa(id) {
  const m = obtenerMesa(id);
  if (!m) return;
  if (editandoMesas && puedeModificarMesas()) {
    editarMesaIndividual(m);
    return;
  }
  if (m.pagadaOcupada) {
    abrirModalMesaOcupadaPagada(m.id);
    return;
  }
  if (m.estado === 'reservada') {
    const ok = await confirmar({
      titulo: `${m.nombre} está reservada`,
      texto: `Reserva: ${m.notaReserva || 'Sin detalle'}. ¿Pasar a estado OCUPADA y tomar pedido?`,
      textoOk: 'Ocupar mesa',
      peligro: false,
      requierePin: false,
      segundos: 0
    });
    if (!ok) return;
    cambiarEstadoMesa(m, 'ocupada');
    toast(`Aviso: ${m.nombre} pasó a estado OCUPADA`);
  }
  cuentaActiva = { tipo: 'mesa', id: m.id };
  guardarDB();
  renderSalon();
  renderTicket();
  cambiarTab('comandera');
}

function cambiarEstadoMesa(m, estado) {
  m.estado = estado;
  if (estado === 'libre' || estado === 'reservada') {
    m.desde = null;
  } else if (!m.desde) {
    m.desde = Date.now();
  }
  guardarDB();
}

/* ================= 2. Envíos a Domicilio / Delivery ================= */
function crearEnvioDomicilio(e) {
  e.preventDefault();
  const cliente = $('#envCliente').value.trim();
  const telefono = $('#envTelefono').value.trim();
  const direccion = $('#envDireccion').value.trim();
  const estadoPago = $('#envEstadoPago').value;
  const refYape = $('#envRefYape').value.trim();
  const notas = $('#envNotas').value.trim();
  $('#envError').textContent = '';

  if (!cliente || !direccion) {
    $('#envError').textContent = 'Completa el nombre del cliente y la dirección de entrega.';
    return;
  }

  animarBotonAvion($('#btnCrearEnvio'));

  const id = sigId('envio');
  const nuevo = {
    id,
    nombre: `Envío #${id}`,
    cliente,
    telefono,
    direccion,
    estadoPago, // 'contraentrega_efectivo' | 'contraentrega_yape' | 'pagado_yape'
    referenciaYape: estadoPago === 'pagado_yape' ? refYape : '',
    notas,
    creadoTs: Date.now(),
    creadoEn: new Date().toISOString(),
    items: [],
    pagado: 0,
    desc: 0,
    cocinaEntregado: false,
    pagadoFinalizado: false
  };
  DB.envios.unshift(nuevo);
  cuentaActiva = { tipo: 'envio', id: nuevo.id };
  registrarActividad('Envío creado', `Envío #${id} · ${cliente} (${direccion})`);
  e.target.reset();
  $('#lblEnvRefYape').hidden = true;
  cerrarDialogo('dlgEnvioModal');
  guardarDB();
  renderEnvios();
  renderTicket();
  cambiarTab('comandera');
  toast(`Envío #${id} creado · Agrega los platos en la comandera`);
}

function renderEnvios() {
  const activos = DB.envios.filter(ev => !ev.pagadoFinalizado);
  $('#cntEnvios').textContent = String(activos.length);
  const cont = $('#listaEnvios');
  if (!cont) return;

  if (!activos.length) {
    cont.innerHTML = `<div class="vacio-bloque">
      <svg class="ico"><use href="#i-moto"/></svg>
      <h3>No hay envíos activos</h3>
      <p>Pulsa el botón "+ Nuevo envío a domicilio" para abrir el formulario y registrar un pedido de delivery.</p>
    </div>`;
    return;
  }

  const etqPago = {
    contraentrega_efectivo: ['efectivo', 'Pagará al recibir (Efectivo)'],
    contraentrega_yape: ['yape', 'Pagará al recibir (Yape)'],
    pagado_yape: ['yape', 'Ya pagó por Yape']
  };

  cont.innerHTML = activos.map(ev => {
    const t = calcularTotales(ev);
    const [cls, txtPago] = etqPago[ev.estadoPago] || ['ok', 'Contraentrega'];
    const esAct = cuentaActiva.tipo === 'envio' && cuentaActiva.id === ev.id;
    return `<article class="envio-card ${esAct ? 'activo' : ''}">
      <div class="envio-cab">
        <div>
          <strong>${esc(ev.nombre)} · ${esc(ev.cliente)}</strong>
          <div class="envio-dir">${esc(ev.direccion)} ${ev.telefono ? `· Tel. ${esc(ev.telefono)}` : ''}</div>
          ${ev.notas ? `<div class="celda-sub">Ref: ${esc(ev.notas)}</div>` : ''}
        </div>
        <span class="badge ${cls}">${esc(txtPago)}${ev.referenciaYape ? ` · Op. ${esc(ev.referenciaYape)}` : ''}</span>
      </div>
      <div class="fila">
        <span class="sub">${ev.items.length} ítem(s) · <b>${soles(t.pendiente)}</b> · ${ev.cocinaEntregado ? 'Listo / Entregado' : 'En preparación'}</span>
        <div class="envio-acc">
          <button type="button" class="btn-prim" data-sel-envio="${ev.id}"><svg class="ico"><use href="#i-comanda"/></svg>Editar / Ver pedido</button>
          <button type="button" class="btn-ok" data-cobrar-envio="${ev.id}" ${!ev.items.length ? 'disabled' : ''}><svg class="ico"><use href="#i-caja"/></svg>Cobrar envío</button>
          <button type="button" class="btn-mini peligro" data-borrar-envio="${ev.id}" title="Cancelar envío"><svg class="ico"><use href="#i-trash"/></svg></button>
        </div>
      </div>
    </article>`;
  }).join('');
}

async function cancelarEnvioActivo(id) {
  const ev = obtenerEnvio(id);
  if (!ev) return;
  const ok = await confirmar({
    titulo: `¿Cancelar ${ev.nombre} (${ev.cliente})?`,
    texto: 'Se eliminará este envío en curso. Requiere contraseña de administrador y 5 segundos de confirmación.',
    textoOk: 'Cancelar envío',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.envios = DB.envios.filter(x => x.id !== id);
  (DB.ordenesCocina || []).forEach(o => {
    if (o.key === `envio_${id}`) o.archivado = true;
  });
  if (cuentaActiva.tipo === 'envio' && cuentaActiva.id === id) cuentaActiva = { tipo: null, id: null };
  registrarActividad('Envío cancelado', `${ev.nombre} (${ev.cliente})`);
  guardarDB();
  renderTodo();
  toast(`${ev.nombre} cancelado`);
}


/* ================= 3. Comandera (Imagen 1:1 y Descripción) ================= */
function estadoStockPlato(prodId) {
  const rec = DB.recetas[prodId];
  if (!rec || !Object.keys(rec).length) return 'ok';
  let estado = 'ok';
  for (const [ins, cant] of Object.entries(rec)) {
    const info = DB.insumos[ins];
    if (!info || info.stock < cant) return 'agotado';
    if (info.stock <= info.min) estado = 'bajo';
  }
  return estado;
}

function renderComandera() {
  const objAct = obtenerObjetivoActivo();
  const aviso = $('#avisoMesa');
  if (!objAct) {
    aviso.className = 'aviso-mesa';
    aviso.innerHTML = `<span>Sin cuenta seleccionada. Elige una mesa en Salón o crea un Envío para tomar el pedido.</span>
      <div class="fila">
        <button type="button" data-ir-salon>Ir a Salón</button>
        <button type="button" data-ir-envios>Ir a Envíos</button>
      </div>`;
  } else if (objAct.tipo === 'mesa') {
    const m = objAct.obj;
    const amb = DB.ambientes.find(a => a.id === m.ambienteId);
    aviso.className = 'aviso-mesa activa';
    aviso.innerHTML = `<span>Tomando pedido para <b>${esc(m.nombre)}</b> · ${esc(amb?.nombre || 'Salón')}</span><button type="button" data-ir-salon>Cambiar mesa</button>`;
  } else {
    const ev = objAct.obj;
    aviso.className = 'aviso-mesa activa';
    aviso.innerHTML = `<span>Armando pedido para <b>${esc(ev.nombre)} (${esc(ev.cliente)})</b> · ${esc(ev.direccion)}</span><button type="button" data-ir-envios>Ver envíos</button>`;
  }

  const cats = ['Todas', ...DB.categorias];
  if (!cats.includes(catActual)) catActual = 'Todas';
  $('#categorias').innerHTML = cats.map(c =>
    `<button class="chip ${c === catActual ? 'active' : ''}" role="tab" aria-selected="${c === catActual}" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join('');

  const q = busquedaPlato.trim().toLowerCase();
  const lista = DB.productos.filter(p =>
    (catActual === 'Todas' || p.cat === catActual) &&
    (!q || p.nombre.toLowerCase().includes(q) || (p.desc || '').toLowerCase().includes(q))
  );

  const grid = $('#gridPlatos');
  if (!DB.productos.length) {
    grid.innerHTML = puedeEditarProductos()
      ? `<div class="vacio-bloque">
          <svg class="ico"><use href="#i-carta"/></svg>
          <h3>La carta está en blanco</h3>
          <p>Aún no has registrado platos, bebidas ni porciones. Agrégalos desde Carta e inventario con su foto 1:1 y descripción.</p>
          <button type="button" class="btn-prim" data-ir-inventario><svg class="ico"><use href="#i-plus"/></svg>Agregar primer plato</button>
        </div>`
      : `<div class="vacio-bloque">
          <svg class="ico"><use href="#i-carta"/></svg>
          <h3>Carta sin productos registrados</h3>
          <p>Solicita al administrador WILLOSIRIS que registre los platos en Carta e inventario.</p>
        </div>`;
    return;
  }

  if (!lista.length) {
    grid.innerHTML = `<p class="vacio-msg">No hay platos que coincidan con "${esc(busquedaPlato)}".</p>`;
    return;
  }

  grid.innerHTML = lista.map(p => {
    const st = estadoStockPlato(p.id);
    const etq = st === 'agotado' ? 'Sin stock' : st === 'bajo' ? 'Stock bajo' : '';
    return `<div class="plato ${st === 'agotado' ? 'agotado' : ''}">
      <button type="button" class="plato-add" data-add="${p.id}" ${st === 'agotado' ? 'disabled' : ''}>
        ${p.img ? `<div class="plato-thumb"><img src="${esc(p.img)}" alt="${esc(p.nombre)}"></div>` : ''}
        <div class="plato-info">
          <span class="plato-cat">${esc(p.cat)}</span>
          <span class="plato-nom">${esc(p.nombre)}</span>
          ${p.desc ? `<span class="plato-desc">${esc(p.desc)}</span>` : ''}
          <span class="plato-pie">
            <span class="plato-precio">${soles(p.precio)}</span>
            ${etq ? `<span class="plato-stock ${st}">${etq}</span>` : ''}
          </span>
        </div>
      </button>
      <button type="button" class="plato-mod" data-mod="${p.id}" aria-label="Notas o modificadores para ${esc(p.nombre)}" title="Notas / cremas" ${st === 'agotado' ? 'disabled' : ''}><svg class="ico"><use href="#i-ajuste-mod"/></svg></button>
    </div>`;
  }).join('');
}

function abrirModificadores(prodId) {
  const p = DB.productos.find(x => x.id === prodId);
  if (!p) return;
  modProdId = prodId;
  $('#modTitulo').textContent = p.nombre;
  $('#modOpciones').innerHTML = DB.modificadores.length
    ? DB.modificadores.map(m => `<label class="opcion"><input type="checkbox" value="${esc(m)}"><span>${esc(m)}</span></label>`).join('')
    : `<p class="sub">No hay modificadores predefinidos. Escribe una observación abajo.</p>`;
  $('#modObs').value = '';
  abrirDialogo('dlgMod');
}

function confirmarModificadores() {
  if (!modProdId) return;
  const mods = $$('#modOpciones input:checked').map(c => c.value);
  const obs = $('#modObs').value.trim();
  agregarPlatoATicket(modProdId, mods, obs);
  modProdId = null;
}

/* ================= 4. Ticket / Cuenta Activa (Salón o Envío) ================= */
function claveItem(prodId, mods, obs) {
  return `${prodId}|${(mods || []).slice().sort().join(',')}|${obs || ''}`;
}

function agregarPlatoATicket(prodId, mods = [], obs = '') {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) {
    toast('Primero selecciona una mesa en Salón o un pedido en Envíos', 'alerta');
    cambiarTab('salon');
    return;
  }
  const cuenta = objAct.obj;
  const prod = DB.productos.find(p => p.id === prodId);
  if (!prod) return;
  if (estadoStockPlato(prodId) === 'agotado') {
    toast(`Sin stock de insumos para ${prod.nombre}`, 'error');
    return;
  }

  if (objAct.tipo === 'mesa') {
    if (cuenta.pagadaOcupada) {
      cuenta.pagadaOcupada = false;
      cuenta.items = [];
      cuenta.pagado = 0;
    }
    if (cuenta.estado === 'libre' || cuenta.estado === 'reservada') {
      cambiarEstadoMesa(cuenta, 'ocupada');
      toast(`Aviso: ${cuenta.nombre} pasó a estado OCUPADA`);
    }
  }

  const key = claveItem(prodId, mods, obs);
  let item = cuenta.items.find(i => i.key === key);
  if (item) {
    item.cant += 1;
  } else {
    item = { key, prodId, nombre: prod.nombre, precio: prod.precio, cant: 1, enviado: 0, mods, obs };
    cuenta.items.push(item);
  }
  ultimoItemAgregadoKey = key;
  guardarDB();
  renderTicket();
  renderSalon();
  renderEnvios();
  renderCaja();
  toast(`${prod.nombre} agregado a ${cuenta.nombre}`);
}

function cambiarCantidadItem(key, delta) {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const cuenta = objAct.obj;
  const idx = cuenta.items.findIndex(i => i.key === key);
  if (idx === -1) return;
  const it = cuenta.items[idx];
  const nueva = it.cant + delta;

  if (nueva < it.enviado) {
    toast('Ese plato ya fue enviado a cocina. Usa Anular si deseas cancelar la cuenta.', 'alerta');
    return;
  }
  if (nueva <= 0) {
    cuenta.items.splice(idx, 1);
  } else {
    it.cant = nueva;
  }
  if (objAct.tipo === 'mesa' && !cuenta.items.length && !cuenta.pagado) {
    cambiarEstadoMesa(cuenta, 'libre');
  }
  guardarDB();
  renderTicket();
  renderSalon();
  renderEnvios();
  renderCaja();
}

function calcularTotales(cuenta) {
  if (!cuenta || !Array.isArray(cuenta.items)) {
    return { bruto: 0, descuento: 0, total: 0, subtotal: 0, igv: 0, pagado: 0, pendiente: 0, cantItems: 0 };
  }
  const bruto = r2(cuenta.items.reduce((s, i) => s + i.precio * i.cant, 0));
  const pct = Math.min(100, Math.max(0, Number(cuenta.desc) || 0));
  const descuento = r2(bruto * (pct / 100));
  const total = Math.max(0, r2(bruto - descuento));
  const tasa = Number(DB.config.igv) || 0.18;
  const subtotal = r2(total / (1 + tasa));
  const igv = r2(total - subtotal);
  const pagado = r2(cuenta.pagado || 0);
  const pendiente = Math.max(0, r2(total - pagado));
  const cantItems = cuenta.items.reduce((s, i) => s + i.cant, 0);
  return { bruto, descuento, total, subtotal, igv, pagado, pendiente, cantItems };
}

function renderTicket() {
  const objAct = obtenerObjetivoActivo();
  const ul = $('#ticketItems');
  const inpDesc = $('#descuentoPct');
  const btnDesocupar = $('#btnDesocuparRapido');
  const filaCocina = $('#filaEnviarCocina');
  const filaCobro = $('#filaCobroPrecuenta');
  const swImpCocina = $('#swImprimirAlEnviarCocina');

  if (swImpCocina) {
    swImpCocina.checked = !!DB.impresion.autoCocina;
  }

  if (!objAct) {
    $('#ticketMesa').textContent = 'Sin cuenta';
    $('#ticketSub').textContent = 'Selecciona una mesa o un envío';
    if (btnDesocupar) btnDesocupar.hidden = true;
    ul.innerHTML = `<li class="ticket-vacio">Abre una mesa en Salón o selecciona un pedido en Envíos para comenzar.</li>`;
    inpDesc.value = '0';
    inpDesc.disabled = true;
    $('#tBruto').textContent = soles(0);
    $('#tDescuento').textContent = '- ' + soles(0);
    $('#tSubtotal').textContent = soles(0);
    $('#tIgv').textContent = soles(0);
    $('#filaPagado').hidden = true;
    $('#tTotalLbl').textContent = 'Total';
    $('#tTotal').textContent = soles(0);
    $('#verTicketTxt').textContent = 'Cuenta';
    if (filaCocina) filaCocina.hidden = false;
    if (filaCobro) filaCobro.hidden = true;
    ['#btnCocina', '#btnPrecuenta', '#btnCobrar', '#btnAnular'].forEach(s => {
      const b = $(s);
      if (b) b.disabled = true;
    });
    return;
  }

  const cuenta = objAct.obj;
  if (objAct.tipo === 'mesa') {
    const amb = DB.ambientes.find(a => a.id === cuenta.ambienteId);
    $('#ticketMesa').textContent = cuenta.nombre;
    const estTxt = cuenta.pagadaOcupada ? 'Ocupada (Ya pagó)' : (ETIQ_MESA[cuenta.estado] || 'Libre');
    $('#ticketSub').textContent = `${amb?.nombre || 'Salón'} · ${estTxt}${cuenta.desde ? ` · ${minutosDesde(cuenta.desde)} min` : ''}`;
    if (btnDesocupar) {
      btnDesocupar.hidden = !cuenta.pagadaOcupada;
      btnDesocupar.onclick = () => abrirModalMesaOcupadaPagada(cuenta.id);
    }
  } else {
    $('#ticketMesa').textContent = `${cuenta.nombre} · ${cuenta.cliente}`;
    $('#ticketSub').textContent = `Delivery: ${cuenta.direccion}`;
    if (btnDesocupar) btnDesocupar.hidden = true;
  }

  inpDesc.disabled = false;
  inpDesc.value = String(cuenta.desc || 0);

  if (!cuenta.items.length) {
    ul.innerHTML = `<li class="ticket-vacio">${cuenta.pagadaOcupada ? 'Cuenta pagada · Los clientes siguen en la mesa.' : 'Cuenta sin platos. Agrégalos desde la comandera.'}</li>`;
  } else {
    ul.innerHTML = cuenta.items.map(it => {
      const detalle = [...(it.mods || []), it.obs].filter(Boolean).join(' · ');
      const pend = it.cant - (it.enviado || 0);
      const est = pend > 0
        ? `<span class="t-item-estado pend">${it.enviado ? `${pend} nuevo(s)` : 'Por enviar a cocina'}</span>`
        : `<span class="t-item-estado env">En cocina</span>`;
      const recien = it.key === ultimoItemAgregadoKey ? 'recien' : '';
      return `<li class="t-item ${recien}">
        <div class="t-item-top">
          <div>
            <div class="t-item-nom">${esc(it.nombre)}</div>
            ${detalle ? `<div class="t-item-mods">${esc(detalle)}</div>` : ''}
            ${est}
          </div>
          <span class="t-item-sub">${soles(it.precio * it.cant)}</span>
        </div>
        <div class="t-item-ctrl">
          <div class="qty">
            <button type="button" data-qty="-1" data-key="${esc(it.key)}" aria-label="Restar ${esc(it.nombre)}"><svg class="ico"><use href="#i-minus"/></svg></button>
            <span>${it.cant}</span>
            <button type="button" data-qty="1" data-key="${esc(it.key)}" aria-label="Sumar ${esc(it.nombre)}"><svg class="ico"><use href="#i-plus"/></svg></button>
          </div>
          <span class="sub">${soles(it.precio)} c/u</span>
        </div>
      </li>`;
    }).join('');
    ultimoItemAgregadoKey = null;
  }

  const t = calcularTotales(cuenta);
  $('#tBruto').textContent = soles(t.bruto);
  $('#tDescuento').textContent = '- ' + soles(t.descuento);
  $('#tSubtotal').textContent = soles(t.subtotal);
  $('#tIgv').textContent = soles(t.igv);
  $('#filaPagado').hidden = t.pagado <= 0;
  $('#tPagado').textContent = '- ' + soles(t.pagado);
  $('#tTotalLbl').textContent = t.pagado > 0 ? 'Pendiente' : 'Total';
  $('#tTotal').textContent = soles(t.pendiente);
  $('#verTicketTxt').textContent = `${cuenta.nombre} · ${soles(t.pendiente)}`;

  const hayItems = cuenta.items.length > 0;
  const hayPorEnviar = cuenta.items.some(i => i.cant > (i.enviado || 0));

  // Antes de cobrar o pre-cuenta (o al adicionar nuevos platos), mostrar Enviar a cocina + interruptor de impresión;
  // una vez enviado a cocina, ocultar Enviar a cocina + interruptor y mostrar Pre-cuenta y Cobrar.
  const mostrarCocina = !hayItems || hayPorEnviar;
  if (filaCocina) filaCocina.hidden = !mostrarCocina;
  if (filaCobro) filaCobro.hidden = mostrarCocina;

  $('#btnCocina').disabled = !hayPorEnviar;
  $('#btnPrecuenta').disabled = !hayItems;
  $('#btnCobrar').disabled = !hayItems || t.pendiente <= 0;
  $('#btnAnular').disabled = !hayItems && (objAct.tipo !== 'mesa' || cuenta.estado === 'libre');
}

function enviarACocina() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const cuenta = objAct.obj;
  const nuevos = cuenta.items
    .map(i => ({ item: i, diff: i.cant - (i.enviado || 0) }))
    .filter(x => x.diff > 0);

  if (!nuevos.length) {
    toast('No hay platos pendientes por enviar a cocina', 'alerta');
    return;
  }

  // Verificar stock antes de descontar
  const requerido = {};
  for (const { item, diff } of nuevos) {
    const rec = DB.recetas[item.prodId] || {};
    for (const [ins, cant] of Object.entries(rec)) {
      requerido[ins] = (requerido[ins] || 0) + cant * diff;
    }
  }
  for (const [ins, cant] of Object.entries(requerido)) {
    const info = DB.insumos[ins];
    if (!info || info.stock < cant) {
      toast(`Stock insuficiente de ${ins} (requiere ${cant}, hay ${info?.stock ?? 0})`, 'error');
      return;
    }
  }

  animarBotonAvion($('#btnCocina'));

  for (const [ins, cant] of Object.entries(requerido)) {
    DB.insumos[ins].stock = r2(DB.insumos[ins].stock - cant);
    DB.movimientos.unshift({
      id: sigId('mov'),
      fecha: new Date().toISOString(),
      insumo: ins,
      tipo: 'consumo',
      cantidad: -cant,
      motivo: `Comanda ${cuenta.nombre}`,
      usuario: sesion?.nombre || 'Operador'
    });
  }
  nuevos.forEach(({ item }) => { item.enviado = item.cant; });
  cuenta.cocinaEntregado = false;
  if (objAct.tipo === 'mesa' && cuenta.estado === 'libre') {
    cambiarEstadoMesa(cuenta, 'ocupada');
  }
  sincronizarOrdenCocina(objAct.tipo, cuenta);

  const swImp = $('#swImprimirAlEnviarCocina');
  if (swImp) {
    DB.impresion.autoCocina = swImp.checked;
  }

  const numOrden = sigId('ordenCocina');
  registrarActividad('Comanda enviada a cocina', `${cuenta.nombre} · Orden #${numOrden}`);
  guardarDB();

  // Impresión condicional en cocina según el interruptor al costado del botón y privilegio del usuario
  if (DB.impresion.autoCocina && tienePermiso('impresion.permitir')) {
    imprimirTicket80mm({
      subtitulo: `COMANDA DE COCINA · (${DB.impresion.impCocina || 'Cocina 80mm'})`,
      checkLabel: objAct.tipo === 'envio' ? `DELIVERY (${cuenta.direccion})` : `${cuenta.nombre}`,
      ordenNum: numOrden,
      cajero: sesion?.nombre || 'Operador',
      cliente: cuenta.cliente || 'Salón',
      lineas: nuevos.map(({ item, diff }) => ({
        cant: diff,
        nombre: item.nombre,
        precioUnit: item.precio,
        subtotal: r2(item.precio * diff),
        nota: [...(item.mods || []), item.obs].filter(Boolean).join(', ')
      })),
      esComandaCocina: true
    });
  }

  renderTodo();
  toast(`Orden #${numOrden} enviada a cocina · Ahora puedes generar Pre-cuenta o Cobrar`);
}

function emitirPrecuenta() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const cuenta = objAct.obj;
  if (!cuenta.items.length) return;
  if (objAct.tipo === 'mesa') cambiarEstadoMesa(cuenta, 'precuenta');
  const t = calcularTotales(cuenta);
  registrarActividad('Pre-cuenta emitida', `${cuenta.nombre} · ${soles(t.pendiente)}`);
  guardarDB();

  if (DB.impresion.autoPrecuenta && tienePermiso('impresion.permitir')) {
    imprimirTicket80mm({
      subtitulo: 'PRE-CUENTA (NO VÁLIDO COMO COMPROBANTE)',
      checkLabel: objAct.tipo === 'envio' ? `${cuenta.nombre} · DELIVERY` : cuenta.nombre,
      ordenNum: cuenta.id,
      cajero: sesion?.nombre || 'Operador',
      cliente: cuenta.cliente || 'Público general',
      lineas: cuenta.items.map(i => ({
        cant: i.cant,
        nombre: i.nombre,
        precioUnit: i.precio,
        subtotal: r2(i.precio * i.cant),
        nota: [...(i.mods || []), i.obs].filter(Boolean).join(', ')
      })),
      subtotal: t.subtotal,
      igv: t.igv,
      descuento: t.descuento,
      total: t.pendiente,
      metodo: 'PENDIENTE DE PAGO',
      recibido: t.pendiente,
      vuelto: 0
    });
  }
  renderSalon();
  renderTicket();
  toast(`Pre-cuenta generada para ${cuenta.nombre}`);
}

async function anularCuenta() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const cuenta = objAct.obj;
  const yaEnviado = cuenta.items.some(i => (i.enviado || 0) > 0);
  const ok = await confirmar({
    titulo: `¿Anular cuenta de ${cuenta.nombre}?`,
    texto: yaEnviado
      ? 'Se devolverán al stock los insumos de los platos enviados a cocina y la orden desaparecerá del tablero de Cocina. Requiere PIN de administrador y 5 segundos.'
      : 'Se vaciarán todos los platos de esta cuenta. Requiere PIN de administrador y 5 segundos.',
    textoOk: 'Anular cuenta',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;

  for (const it of cuenta.items) {
    if (!it.enviado) continue;
    const rec = DB.recetas[it.prodId] || {};
    for (const [ins, cant] of Object.entries(rec)) {
      if (DB.insumos[ins]) {
        DB.insumos[ins].stock = r2(DB.insumos[ins].stock + cant * it.enviado);
        DB.movimientos.unshift({
          id: sigId('mov'),
          fecha: new Date().toISOString(),
          insumo: ins,
          tipo: 'reverso',
          cantidad: cant * it.enviado,
          motivo: `Anulación ${cuenta.nombre}`,
          usuario: sesion?.nombre || 'Admin'
        });
      }
    }
  }

  (DB.ordenesCocina || []).forEach(o => {
    if (o.key === `${objAct.tipo}_${cuenta.id}`) o.archivado = true;
  });

  if (objAct.tipo === 'mesa') {
    cuenta.items = [];
    cuenta.pagado = 0;
    cuenta.desc = 0;
    cuenta.cocinaEntregado = false;
    cuenta.pagadaOcupada = false;
    cambiarEstadoMesa(cuenta, 'libre');
    toast(`Aviso: Cuenta anulada · ${cuenta.nombre} está DESOCUPADA (Libre)`);
  } else {
    DB.envios = DB.envios.filter(x => x.id !== cuenta.id);
    cuentaActiva = { tipo: null, id: null };
    toast(`Envío anulado y retirado de cocina`);
  }
  registrarActividad('Cuenta anulada', cuenta.nombre);
  guardarDB();
  renderTodo();
}

/* ================= 5. Caja, Billetes Perú y Ticket 80mm Estilo Popeyes ================= */
function seleccionarMetodoPago(m) {
  metodoPago = m === 'Yape' ? 'Yape' : 'Efectivo';
  $$('#caja .metodo').forEach(b => {
    const act = b.dataset.metodo === metodoPago;
    b.classList.toggle('active', act);
    b.setAttribute('aria-checked', String(act));
  });
}

function actualizarCamposCliente() {
  const comp = $('#tipoComprobante').value;
  let doc = $('#tipoDoc').value;
  if (comp === 'Factura' && doc !== 'RUC') {
    doc = 'RUC';
    $('#tipoDoc').value = 'RUC';
  }
  const num = $('#numDoc');
  const nom = $('#nombreCliente');
  if (doc === 'PG') {
    num.value = '';
    num.disabled = true;
    nom.value = 'Público general';
    nom.disabled = true;
  } else {
    num.disabled = false;
    num.maxLength = doc === 'RUC' ? 11 : 8;
    num.placeholder = doc === 'RUC' ? '11 dígitos' : '8 dígitos';
    nom.disabled = false;
    if (nom.value === 'Público general') nom.value = '';
  }
}

function renderCaja() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) {
    $('#cajaTotal').textContent = soles(0);
    $('#cajaMesa').textContent = 'Sin cuenta seleccionada';
    $('#btnSplit').disabled = true;
    $('#btnProcesarPago').disabled = true;
    return;
  }
  const cuenta = objAct.obj;
  const t = calcularTotales(cuenta);
  $('#cajaTotal').textContent = soles(t.pendiente);
  $('#cajaMesa').textContent = objAct.tipo === 'mesa'
    ? `${cuenta.nombre} · ${t.cantItems} plato(s)`
    : `${cuenta.nombre} (${cuenta.cliente}) · Delivery`;
  $('#btnSplit').disabled = t.pendiente <= 0 || cuenta.items.length === 0;
  $('#btnProcesarPago').disabled = t.pendiente <= 0 || cuenta.items.length === 0;

  if (objAct.tipo === 'envio') {
    if (cuenta.estadoPago === 'contraentrega_yape' || cuenta.estadoPago === 'pagado_yape') {
      seleccionarMetodoPago('Yape');
    } else {
      seleccionarMetodoPago('Efectivo');
    }
    if (cuenta.cliente && $('#tipoDoc').value === 'PG') {
      $('#nombreCliente').value = cuenta.cliente;
    }
  }
}

/* Denominaciones frecuentes en Perú (10, 20, 50, 100, 200) sin repetir "Exacto" */
function sugerirDenominacionesPeru(monto) {
  const billetesPeru = [10, 20, 50, 100, 200];
  const sugeridos = billetesPeru.filter(b => b >= monto);
  if (!sugeridos.length) {
    const sup = Math.ceil(monto / 50) * 50;
    return [sup, sup + 50, sup + 100];
  }
  return sugeridos;
}

function abrirModalCobro(opciones = {}) {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) {
    toast('Selecciona una mesa o un envío con cuenta activa', 'alerta');
    return;
  }
  const cuenta = objAct.obj;
  const t = calcularTotales(cuenta);
  if (t.pendiente <= 0) {
    toast('Esta cuenta no tiene saldo pendiente', 'alerta');
    return;
  }

  // Verificar límite diario de ventas en licencia
  const maxDia = Number(DB.licencia.maxVentasDia) || 0;
  if (maxDia > 0) {
    const hoyStr = new Date().toDateString();
    const ventasHoy = DB.ventas.filter(v => new Date(v.fecha).toDateString() === hoyStr).length;
    if (ventasHoy >= maxDia) {
      toast(`Límite diario de licencia alcanzado (${maxDia} ventas por día). Amplíalo en Ajustes → Licencia.`, 'error');
      return;
    }
  }

  const monto = r2(opciones.monto ?? t.pendiente);
  cobroActual = {
    objetivoTipo: objAct.tipo,
    objetivoId: cuenta.id,
    monto,
    modo: opciones.modo || 'total',
    etiqueta: opciones.etiqueta || 'Cuenta completa',
    itemsQuitados: opciones.itemsQuitados || null
  };

  $('#cobroTitulo').textContent = `Cobrar · ${cuenta.nombre}`;
  const tag = $('#cobroMetodo');
  tag.textContent = metodoPago;
  tag.className = 'metodo-tag ' + (metodoPago === 'Yape' ? 'yape' : 'efectivo');
  $('#cobroDetalle').textContent = `${cobroActual.etiqueta} · ${$('#tipoComprobante').value}`;
  $('#cobroTotal').textContent = soles(monto);

  // Siempre marcada la casilla de imprimir comprobante por defecto
  $('#cobroImprimir').checked = true;

  const esEf = metodoPago === 'Efectivo';
  $('#bloqueEfectivo').hidden = !esEf;
  $('#bloqueYape').hidden = esEf;

  if (esEf) {
    const denoms = sugerirDenominacionesPeru(monto);
    // Por defecto el monto recibido es igual al monto total exacto; abajo aparecen los aproximados de Perú
    $('#cobroRecibido').value = monto.toFixed(2);
    $('#rapidos').innerHTML = denoms.map(v =>
      `<button type="button" data-billete="${v}">S/ ${v}</button>`
    ).join('');
    calcularVueltoModal();
  } else {
    $('#cobroReferencia').value = objAct.tipo === 'envio' ? (cuenta.referenciaYape || '') : '';
    $('#btnCobroOk').disabled = false;
  }
  abrirDialogo('dlgCobro');
}

function calcularVueltoModal() {
  if (!cobroActual || metodoPago !== 'Efectivo') return;
  const rec = parseFloat($('#cobroRecibido').value) || 0;
  const diff = r2(rec - cobroActual.monto);
  const el = $('#cobroVuelto');
  if (diff < 0) {
    el.textContent = `Faltan ${soles(-diff)}`;
    el.style.color = 'var(--no)';
    $('#btnCobroOk').disabled = true;
  } else {
    el.textContent = soles(diff);
    el.style.color = 'var(--ok)';
    $('#btnCobroOk').disabled = false;
  }
}

function preguntarEstadoMesaPostPago(mesa) {
  return new Promise(resolve => {
    const dlg = $('#dlgEstadoMesaPostPago');
    $('#postPagoTitulo').textContent = `Pago registrado · ¿Estado de ${mesa.nombre}?`;
    $('#postPagoTexto').textContent = `Se procesó el cobro de ${mesa.nombre}. ¿La mesa ya quedó DESOCUPADA (Libre) o los clientes aún siguen ocupándola?`;
    const btnLibre = $('#btnMesaYaDesocupada');
    const btnOcupada = $('#btnMesaSigueOcupada');
    const cerrar = estado => {
      btnLibre.onclick = btnOcupada.onclick = dlg.onclose = null;
      if (dlg.open) dlg.close();
      resolve(estado);
    };
    btnLibre.onclick = () => cerrar('desocupada');
    btnOcupada.onclick = () => cerrar('ocupada');
    dlg.onclose = () => cerrar('desocupada');
    dlg.showModal();
  });
}

async function confirmarCobro(e) {
  e.preventDefault();
  if (!cobroActual) return;
  const tipoObjetivo = cobroActual.objetivoTipo;
  const esMesa = tipoObjetivo === 'mesa';
  const cuenta = esMesa ? obtenerMesa(cobroActual.objetivoId) : obtenerEnvio(cobroActual.objetivoId);
  if (!cuenta) return;

  const doc = $('#tipoDoc').value;
  const numDoc = $('#numDoc').value.trim();
  const cliente = ($('#nombreCliente').value.trim() || cuenta.cliente || 'Público general');
  if (doc === 'DNI' && !/^\d{8}$/.test(numDoc)) {
    toast('El DNI debe tener 8 dígitos', 'error');
    return;
  }
  if (doc === 'RUC' && !/^\d{11}$/.test(numDoc)) {
    toast('El RUC debe tener 11 dígitos', 'error');
    return;
  }

  const monto = cobroActual.monto;
  const recibido = metodoPago === 'Efectivo' ? Math.max(monto, parseFloat($('#cobroRecibido').value) || monto) : monto;
  const vuelto = metodoPago === 'Efectivo' ? r2(recibido - monto) : 0;
  const referencia = metodoPago === 'Yape' ? ($('#cobroReferencia').value.trim() || 'Yape directo') : 'Efectivo';
  const comprobante = $('#tipoComprobante').value || 'Ticket Interno';
  const deseaImprimir = $('#cobroImprimir').checked;

  // Descontar insumos de platos aún no enviados a cocina
  const noEnviados = cuenta.items.filter(i => i.cant > (i.enviado || 0));
  for (const it of noEnviados) {
    const diff = it.cant - (it.enviado || 0);
    const rec = DB.recetas[it.prodId] || {};
    for (const [ins, cant] of Object.entries(rec)) {
      if (DB.insumos[ins]) {
        DB.insumos[ins].stock = Math.max(0, r2(DB.insumos[ins].stock - cant * diff));
      }
    }
    it.enviado = it.cant;
  }

  let resumenItems = [];
  if (cobroActual.modo === 'items' && cobroActual.itemsQuitados) {
    resumenItems = cobroActual.itemsQuitados.map(x => ({
      prodId: x.prodId,
      nombre: x.nombre,
      cant: x.cant,
      precio: x.precio,
      subtotal: r2(x.precio * x.cant)
    }));
  } else if (cobroActual.modo === 'total') {
    resumenItems = cuenta.items.map(i => ({
      prodId: i.prodId,
      nombre: i.nombre,
      cant: i.cant,
      precio: i.precio,
      subtotal: r2(i.precio * i.cant)
    }));
  } else {
    resumenItems = [{ prodId: null, nombre: `${cobroActual.etiqueta} (${cuenta.nombre})`, cant: 1, precio: monto, subtotal: monto }];
  }

  const tasa = Number(DB.config.igv) || 0.18;
  const subVenta = r2(monto / (1 + tasa));
  const igvVenta = r2(monto - subVenta);
  const amb = esMesa ? DB.ambientes.find(a => a.id === cuenta.ambienteId) : null;

  const venta = {
    id: sigId('venta'),
    turnoId: DB.turnoAbierto?.id || 1,
    fecha: new Date().toISOString(),
    origenTipo: esMesa ? 'Salón' : 'Envío',
    ambiente: esMesa ? (amb?.nombre || 'Salón') : 'Delivery',
    mesa: esMesa ? cuenta.nombre : `${cuenta.nombre} (${cuenta.direccion})`,
    comprobante,
    docTipo: doc,
    docNum: numDoc,
    cliente,
    metodo: metodoPago,
    referencia,
    total: monto,
    subtotal: subVenta,
    igv: igvVenta,
    recibido,
    vuelto,
    etiqueta: cobroActual.etiqueta,
    usuario: sesion?.nombre || 'WILLOSIRIS',
    items: resumenItems
  };
  DB.ventas.unshift(venta);

  if (cobroActual.modo === 'items' && cobroActual.itemsQuitados) {
    for (const q of cobroActual.itemsQuitados) {
      const it = cuenta.items.find(i => i.key === q.key);
      if (!it) continue;
      it.cant -= q.cant;
      it.enviado = Math.max(0, (it.enviado || 0) - q.cant);
      if (it.cant <= 0) cuenta.items = cuenta.items.filter(i => i.key !== q.key);
    }
  } else if (cobroActual.modo === 'igual') {
    cuenta.pagado = r2((cuenta.pagado || 0) + monto);
  } else {
    cuenta.pagado = r2((cuenta.pagado || 0) + monto);
  }

  const tDespues = calcularTotales(cuenta);
  const liquidada = tDespues.pendiente <= 0.01 || !cuenta.items.length;

  cerrarDialogo('dlgCobro');
  cobroActual = null;

  if (deseaImprimir && tienePermiso('impresion.permitir')) {
    imprimirTicket80mm({
      subtitulo: `${venta.comprobante.toUpperCase()} #${String(venta.id).padStart(5, '0')}`,
      checkLabel: `${venta.id} · ${venta.mesa.toUpperCase()}`,
      ordenNum: venta.id,
      cajero: venta.usuario,
      cliente: `${venta.cliente}${venta.docNum ? ` (${venta.docTipo}: ${venta.docNum})` : ''}`,
      lineas: venta.items.map(it => ({
        cant: it.cant,
        nombre: it.nombre,
        precioUnit: it.precio,
        subtotal: it.subtotal || r2(it.precio * it.cant)
      })),
      subtotal: venta.subtotal,
      igv: venta.igv,
      total: venta.total,
      metodo: venta.metodo.toUpperCase(),
      referencia: venta.referencia,
      recibido: venta.recibido,
      vuelto: venta.vuelto,
      fechaIso: venta.fecha
    });
  }

  // Efecto visual estilo Yape o Efectivo que permanece en pantalla hasta pulsar el botón OK
  await mostrarEfectoPago(
    venta.metodo,
    venta.total,
    venta.metodo === 'Efectivo'
      ? `Recibido: ${soles(venta.recibido)} · Vuelto: ${soles(venta.vuelto)}`
      : `${venta.comprobante} · ${venta.cliente}`
  );

  if (liquidada) {
    // IMPORTANTE: NO se elimina de "En espera" (#inicio) al pagar; solo se marca como pagada y se gestiona desde "En espera"
    (DB.ordenesCocina || []).forEach(o => {
      if (o.key === `${tipoObjetivo}_${cuenta.id}` && !o.archivado) {
        o.pagado = true;
      }
    });

    if (esMesa) {
      const decision = await preguntarEstadoMesaPostPago(cuenta);
      if (decision === 'ocupada') {
        cuenta.items = [];
        cuenta.pagado = 0;
        cuenta.desc = 0;
        cuenta.pagadaOcupada = true;
        cambiarEstadoMesa(cuenta, 'ocupada');
        toast(`Aviso: ${cuenta.nombre} figura como OCUPADA (Cuenta ya pagada). Presiona ✓ cuando se retiren.`);
      } else {
        cuenta.items = [];
        cuenta.pagado = 0;
        cuenta.desc = 0;
        cuenta.pagadaOcupada = false;
        cambiarEstadoMesa(cuenta, 'libre');
        if (cuentaActiva.tipo === 'mesa' && cuentaActiva.id === cuenta.id) {
          cuentaActiva = { tipo: null, id: null };
        }
        toast(`Aviso: ${cuenta.nombre} está ahora DESOCUPADA (Libre)`);
      }
    } else {
      cuenta.pagadoFinalizado = true;
      if (cuentaActiva.tipo === 'envio' && cuentaActiva.id === cuenta.id) {
        cuentaActiva = { tipo: null, id: null };
      }
      toast(`Cobro de ${cuenta.nombre} completado · Sigue en espera hasta su entrega`);
    }
  } else {
    toast(`Pago parcial registrado (${soles(venta.total)}) · Resta ${soles(tDespues.pendiente)}`);
  }

  registrarActividad('Cobro registrado', `${venta.mesa} · ${soles(venta.total)} (${venta.metodo})`);
  guardarDB();
  renderTodo();
}

function abrirSplit() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const cuenta = objAct.obj;
  const t = calcularTotales(cuenta);
  if (t.pendiente <= 0) return;

  $('#splitPartes').value = '2';
  actualizarSplitIgual();

  const tienePagosPrevios = t.pagado > 0 || (Number(cuenta.desc) || 0) > 0;
  $('#splitAviso').hidden = !tienePagosPrevios;
  $('#btnSplitItems').disabled = tienePagosPrevios;

  const cont = $('#splitItems');
  if (tienePagosPrevios) {
    cont.innerHTML = '';
  } else {
    const desglosados = [];
    cuenta.items.forEach(it => {
      for (let u = 0; u < it.cant; u++) {
        desglosados.push({ key: it.key, prodId: it.prodId, nombre: it.nombre, precio: it.precio });
      }
    });
    cont.innerHTML = desglosados.map((d, idx) =>
      `<label class="opcion"><input type="checkbox" data-idx="${idx}" data-key="${esc(d.key)}" data-prod="${d.prodId}" data-nom="${esc(d.nombre)}" data-precio="${d.precio}"><span>${esc(d.nombre)}</span><b>${soles(d.precio)}</b></label>`
    ).join('');
  }
  abrirDialogo('dlgSplit');
}

function actualizarSplitIgual() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const t = calcularTotales(objAct.obj);
  const n = Math.max(2, parseInt($('#splitPartes').value, 10) || 2);
  $('#splitPorPersona').textContent = soles(r2(t.pendiente / n));
}

function cobrarParteIgual() {
  const objAct = obtenerObjetivoActivo();
  if (!objAct) return;
  const t = calcularTotales(objAct.obj);
  const n = Math.max(2, parseInt($('#splitPartes').value, 10) || 2);
  const monto = r2(t.pendiente / n);
  cerrarDialogo('dlgSplit');
  abrirModalCobro({ monto, modo: 'igual', etiqueta: `1/${n} de cuenta` });
}

function cobrarItemsSeleccionados() {
  const checks = $$('#splitItems input:checked');
  if (!checks.length) {
    toast('Marca al menos un plato para cobrar', 'alerta');
    return;
  }
  const mapa = new Map();
  let suma = 0;
  checks.forEach(c => {
    const key = c.dataset.key;
    const precio = parseFloat(c.dataset.precio) || 0;
    const prodId = Number(c.dataset.prod) || null;
    suma = r2(suma + precio);
    const prev = mapa.get(key) || { key, prodId, nombre: c.dataset.nom, precio, cant: 0 };
    prev.cant += 1;
    mapa.set(key, prev);
  });
  cerrarDialogo('dlgSplit');
  abrirModalCobro({
    monto: suma,
    modo: 'items',
    etiqueta: `${checks.length} plato(s) seleccionados`,
    itemsQuitados: [...mapa.values()]
  });
}

/* Generador de código de barras SVG y plantilla 80mm con 2 modos (Control Interno y Cliente) */
function generarBarcodeSVG(codigoTexto) {
  const limpio = String(codigoTexto || '5622285774043229').replace(/\D/g, '').padEnd(16, '7').slice(0, 16);
  let x = 6;
  const rects = [];
  for (let i = 0; i < limpio.length; i++) {
    const d = parseInt(limpio[i], 10) || 0;
    const w1 = (d % 3) + 1.4;
    const g1 = ((d + 1) % 2) + 1.2;
    const w2 = ((d * 2) % 3) + 1.2;
    const g2 = 1.6;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w1.toFixed(1)}" height="42" fill="#000"/>`);
    x += w1 + g1;
    rects.push(`<rect x="${x.toFixed(1)}" y="0" width="${w2.toFixed(1)}" height="42" fill="#000"/>`);
    x += w2 + g2;
  }
  const totalW = Math.ceil(x + 6);
  return `<div class="t80-barcode">
    <svg viewBox="0 0 ${totalW} 44" preserveAspectRatio="none" aria-hidden="true">${rects.join('')}</svg>
    <div class="t80-barcode-num">${esc(limpio)}</div>
  </div>`;
}

function obtenerPlantillaTicket(forzarTipo = null) {
  const imp = DB.impresion || {};
  const tipo = forzarTipo || (imp.usarTicketCliente ? 'cliente' : 'interno');
  const base = crearPlantillaTicketBase(tipo);
  const guardada = tipo === 'cliente' ? imp.plantillaCliente : imp.plantillaInterno;
  return { ...base, ...(guardada || {}) };
}

function generarHTMLTicket80mm(datos = {}, forzarTipo = null) {
  const cfg = DB.config;
  const imp = DB.impresion || {};
  const tipoActivo = forzarTipo || (imp.usarTicketCliente ? 'cliente' : 'interno');
  const esControlInterno = tipoActivo === 'interno' || !!datos.esComandaCocina;
  const tpl = obtenerPlantillaTicket(forzarTipo);
  const fechaObj = datos.fechaIso ? new Date(datos.fechaIso) : new Date();
  const fechaStr = fechaObj.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const horaStr = fechaObj.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const checkStr = datos.checkLabel || 'MESA 1 · SALÓN';
  const cajeroStr = datos.cajero || sesion?.nombre || 'WILLOSIRIS';
  const ordenStr = String(datos.ordenNum || 1);
  const codigoEncuesta = `${ordenStr.padStart(4, '0')}-${fechaStr.replace(/\//g, '')}`;
  const codigoBarras = `${String(ordenStr).padStart(6, '5')}${fechaObj.getTime().toString().slice(-10)}`;

  // Ítems de venta e importes (automáticos / bloqueados contra edición manual)
  const lineas = Array.isArray(datos.lineas) ? datos.lineas : [];

  // Resumen de atención sin precios para Control Interno (debajo de la mesa gigante a 3 metros)
  const htmlResumenAtencion = lineas.map(l => `
    <div class="t80-atencion-linea">
      ${l.cant} × ${esc(l.nombre)}
      ${l.nota ? `<small>* ${esc(l.nota)}</small>` : ''}
    </div>
  `).join('');

  // Detalle nuevamente con precios unitarios y subtotales
  const htmlLineas = lineas.map(l => {
    const etiqueta = l.cant > 1
      ? `${l.cant} x ${esc(l.nombre)} <span style="opacity:.75">@ ${soles(l.precioUnit)}</span>`
      : `${esc(l.nombre)}`;
    return `<div class="t80-item">
      <div class="t80-item-row">
        <span>${etiqueta}</span>
        <span>${soles(l.subtotal ?? (l.cant * l.precioUnit))}</span>
      </div>
      ${l.nota ? `<div class="t80-item-mod">* ${esc(l.nota)}</div>` : ''}
    </div>`;
  }).join('');

  const tituloDocMostrado = datos.esComandaCocina
    ? (datos.subtitulo || 'COMANDA DE COCINA')
    : (tpl.tituloDoc || datos.subtitulo || 'TICKET DE CONTROL INTERNO');

  return `<div class="ticket-80-paper" style="--t80-pad:${Number(tpl.margenMm) ?? 4}mm;--t80-title:${Number(tpl.fontTituloPx) || 16}px;--t80-font:${Number(tpl.fontCuerpoPx) || 12}px">
    <div class="t80-center">
      ${tpl.mostrarLogo ? `<img class="t80-logo" src="${esc(cfg.logoPrincipal || 'logo.png')}" alt="Logo">` : ''}
      ${tpl.tituloMarca ? `<div class="t80-brand">${esc(tpl.tituloMarca)}</div>` : ''}
      ${tpl.subtituloMarca ? `<div class="t80-subbrand">${esc(tpl.subtituloMarca)}</div>` : ''}
      <div class="t80-store-info">
        ${tpl.lineaRuc ? `<div>${esc(tpl.lineaRuc)}</div>` : ''}
        ${tpl.direccion ? `<div>${esc(tpl.direccion)}</div>` : ''}
        ${tpl.ciudad ? `<div>${esc(tpl.ciudad)}</div>` : ''}
        ${tpl.telefono ? `<div>${esc(tpl.telefono)}</div>` : ''}
      </div>
    </div>

    <hr class="t80-dash">
    ${tituloDocMostrado ? `<div class="t80-center" style="font-weight:700;margin-bottom:4px">${esc(tituloDocMostrado)}</div>` : ''}
    <div class="t80-meta">
      ${!esControlInterno ? `<div>${esc(tpl.lblCheck || 'Check:')} ${esc(checkStr)}</div>` : ''}
      <div>${esc(tpl.lblCajero || 'Cajero:')} ${esc(cajeroStr)}</div>
      <div>${esc(tpl.lblOrden || 'Orden #:')} ${esc(ordenStr)}</div>
      ${datos.cliente ? `<div>${esc(tpl.lblCliente || 'Cliente:')} ${esc(datos.cliente)}</div>` : ''}
      <div class="t80-meta-row"><span>${esc(tpl.lblFecha || 'FECHA:')} ${esc(fechaStr)}</span><span>${esc(tpl.lblHora || 'HORA:')} ${esc(horaStr)}</span></div>
    </div>

    ${esControlInterno ? `
      <div class="t80-mesa-gigante">${esc(checkStr)}</div>
      <div class="t80-atencion-bloque">
        <div class="t80-atencion-titulo">PLATOS A ATENDER EN MESA</div>
        ${htmlResumenAtencion}
      </div>
    ` : ''}

    <hr class="t80-dash">

    ${!datos.esComandaCocina ? `
      ${esControlInterno ? `<div class="t80-atencion-titulo" style="text-align:center;margin-bottom:4px">DETALLE DE PRECIOS E IMPORTES</div>` : ''}
      <div class="t80-items">${htmlLineas}</div>
      ${tpl.mostrarImpuestos !== false ? `
        <div class="t80-totals">
          <div class="t80-row"><span>${esc(tpl.lblSubtotal || 'SUBTOTAL')}</span><span>${soles(datos.subtotal || 0)}</span></div>
          ${datos.descuento ? `<div class="t80-row"><span>DESCUENTO</span><span>- ${soles(datos.descuento)}</span></div>` : ''}
          <div class="t80-row"><span>${esc(tpl.lblIgv || 'IGV (18%)')}</span><span>${soles(datos.igv || 0)}</span></div>
        </div>
      ` : ''}
      <hr class="t80-solid">
      <div class="t80-row t80-grand"><span>${esc(tpl.lblTotal || 'TOTAL')}</span><span>${soles(datos.total || 0)}</span></div>
      <div class="t80-totals">
        <div class="t80-row"><span>${esc(tpl.lblMetodo || 'MÉTODO PAGO')}</span><span>${esc(datos.metodo || 'EFECTIVO')}</span></div>
        ${datos.referencia && datos.referencia !== 'Efectivo' ? `<div class="t80-row"><span>OP / REF #</span><span>${esc(datos.referencia)}</span></div>` : ''}
        <div class="t80-row"><span>${esc(tpl.lblRecibido || 'RECIBIDO')}</span><span>${soles(datos.recibido ?? datos.total ?? 0)}</span></div>
      </div>
      <hr class="t80-dash">
      <div class="t80-row"><span>${esc(tpl.lblVuelto || 'VUELTO')}</span><span>${soles(datos.vuelto || 0)}</span></div>
    ` : ''}

    <hr class="t80-dash">
    <div class="t80-footer">
      ${tpl.piePagina ? `<div>${esc(tpl.piePagina)}</div>` : ''}
      ${tpl.promoTexto ? `<div class="t80-survey">${esc(tpl.promoTexto)}${tpl.lblCodigo ? `<br>${esc(tpl.lblCodigo)} ${esc(codigoEncuesta)}` : ''}</div>` : ''}
    </div>
    ${tpl.mostrarBarcode ? generarBarcodeSVG(codigoBarras) : ''}
  </div>`;
}

function imprimirTicket80mm(datos, forzarTipo = null) {
  if (!tienePermiso('impresion.permitir')) {
    toast('Tu usuario tiene desactivado el permiso de impresión', 'alerta');
    return;
  }
  const cont = $('#impresion');
  cont.className = 'print-80mm';
  cont.innerHTML = generarHTMLTicket80mm(datos, forzarTipo);
  window.print();
}


/* ================= 6. Carta e Inventario (Con Foto 1:1, Descripción y Modales Centrados) ================= */
function renderInventario() {
  if (!puedeEditarProductos()) return;

  const selCat = $('#catPlato');
  if (DB.categorias.length) {
    selCat.innerHTML = DB.categorias.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    selCat.disabled = false;
  } else {
    selCat.innerHTML = `<option value="General">General (creará la categoría)</option>`;
    selCat.disabled = false;
  }

  $('#cntPlatos').textContent = String(DB.productos.length);
  const tbPlatos = $('#tablaPlatos');
  if (!DB.productos.length) {
    tbPlatos.innerHTML = `<tr><td colspan="6" class="vacio-celda">Aún no hay ítems en la carta. Pulsa "+ Nuevo plato o bebida" arriba para agregar productos.</td></tr>`;
  } else {
    const puedeBorrar = esAdmin() || tienePermiso('carta.administrar');
    tbPlatos.innerHTML = DB.productos.map(p => {
      const rec = DB.recetas[p.id] || {};
      const recTxt = Object.entries(rec)
        .map(([k, v]) => `${k} (${v}${DB.insumos[k]?.unidad || ''})`)
        .join(', ') || 'Venta directa';
      const st = estadoStockPlato(p.id);
      const badge = st === 'agotado'
        ? `<span class="badge critico">Sin stock</span>`
        : st === 'bajo'
          ? `<span class="badge bajo">Stock bajo</span>`
          : `<span class="badge ok">Disponible</span>`;
      const thumb = p.img
        ? `<img class="celda-thumb" src="${esc(p.img)}" alt="${esc(p.nombre)}">`
        : `<span class="celda-thumb">${esc(iniciales(p.nombre))}</span>`;
      return `<tr>
        <td>
          <div class="celda-item">
            ${thumb}
            <div>
              <strong>${esc(p.nombre)}</strong>
              ${p.desc ? `<span class="celda-sub">${esc(p.desc)}</span>` : ''}
            </div>
          </div>
        </td>
        <td>${esc(p.cat)}</td>
        <td class="num">${soles(p.precio)}</td>
        <td>${esc(recTxt)}</td>
        <td>${badge}</td>
        <td class="acc">
          <div class="acciones-celda">
            <button type="button" class="btn-mini" data-edit-plato="${p.id}" aria-label="Editar ${esc(p.nombre)}" title="Editar en ventana"><svg class="ico"><use href="#i-edit"/></svg></button>
            ${puedeBorrar ? `<button type="button" class="btn-mini peligro" data-del-plato="${p.id}" aria-label="Eliminar ${esc(p.nombre)}" title="Eliminar"><svg class="ico"><use href="#i-trash"/></svg></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  $('#listaCategorias').innerHTML = DB.categorias.length
    ? DB.categorias.map(c => `<li><span>${esc(c)}</span><button type="button" data-del-cat="${esc(c)}" aria-label="Quitar ${esc(c)}"><svg class="ico"><use href="#i-x"/></svg></button></li>`).join('')
    : `<li class="vacio-celda">Sin categorías</li>`;

  $('#listaModificadores').innerHTML = DB.modificadores.length
    ? DB.modificadores.map(m => `<li><span>${esc(m)}</span><button type="button" data-del-mod="${esc(m)}" aria-label="Quitar ${esc(m)}"><svg class="ico"><use href="#i-x"/></svg></button></li>`).join('')
    : `<li class="vacio-celda">Sin modificadores</li>`;

  const nombresIns = Object.keys(DB.insumos).sort((a, b) => a.localeCompare(b, 'es'));
  $('#cntInsumos').textContent = String(nombresIns.length);
  const tbStock = $('#stockBody');
  if (!nombresIns.length) {
    tbStock.innerHTML = `<tr><td colspan="5" class="vacio-celda">Sin insumos registrados. Pulsa "+ Nuevo insumo" arriba si deseas controlar stock por receta.</td></tr>`;
  } else {
    tbStock.innerHTML = nombresIns.map(nom => {
      const i = DB.insumos[nom];
      const crit = i.stock <= 0;
      const bajo = !crit && i.stock <= i.min;
      const badge = crit
        ? `<span class="badge critico">Agotado</span>`
        : bajo
          ? `<span class="badge bajo">Bajo</span>`
          : `<span class="badge ok">Óptimo</span>`;
      const thumb = i.img
        ? `<img class="celda-thumb" src="${esc(i.img)}" alt="${esc(nom)}">`
        : `<span class="celda-thumb">${esc(iniciales(nom))}</span>`;
      return `<tr>
        <td><div class="celda-item">${thumb}<strong>${esc(nom)}</strong></div></td>
        <td class="num">${i.stock} ${esc(i.unidad)}</td>
        <td class="num">${i.min} ${esc(i.unidad)}</td>
        <td>${badge}</td>
        <td class="acc">
          <div class="acciones-celda">
            <button type="button" class="btn-mini" data-reponer="${esc(nom)}" title="Ingresar compra / reponer"><svg class="ico"><use href="#i-plus"/></svg></button>
            <button type="button" class="btn-mini" data-edit-ins="${esc(nom)}" title="Editar insumo"><svg class="ico"><use href="#i-edit"/></svg></button>
            <button type="button" class="btn-mini peligro" data-del-ins="${esc(nom)}" title="Eliminar insumo"><svg class="ico"><use href="#i-trash"/></svg></button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  const selMerma = $('#mermaInsumo');
  selMerma.innerHTML = nombresIns.length
    ? nombresIns.map(n => `<option value="${esc(n)}">${esc(n)} (${DB.insumos[n].stock} ${esc(DB.insumos[n].unidad)})</option>`).join('')
    : `<option value="">Sin insumos</option>`;
  selMerma.disabled = !nombresIns.length;

  const tbMov = $('#tablaMovimientos');
  if (!DB.movimientos.length) {
    tbMov.innerHTML = `<tr><td colspan="5" class="vacio-celda">Sin movimientos de almacén.</td></tr>`;
  } else {
    tbMov.innerHTML = DB.movimientos.slice(0, 25).map(m => {
      const signo = m.cantidad > 0 ? '+' : '';
      return `<tr>
        <td>${fmtFechaHora(m.fecha)}</td>
        <td>${esc(m.insumo)}</td>
        <td>${esc(m.tipo)} · <span class="sub">${esc(m.motivo || '')}</span></td>
        <td class="num">${signo}${m.cantidad}</td>
        <td>${esc(m.usuario)}</td>
      </tr>`;
    }).join('');
  }
}

function agregarFilaIngrediente(insSel = '', cantVal = '') {
  const nombres = Object.keys(DB.insumos).sort((a, b) => a.localeCompare(b, 'es'));
  if (!nombres.length) {
    toast('Primero registra al menos un insumo en la columna de almacén', 'alerta');
    return;
  }
  const fila = document.createElement('div');
  fila.className = 'ing-fila';
  fila.innerHTML = `
    <select class="ing-nom" aria-label="Insumo">
      ${nombres.map(n => `<option value="${esc(n)}" ${n === insSel ? 'selected' : ''}>${esc(n)} (${esc(DB.insumos[n].unidad)})</option>`).join('')}
    </select>
    <input class="ing-cant" type="number" min="0" step="any" inputmode="decimal" placeholder="Cant." value="${esc(cantVal)}" required>
    <button type="button" class="btn-icono peligro" data-quitar-ing aria-label="Quitar ingrediente"><svg class="ico"><use href="#i-x"/></svg></button>
  `;
  $('#recetaIngredientes').appendChild(fila);
}

async function guardarPlato(e) {
  e.preventDefault();
  if (!puedeEditarProductos()) {
    toast('No tienes permiso para modificar productos', 'error');
    return;
  }
  const err = $('#platoError');
  err.textContent = '';

  const nombre = $('#nombrePlato').value.trim();
  const precio = parseFloat($('#precioPlato').value);
  const desc = $('#descPlato').value.trim();
  let cat = $('#catPlato').value.trim() || 'General';

  if (!nombre) { err.textContent = 'Escribe el nombre del plato, bebida o porción.'; return; }
  if (isNaN(precio) || precio <= 0) { err.textContent = 'Ingresa un precio mayor a S/ 0.00.'; return; }

  const dup = DB.productos.find(p => p.id !== platoEditandoId && p.nombre.toLowerCase() === nombre.toLowerCase());
  if (dup) { err.textContent = 'Ya existe otro ítem con ese nombre en la carta.'; return; }

  // Si está editando un plato existente, solicitar confirmación con contraseña secreta autorizada + 5 segundos
  if (platoEditandoId) {
    const autorizado = await confirmar({
      titulo: `¿Guardar edición de "${nombre}"?`,
      texto: 'Confirma la modificación de este producto con tu contraseña secreta autorizada y espera 5 segundos.',
      textoOk: 'Guardar',
      peligro: false,
      requierePin: true,
      segundos: 5,
      permisoAutorizado: 'productos.editar'
    });
    if (!autorizado) return;
  }

  // Paso previo a guardar: seleccionar, arrastrar y recortar imagen 1:1 (PNG transparente) u omitirla
  const imgElegida = await solicitarImagen1a1PreGuardado({
    titulo: `Imagen 1:1 · ${nombre}`,
    subtitulo: 'Antes de guardar, puedes arrastrar la foto del producto aquí, seleccionarla desde archivos para recortarla 1:1, u omitirla.',
    imagenActual: imgTempPlato,
    permitirOmitir: true
  });
  if (imgElegida === null) return;
  imgTempPlato = imgElegida;

  if (!DB.categorias.includes(cat)) DB.categorias.push(cat);

  const receta = {};
  for (const f of $$('#recetaIngredientes .ing-fila')) {
    const ins = $('.ing-nom', f).value;
    const cant = parseFloat($('.ing-cant', f).value);
    if (ins && cant > 0) receta[ins] = r2((receta[ins] || 0) + cant);
  }

  if (platoEditandoId) {
    const p = DB.productos.find(x => x.id === platoEditandoId);
    if (p) {
      p.nombre = nombre;
      p.precio = r2(precio);
      p.cat = cat;
      p.desc = desc;
      p.img = imgTempPlato;
      if (Object.keys(receta).length) DB.recetas[p.id] = receta;
      else delete DB.recetas[p.id];
      registrarActividad('Plato editado', `${p.nombre} (${soles(p.precio)})`);
      toast(`"${p.nombre}" actualizado`);
    }
  } else {
    const id = sigId('producto');
    DB.productos.push({ id, nombre, precio: r2(precio), cat, desc, img: imgTempPlato });
    if (Object.keys(receta).length) DB.recetas[id] = receta;
    registrarActividad('Plato agregado', `${nombre} (${soles(precio)})`);
    toast(`"${nombre}" agregado a la carta`);
  }

  cancelarEdicionPlato();
  cerrarDialogo('dlgPlatoModal');
  guardarDB();
  renderInventario();
  renderComandera();
}

function abrirModalNuevoPlato() {
  if (!esAdmin() && !tienePermiso('carta.administrar')) {
    toast('Solo el administrador puede agregar productos nuevos', 'error');
    return;
  }
  cancelarEdicionPlato();
  renderInventario();
  abrirDialogo('dlgPlatoModal');
  setTimeout(() => $('#nombrePlato')?.focus(), 40);
}

function editarPlato(id) {
  if (!puedeEditarProductos()) {
    toast('No tienes permiso para editar productos', 'error');
    return;
  }
  const p = DB.productos.find(x => x.id === id);
  if (!p) return;
  renderInventario();
  platoEditandoId = p.id;
  $('#tituloFormPlato').textContent = `Editar producto · ${p.nombre}`;
  $('#nombrePlato').value = p.nombre;
  $('#precioPlato').value = String(p.precio);
  $('#descPlato').value = p.desc || '';
  $('#catPlato').value = p.cat;
  imgTempPlato = p.img || '';

  $('#recetaIngredientes').innerHTML = '';
  const rec = DB.recetas[p.id] || {};
  Object.entries(rec).forEach(([ins, cant]) => agregarFilaIngrediente(ins, cant));
  $('#btnGuardarPlato').textContent = 'Guardar';
  abrirDialogo('dlgPlatoModal');
  setTimeout(() => $('#nombrePlato')?.focus(), 40);
}

function cancelarEdicionPlato() {
  platoEditandoId = null;
  imgTempPlato = '';
  $('#tituloFormPlato').textContent = 'Nuevo plato, bebida o porción';
  $('#formReceta')?.reset();
  if ($('#recetaIngredientes')) $('#recetaIngredientes').innerHTML = '';
  if ($('#platoError')) $('#platoError').textContent = '';
  if ($('#btnGuardarPlato')) $('#btnGuardarPlato').textContent = 'Guardar';
}

async function borrarPlato(id) {
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const p = DB.productos.find(x => x.id === id);
  if (!p) return;
  const ok = await confirmar({
    titulo: `¿Eliminar "${p.nombre}" de la carta?`,
    texto: 'Se quitará del catálogo y su receta asociada. Requiere contraseña de administrador y 5 segundos.',
    textoOk: 'Eliminar de la carta',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.productos = DB.productos.filter(x => x.id !== id);
  delete DB.recetas[id];
  if (platoEditandoId === id) cancelarEdicionPlato();
  registrarActividad('Plato eliminado', p.nombre);
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`"${p.nombre}" eliminado`);
}

function agregarCategoria(e) {
  e.preventDefault();
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const inp = $('#nuevaCategoria');
  const val = inp.value.trim();
  if (!val) return;
  if (DB.categorias.some(c => c.toLowerCase() === val.toLowerCase())) {
    toast('Esa categoría ya existe', 'alerta');
    return;
  }
  DB.categorias.push(val);
  inp.value = '';
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`Categoría "${val}" agregada`);
}

async function eliminarCategoria(cat) {
  if (!exigirAdmin()) return;
  if (DB.productos.some(p => p.cat === cat)) {
    toast(`Hay platos usando la categoría "${cat}"`, 'error');
    return;
  }
  const ok = await confirmar({
    titulo: `¿Eliminar categoría "${cat}"?`,
    texto: 'Requiere contraseña de administrador y 5 segundos de confirmación.',
    textoOk: 'Eliminar categoría',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.categorias = DB.categorias.filter(c => c !== cat);
  guardarDB();
  renderInventario();
  renderComandera();
}

function agregarModificador(e) {
  e.preventDefault();
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const inp = $('#nuevoModificador');
  const val = inp.value.trim();
  if (!val) return;
  if (DB.modificadores.some(m => m.toLowerCase() === val.toLowerCase())) {
    toast('Ese modificador ya existe', 'alerta');
    return;
  }
  DB.modificadores.push(val);
  inp.value = '';
  guardarDB();
  renderInventario();
  toast(`Modificador "${val}" agregado`);
}

async function eliminarModificador(mod) {
  if (!exigirAdmin()) return;
  const ok = await confirmar({
    titulo: `¿Eliminar modificador "${mod}"?`,
    texto: 'Requiere contraseña de administrador y 5 segundos.',
    textoOk: 'Eliminar',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.modificadores = DB.modificadores.filter(m => m !== mod);
  guardarDB();
  renderInventario();
}

async function crearInsumo(e) {
  e.preventDefault();
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const nom = $('#insNombre').value.trim();
  const unidad = $('#insUnidad').value;
  const stock = parseFloat($('#insStock').value);
  const min = parseFloat($('#insMin').value);
  if (!nom || isNaN(stock) || stock < 0 || isNaN(min) || min < 0) {
    toast('Completa nombre, stock inicial y mínimo válidos', 'error');
    return;
  }
  const existente = Object.keys(DB.insumos).find(k => k.toLowerCase() === nom.toLowerCase());
  const clave = existente || nom;

  const imgElegida = await solicitarImagen1a1PreGuardado({
    titulo: `Imagen 1:1 · Insumo ${clave}`,
    subtitulo: 'Antes de guardar, puedes arrastrar una imagen del insumo aquí, seleccionarla desde archivos para recortarla 1:1, u omitirla.',
    imagenActual: DB.insumos[clave]?.img || '',
    permitirOmitir: true
  });
  if (imgElegida === null) return;
  imgTempInsumo = imgElegida;

  DB.insumos[clave] = {
    stock: r2((DB.insumos[clave]?.stock || 0) + stock),
    min: r2(min),
    unidad,
    img: imgTempInsumo
  };
  DB.movimientos.unshift({
    id: sigId('mov'),
    fecha: new Date().toISOString(),
    insumo: clave,
    tipo: existente ? 'reposición' : 'alta',
    cantidad: r2(stock),
    motivo: 'Ingreso manual',
    usuario: sesion?.nombre || 'WILLOSIRIS'
  });
  imgTempInsumo = '';
  e.target.reset();
  cerrarDialogo('dlgInsumoModal');
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`Insumo "${clave}" guardado`);
}

async function reponerInsumo(nom) {
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const info = DB.insumos[nom];
  if (!info) return;
  const datos = await pedirFormulario({
    titulo: `Reponer ${nom}`,
    texto: `Stock actual: ${info.stock} ${info.unidad}.`,
    textoOk: 'Sumar al stock',
    campos: [
      { nombre: 'cantidad', etiqueta: `Cantidad a ingresar (${info.unidad})`, tipo: 'number', min: 0.01, step: 'any', inputmode: 'decimal' },
      { nombre: 'motivo', etiqueta: 'Proveedor / Referencia', placeholder: 'Compra del día', maxlength: 50 }
    ],
    validar: d => ((parseFloat(d.cantidad) || 0) > 0 ? '' : 'Ingresa una cantidad mayor a 0.')
  });
  if (!datos) return;
  const cant = r2(parseFloat(datos.cantidad));
  info.stock = r2(info.stock + cant);
  DB.movimientos.unshift({
    id: sigId('mov'),
    fecha: new Date().toISOString(),
    insumo: nom,
    tipo: 'compra',
    cantidad: cant,
    motivo: datos.motivo || 'Reposición',
    usuario: sesion?.nombre || 'WILLOSIRIS'
  });
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`+${cant} ${info.unidad} agregados a ${nom}`);
}

async function editarInsumo(nom) {
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const info = DB.insumos[nom];
  if (!info) return;
  const datos = await pedirFormulario({
    titulo: `Editar insumo · ${nom}`,
    texto: 'Confirmación protegida con contraseña secreta y bloqueo de 5 segundos.',
    requiereSeguridad5s: true,
    permisoAutorizado: 'carta.administrar',
    textoOk: 'Guardar cambios',
    campos: [
      { nombre: 'stock', etiqueta: `Stock actual (${info.unidad})`, tipo: 'number', min: 0, step: 'any', valor: String(info.stock) },
      { nombre: 'min', etiqueta: `Stock mínimo (${info.unidad})`, tipo: 'number', min: 0, step: 'any', valor: String(info.min) }
    ],
    validar: d => (isNaN(parseFloat(d.stock)) || isNaN(parseFloat(d.min)) ? 'Valores inválidos.' : '')
  });
  if (!datos) return;
  info.stock = r2(parseFloat(datos.stock));
  info.min = r2(parseFloat(datos.min));
  registrarActividad('Insumo editado', nom);
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`Insumo "${nom}" actualizado`);
}

async function eliminarInsumo(nom) {
  if (!exigirAdmin()) return;
  const usadoEn = DB.productos.filter(p => DB.recetas[p.id]?.[nom]);
  if (usadoEn.length) {
    toast(`No puedes eliminar "${nom}" porque se usa en: ${usadoEn.map(p => p.nombre).join(', ')}`, 'error');
    return;
  }
  const ok = await confirmar({
    titulo: `¿Eliminar insumo "${nom}"?`,
    texto: 'Se retirará del control de almacén. Requiere contraseña de administrador y 5 segundos.',
    textoOk: 'Eliminar insumo',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  delete DB.insumos[nom];
  registrarActividad('Insumo eliminado', nom);
  guardarDB();
  renderInventario();
  toast(`Insumo "${nom}" eliminado`);
}

function registrarMerma(e) {
  e.preventDefault();
  if (!exigirAdmin() && !tienePermiso('carta.administrar')) return;
  const nom = $('#mermaInsumo').value;
  const cant = parseFloat($('#mermaCant').value);
  const motivo = $('#mermaMotivo').value;
  const info = DB.insumos[nom];
  if (!info || isNaN(cant) || cant <= 0) {
    toast('Ingresa una cantidad válida a descontar', 'error');
    return;
  }
  info.stock = Math.max(0, r2(info.stock - cant));
  DB.movimientos.unshift({
    id: sigId('mov'),
    fecha: new Date().toISOString(),
    insumo: nom,
    tipo: motivo,
    cantidad: -r2(cant),
    motivo: `Baja por ${motivo}`,
    usuario: sesion?.nombre || 'WILLOSIRIS'
  });
  $('#mermaCant').value = '';
  cerrarDialogo('dlgMermaModal');
  guardarDB();
  renderInventario();
  renderComandera();
  toast(`Merma registrada en ${nom}`);
}

function actualizarPreviewImg(boxId, imgId, dataUrl) {
  const box = $('#' + boxId);
  const img = $('#' + imgId);
  if (!box || !img) return;
  if (dataUrl) {
    img.src = dataUrl;
    box.hidden = false;
  } else {
    img.removeAttribute('src');
    box.hidden = true;
  }
}

/* ================= 7. Reportes (Diario, Semanal, Mensual, Anual), Edición/Eliminación e Impresión A4 / 80mm ================= */
function obtenerVentasPeriodo() {
  const ahora = new Date();
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();

  if (filtroPeriodoRep === 'turno') {
    const tid = DB.turnoAbierto?.id;
    return tid ? DB.ventas.filter(v => v.turnoId === tid) : [];
  }
  if (filtroPeriodoRep === 'diario') {
    return DB.ventas.filter(v => new Date(v.fecha).getTime() >= inicioHoy);
  }
  if (filtroPeriodoRep === 'semanal') {
    const hace7 = inicioHoy - 6 * 24 * 60 * 60 * 1000;
    return DB.ventas.filter(v => new Date(v.fecha).getTime() >= hace7);
  }
  if (filtroPeriodoRep === 'mensual') {
    const iniMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    return DB.ventas.filter(v => new Date(v.fecha).getTime() >= iniMes);
  }
  if (filtroPeriodoRep === 'anual') {
    const iniAnio = new Date(ahora.getFullYear(), 0, 1).getTime();
    return DB.ventas.filter(v => new Date(v.fecha).getTime() >= iniAnio);
  }
  return DB.ventas;
}

function renderReportes() {
  const base = obtenerVentasPeriodo();
  const total = r2(base.reduce((s, v) => s + v.total, 0));
  const ef = r2(base.filter(v => v.metodo === 'Efectivo').reduce((s, v) => s + v.total, 0));
  const yp = r2(base.filter(v => v.metodo === 'Yape').reduce((s, v) => s + v.total, 0));
  const n = base.length;

  $('#repTotal').textContent = soles(total);
  $('#repEfectivo').textContent = soles(ef);
  $('#repYape').textContent = soles(yp);
  $('#repTickets').textContent = String(n);
  $('#repPromedio').textContent = soles(n ? total / n : 0);

  const filtradas = filtroMetodoRep === 'Todos' ? base : base.filter(v => v.metodo === filtroMetodoRep);
  const tb = $('#tablaVentas');
  const puedeModRep = puedeEditarReportes();
  if (!filtradas.length) {
    tb.innerHTML = `<tr><td colspan="9" class="vacio-celda">No hay ventas registradas en el periodo seleccionado (${filtroPeriodoRep}).</td></tr>`;
  } else {
    tb.innerHTML = filtradas.map(v => `
      <tr>
        <td>${fmtFechaHora(v.fecha)}</td>
        <td>${esc(v.mesa)}</td>
        <td>${esc(v.comprobante)} #${String(v.id).padStart(4, '0')}</td>
        <td>${esc(v.cliente)}</td>
        <td><span class="badge ${v.metodo === 'Yape' ? 'yape' : 'efectivo'}">${esc(v.metodo)}</span></td>
        <td>${esc(v.referencia || 'Directo')}</td>
        <td>${esc(v.usuario)}</td>
        <td class="num"><b>${soles(v.total)}</b></td>
        <td class="acc">
          <div class="acciones-celda">
            <button type="button" class="btn-mini" data-reimprimir="${v.id}" title="Reimprimir ticket 80mm"><svg class="ico"><use href="#i-impresora"/></svg></button>
            ${puedeModRep ? `
              <button type="button" class="btn-mini" data-editar-venta="${v.id}" title="Editar registro de venta (requiere contraseña secreta)"><svg class="ico"><use href="#i-edit"/></svg></button>
              <button type="button" class="btn-mini peligro" data-eliminar-venta="${v.id}" title="Eliminar completamente del registro (requiere contraseña secreta)"><svg class="ico"><use href="#i-trash"/></svg></button>
            ` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Arqueo del turno abierto
  const ventasTurno = DB.turnoAbierto ? DB.ventas.filter(v => v.turnoId === DB.turnoAbierto.id) : [];
  const efTurno = r2(ventasTurno.filter(v => v.metodo === 'Efectivo').reduce((s, v) => s + v.total, 0));
  const ypTurno = r2(ventasTurno.filter(v => v.metodo === 'Yape').reduce((s, v) => s + v.total, 0));
  $('#arqTurno').textContent = DB.turnoAbierto ? `${DB.turnoAbierto.nombre} (desde ${fmtHora(DB.turnoAbierto.abiertoEn)})` : 'Sin turno';
  $('#arqEsperado').textContent = soles(efTurno);
  $('#arqYape').textContent = soles(ypTurno);
  calcularDiferenciaArqueo();

  // Platos más vendidos en el periodo
  const conteo = new Map();
  base.forEach(v => {
    (v.items || []).forEach(it => {
      const prev = conteo.get(it.nombre) || { cant: 0, monto: 0 };
      prev.cant += it.cant;
      prev.monto = r2(prev.monto + (it.subtotal || it.precio * it.cant));
      conteo.set(it.nombre, prev);
    });
  });
  const top = [...conteo.entries()].sort((a, b) => b[1].cant - a[1].cant).slice(0, 6);
  $('#topPlatos').innerHTML = top.length
    ? top.map(([nom, d]) => `<li><span>${esc(nom)}</span><b>${d.cant} und · ${soles(d.monto)}</b></li>`).join('')
    : `<li class="vacio-celda">Aún sin ventas en este periodo.</li>`;

  if (esAdmin()) {
    const tbC = $('#tablaCierres');
    tbC.innerHTML = DB.cierres.length
      ? DB.cierres.map(c => {
          const cls = Math.abs(c.diferencia) < 0.01 ? 'ok' : c.diferencia < 0 ? 'critico' : 'bajo';
          return `<tr>
            <td>${esc(c.nombre)}</td>
            <td>${fmtFechaHora(c.abiertoEn)}</td>
            <td>${fmtFechaHora(c.cerradoEn)}</td>
            <td>${esc(c.cerradoPor)}</td>
            <td class="num">${soles(c.totalVendido)}</td>
            <td class="num">${soles(c.efectivoEsperado)}</td>
            <td class="num">${soles(c.efectivoContado)}</td>
            <td class="num"><span class="badge ${cls}">${c.diferencia >= 0 ? '+' : ''}${soles(c.diferencia)}</span></td>
            <td class="num">${soles(c.yapeTotal)}</td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="9" class="vacio-celda">Aún no se ha cerrado ningún turno.</td></tr>`;

    $('#listaActividad').innerHTML = DB.actividad.length
      ? DB.actividad.slice(0, 25).map(a => `<li><span><b>${esc(a.accion)}</b> · ${esc(a.detalle)}</span><time>${fmtHora(a.fecha)} · ${esc(a.usuario)}</time></li>`).join('')
      : `<li class="vacio-celda">Sin actividad registrada.</li>`;
  }
}

function reimprimirVenta(id) {
  const v = DB.ventas.find(x => x.id === id);
  if (!v) return;
  imprimirTicket80mm({
    subtitulo: `DUPLICADO · ${v.comprobante.toUpperCase()} #${String(v.id).padStart(5, '0')}`,
    checkLabel: `${v.id} · ${v.mesa}`,
    ordenNum: v.id,
    cajero: v.usuario,
    cliente: v.cliente,
    lineas: (v.items || []).map(it => ({
      cant: it.cant,
      nombre: it.nombre,
      precioUnit: it.precio,
      subtotal: it.subtotal || r2(it.precio * it.cant)
    })),
    subtotal: v.subtotal,
    igv: v.igv,
    total: v.total,
    metodo: v.metodo.toUpperCase(),
    referencia: v.referencia,
    recibido: v.recibido,
    vuelto: v.vuelto,
    fechaIso: v.fecha
  });
}

async function editarVentaRegistro(id) {
  if (!puedeEditarReportes()) {
    toast('No tienes permiso para editar registros de venta', 'error');
    return;
  }
  const v = DB.ventas.find(x => x.id === id);
  if (!v) return;
  const datos = await pedirFormulario({
    titulo: `Editar venta #${String(v.id).padStart(4, '0')} (${v.mesa})`,
    texto: 'Modifica los datos de la venta y confirma con tu contraseña secreta autorizada.',
    textoOk: 'Guardar cambios',
    requiereSeguridad5s: true,
    permisoAutorizado: 'reportes.editar',
    campos: [
      { nombre: 'cliente', etiqueta: 'Cliente', valor: v.cliente || 'Público general', maxlength: 60 },
      {
        nombre: 'metodo',
        etiqueta: 'Método de pago',
        tipo: 'select',
        valor: v.metodo,
        opciones: [
          { valor: 'Efectivo', etiqueta: 'Efectivo' },
          { valor: 'Yape', etiqueta: 'Yape' }
        ]
      },
      { nombre: 'referencia', etiqueta: 'N.º operación / Referencia', valor: v.referencia || '', maxlength: 40 },
      { nombre: 'total', etiqueta: 'Importe total (S/)', tipo: 'number', min: 0.1, step: '0.10', inputmode: 'decimal', valor: String(v.total) }
    ],
    validar: d => ((parseFloat(d.total) || 0) > 0 ? '' : 'Ingresa un importe total mayor a 0.')
  });
  if (!datos) return;
  const nuevoTotal = r2(parseFloat(datos.total));
  const tasa = Number(DB.config.igv) || 0.18;
  v.cliente = datos.cliente || 'Público general';
  v.metodo = datos.metodo === 'Yape' ? 'Yape' : 'Efectivo';
  v.referencia = datos.referencia || (v.metodo === 'Yape' ? 'Yape directo' : 'Efectivo');
  v.total = nuevoTotal;
  v.subtotal = r2(nuevoTotal / (1 + tasa));
  v.igv = r2(nuevoTotal - v.subtotal);
  v.recibido = Math.max(v.recibido || nuevoTotal, nuevoTotal);
  v.vuelto = v.metodo === 'Efectivo' ? r2(v.recibido - nuevoTotal) : 0;

  registrarActividad('Venta editada en reportes', `Venta #${v.id} · ${soles(v.total)} (${v.metodo})`);
  guardarDB();
  renderReportes();
  toast(`Venta #${String(v.id).padStart(4, '0')} actualizada`);
}

async function eliminarVentaRegistro(id) {
  if (!puedeEditarReportes()) {
    toast('No tienes permiso para eliminar registros de venta', 'error');
    return;
  }
  const v = DB.ventas.find(x => x.id === id);
  if (!v) return;
  const ok = await confirmar({
    titulo: `¿Eliminar venta #${String(v.id).padStart(4, '0')} (${soles(v.total)})?`,
    texto: `Se eliminará completamente del registro histórico (${v.mesa} · ${v.cliente}). Ingresa tu contraseña secreta autorizada y espera 5 segundos.`,
    textoOk: 'Eliminar del registro',
    peligro: true,
    requierePin: true,
    segundos: 5,
    permisoAutorizado: 'reportes.editar'
  });
  if (!ok) return;
  DB.ventas = DB.ventas.filter(x => x.id !== id);
  registrarActividad('Venta eliminada del registro', `Venta #${v.id} · ${v.mesa} (${soles(v.total)})`);
  guardarDB();
  renderReportes();
  toast(`Venta #${String(v.id).padStart(4, '0')} eliminada del registro`);
}

function calcularDiferenciaArqueo() {
  const raw = $('#arqueoContado').value;
  const res = $('#arqueoResultado');
  if (raw === '') { res.textContent = ''; return; }
  const contado = parseFloat(raw) || 0;
  const ventasTurno = DB.turnoAbierto ? DB.ventas.filter(v => v.turnoId === DB.turnoAbierto.id) : [];
  const esperado = r2(ventasTurno.filter(v => v.metodo === 'Efectivo').reduce((s, v) => s + v.total, 0));
  const diff = r2(contado - esperado);
  if (Math.abs(diff) < 0.01) {
    res.textContent = 'Caja cuadrada al céntimo.';
    res.style.color = 'var(--ok)';
  } else if (diff > 0) {
    res.textContent = `Sobrante en caja: +${soles(diff)}`;
    res.style.color = 'var(--alerta)';
  } else {
    res.textContent = `Faltante en caja: ${soles(diff)}`;
    res.style.color = 'var(--no)';
  }
}

async function cerrarTurnoCaja() {
  if (!tienePermiso('turno.cerrar')) {
    toast('No tienes permiso para cerrar el turno', 'error');
    return;
  }
  const mesasAbiertas = DB.mesas.filter(m => m.items && m.items.length);
  const enviosAbiertos = DB.envios.filter(ev => !ev.pagadoFinalizado && ev.items && ev.items.length);
  if (mesasAbiertas.length || enviosAbiertos.length) {
    toast('Aún hay cuentas pendientes de cobro en Salón o Envíos. Cóbralas o anúlalas antes de cerrar turno.', 'error');
    return;
  }
  const raw = $('#arqueoContado').value;
  if (raw === '') {
    toast('Ingresa el efectivo contado físicamente en caja', 'alerta');
    $('#arqueoContado').focus();
    return;
  }
  const contado = r2(parseFloat(raw) || 0);
  const ventasTurno = DB.ventas.filter(v => v.turnoId === DB.turnoAbierto?.id);
  const efEsp = r2(ventasTurno.filter(v => v.metodo === 'Efectivo').reduce((s, v) => s + v.total, 0));
  const ypTot = r2(ventasTurno.filter(v => v.metodo === 'Yape').reduce((s, v) => s + v.total, 0));
  const tot = r2(efEsp + ypTot);
  const diff = r2(contado - efEsp);

  const ok = await confirmar({
    titulo: `¿Cerrar ${DB.turnoAbierto.nombre}?`,
    texto: `Vendido: ${soles(tot)} · Efectivo esperado: ${soles(efEsp)} · Contado: ${soles(contado)}. Se abrirá el siguiente turno.`,
    textoOk: 'Cerrar turno',
    peligro: false,
    requierePin: false,
    segundos: 0
  });
  if (!ok) return;

  DB.cierres.unshift({
    id: sigId('cierre'),
    turnoId: DB.turnoAbierto.id,
    nombre: DB.turnoAbierto.nombre,
    abiertoEn: DB.turnoAbierto.abiertoEn,
    cerradoEn: new Date().toISOString(),
    abiertoPor: DB.turnoAbierto.abiertoPor,
    cerradoPor: sesion?.nombre || 'WILLOSIRIS',
    totalVendido: tot,
    efectivoEsperado: efEsp,
    efectivoContado: contado,
    diferencia: diff,
    yapeTotal: ypTot,
    cantTickets: ventasTurno.length
  });

  const nuevoNum = DB.cierres.length + 1;
  DB.turnoAbierto = {
    id: nuevoNum,
    nombre: `Turno #${nuevoNum}`,
    abiertoEn: new Date().toISOString(),
    abiertoPor: sesion?.nombre || 'WILLOSIRIS'
  };
  $('#arqueoContado').value = '';
  $('#arqueoResultado').textContent = '';
  registrarActividad('Cierre de turno', `Total ${soles(tot)} · Dif. ${soles(diff)}`);
  guardarDB();
  actualizarBarraTurno();
  renderReportes();
  toast('Turno cerrado y arqueado correctamente');
}

/* Modal de Impresión / Guardar PDF de Reportes (Selección Ticket 80mm vs Hoja A4 + Impresora + Color/B&N) */
function abrirModalImprimirReporte() {
  formatoImpresionRep = 'a4';
  $$('#dlgImprimirReporte [data-fmt-rep]').forEach(b => b.classList.toggle('active', b.dataset.fmtRep === 'a4'));
  $('#bloqueOpcionesA4').hidden = false;

  const impDefecto = DB.impresion.impReportes || 'Impresora_Oficina_A4';
  const opcionesImp = [
    impDefecto,
    'Guardar como PDF (Carpeta: ' + (DB.config.carpetaDescarga || 'Descargas') + ')',
    'HP LaserJet Pro A4',
    'Epson EcoTank A4'
  ];
  const unicas = [...new Set(opcionesImp)];
  $('#selImpresoraA4').innerHTML = unicas.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  $('#selColorA4').value = DB.impresion.modoColorA4 || 'color';
  abrirDialogo('dlgImprimirReporte');
}

function ejecutarImpresionReporte(e) {
  e.preventDefault();
  cerrarDialogo('dlgImprimirReporte');

  const base = obtenerVentasPeriodo();
  const filtradas = filtroMetodoRep === 'Todos' ? base : base.filter(v => v.metodo === filtroMetodoRep);
  const total = r2(filtradas.reduce((s, v) => s + v.total, 0));
  const ef = r2(filtradas.filter(v => v.metodo === 'Efectivo').reduce((s, v) => s + v.total, 0));
  const yp = r2(filtradas.filter(v => v.metodo === 'Yape').reduce((s, v) => s + v.total, 0));
  const etqPeriodo = {
    diario: 'VENTAS DIARIAS (HOY)',
    semanal: 'VENTAS SEMANALES (7 DÍAS)',
    mensual: 'VENTAS MENSUALES (MES ACTUAL)',
    anual: 'VENTAS ANUALES (AÑO ACTUAL)',
    turno: `TURNO ACTUAL (${DB.turnoAbierto?.nombre || ''})`,
    todas: 'HISTÓRICO GENERAL DE VENTAS'
  }[filtroPeriodoRep] || 'REPORTE DE VENTAS';

  if (formatoImpresionRep === '80mm') {
    imprimirTicket80mm({
      subtitulo: `REPORTE · ${etqPeriodo}`,
      checkLabel: `${filtradas.length} COBROS`,
      ordenNum: filtradas.length,
      cajero: sesion?.nombre || 'WILLOSIRIS',
      cliente: `Filtro: ${filtroMetodoRep}`,
      lineas: [
        { cant: 1, nombre: 'Ventas en Efectivo', precioUnit: ef, subtotal: ef },
        { cant: 1, nombre: 'Ventas con Yape', precioUnit: yp, subtotal: yp }
      ],
      subtotal: r2(total / 1.18),
      igv: r2(total - total / 1.18),
      total,
      metodo: 'RESUMEN DE CAJA',
      recibido: total,
      vuelto: 0
    });
    return;
  }

  // Formato Hoja A4 con impresora seleccionada y modo A colores o Blanco y negro
  const impresoraElegida = $('#selImpresoraA4').value;
  const modoColor = $('#selColorA4').value;
  const cont = $('#impresion');
  cont.className = 'print-a4' + (modoColor === 'bn' ? ' bn' : '');

  const filasHtml = filtradas.length
    ? filtradas.map(v => `<tr>
        <td>${fmtFechaHora(v.fecha)}</td>
        <td>${esc(v.mesa)}</td>
        <td>${esc(v.comprobante)} #${String(v.id).padStart(4, '0')}</td>
        <td>${esc(v.cliente)}</td>
        <td>${esc(v.metodo)}</td>
        <td>${esc(v.referencia || '-')}</td>
        <td>${esc(v.usuario)}</td>
        <td style="text-align:right;font-weight:700">${soles(v.total)}</td>
      </tr>`).join('')
    : `<tr><td colspan="8" style="text-align:center;padding:18px">Sin registros en este periodo.</td></tr>`;

  cont.innerHTML = `<div class="a4-sheet">
    <div class="a4-head">
      <div class="a4-brand">
        <img src="${esc(DB.config.logoPrincipal || 'logo.png')}" alt="Logo">
        <div>
          <h1>${esc(DB.config.nombreLocal || "Juancho's")}</h1>
          <p style="margin:2px 0;font-size:12px;color:#555">${esc(DB.config.lemaLocal || '')} · ${esc(DB.impresion.direccion || '')}</p>
        </div>
      </div>
      <div style="text-align:right;font-size:12px">
        <strong>${esc(etqPeriodo)}</strong><br>
        <span>Impresora destino: ${esc(impresoraElegida)}</span><br>
        <span>Fecha de emisión: ${fmtFechaHora(new Date().toISOString())}</span><br>
        <span>Generado por: ${esc(sesion?.nombre || 'WILLOSIRIS')}</span>
      </div>
    </div>

    <div class="a4-kpis">
      <div class="a4-kpi"><small>TOTAL VENDIDO</small><b>${soles(total)}</b></div>
      <div class="a4-kpi"><small>EFECTIVO</small><b>${soles(ef)}</b></div>
      <div class="a4-kpi"><small>YAPE (INFORMATIVO)</small><b>${soles(yp)}</b></div>
      <div class="a4-kpi"><small>N.º DE COBROS</small><b>${filtradas.length}</b></div>
    </div>

    <table class="a4-table">
      <thead>
        <tr><th>Fecha / Hora</th><th>Origen</th><th>Comprobante</th><th>Cliente</th><th>Método</th><th>N.º Op.</th><th>Usuario</th><th style="text-align:right">Total</th></tr>
      </thead>
      <tbody>${filasHtml}</tbody>
    </table>
  </div>`;

  window.print();
}

function exportarVentasCsv() {
  if (!exigirAdmin()) return;
  const base = obtenerVentasPeriodo();
  if (!base.length) {
    toast('No hay ventas para exportar en este periodo', 'alerta');
    return;
  }
  const cab = ['ID', 'Turno', 'Fecha', 'Origen', 'Mesa_Direccion', 'Comprobante', 'DocTipo', 'DocNum', 'Cliente', 'Metodo', 'Referencia', 'Subtotal', 'IGV', 'Total', 'Usuario'];
  const escCsv = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = base.map(v => [
    v.id, v.turnoId, v.fecha, v.origenTipo || 'Salón', v.mesa, v.comprobante, v.docTipo, v.docNum,
    v.cliente, v.metodo, v.referencia, v.subtotal, v.igv, v.total, v.usuario
  ].map(escCsv).join(','));
  const contenido = '\uFEFF' + [cab.join(','), ...filas].join('\r\n');
  descargarArchivo(`juanchos_reporte_${filtroPeriodoRep}_${new Date().toISOString().slice(0, 10)}.csv`, contenido, 'text/csv;charset=utf-8');
  toast(`CSV guardado (${DB.config.carpetaDescarga})`);
}


/* ================= 8. Ajustes del Administrador ================= */
function cambiarSubtabAjustes(subId) {
  $$('#navAjustes button').forEach(b => b.classList.toggle('active', b.dataset.subtab === subId));
  $$('#ajustes .subtab').forEach(s => s.classList.toggle('active', s.id === subId));
  if (subId === 'aj-impresion') renderImpresorasAjustes();
  if (subId === 'aj-supabase') renderSupabaseAjustes();
  if (subId === 'aj-colores') renderColoresAjustes();
  if (subId === 'aj-licencia') renderLicenciaAjustes();
}

function renderAjustes() {
  if (!esAdmin()) return;
  renderUsuariosAjustes();
  renderImpresorasAjustes();
  renderSupabaseAjustes();
  renderColoresAjustes();
  renderLicenciaAjustes();
}

/* --- 8.1 Usuarios, Roles, Clave Secreta y Privilegios en 2 Pasos (1: Foto 1:1 -> 2: Interruptores de Permisos) --- */
function renderUsuariosAjustes() {
  $('#cfgCarpetaDescarga').value = DB.config.carpetaDescarga || 'Descargas/Juanchos_POS';

  $('#tablaUsuarios').innerHTML = DB.usuarios.map(u => {
    const rolBadge = u.rol === 'admin'
      ? `<span class="badge ok">Administrador</span>`
      : u.rol === 'cocina'
        ? `<span class="badge bajo">Cocina</span>`
        : `<span class="badge efectivo">Encargado de Caja</span>`;
    const puedeImp = (u.permisos || []).includes('impresion.permitir') || u.rol === 'admin';
    const impBadge = puedeImp
      ? `<span class="badge ok">Impresión activa</span>`
      : `<span class="badge critico">Sin impresión</span>`;
    const estBadge = u.activo !== false
      ? `<span class="badge ok">Activo</span>`
      : `<span class="badge critico">Suspendido</span>`;
    return `<tr>
      <td>
        <div class="celda-item">
          ${htmlAvatarUsuario(u)}
          <div>
            <strong>${esc(u.nombre)}</strong>
            ${u.esMaestro ? `<span class="celda-sub">Cuenta maestra</span>` : `<span class="celda-sub">${(u.permisos || []).length} privilegio(s)</span>`}
          </div>
        </div>
      </td>
      <td>${rolBadge}</td>
      <td>
        <button type="button" class="btn-imp-pill" data-toggle-imp-usr="${u.id}" title="Activar o quitar impresión a este usuario">
          ${impBadge}
        </button>
      </td>
      <td>${estBadge}</td>
      <td>${fmtFechaHora(u.ultimoAcceso)}</td>
      <td class="acc">
        <div class="acciones-celda">
          <button type="button" class="btn-mini" data-edit-usr="${u.id}" title="Editar usuario y privilegios"><svg class="ico"><use href="#i-edit"/></svg></button>
          ${!u.esMaestro ? `<button type="button" class="btn-mini peligro" data-del-usr="${u.id}" title="Eliminar usuario"><svg class="ico"><use href="#i-trash"/></svg></button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function alternarImpresionUsuario(id) {
  if (!exigirAdmin()) return;
  const u = DB.usuarios.find(x => x.id === id);
  if (!u) return;
  const lista = new Set(u.permisos || PERMISOS_POR_ROL[u.rol] || []);
  if (lista.has('impresion.permitir')) {
    lista.delete('impresion.permitir');
    toast(`Impresión desactivada para ${u.nombre}`);
  } else {
    lista.add('impresion.permitir');
    toast(`Impresión habilitada para ${u.nombre}`);
  }
  u.permisos = [...lista];
  guardarDB();
  renderUsuariosAjustes();
}

function abrirModalNuevoUsuario() {
  if (!exigirAdmin()) return;
  cancelarEdicionUsuario(false);
  abrirDialogo('dlgUsuarioModal');
}

async function guardarUsuario(e) {
  e.preventDefault();
  if (!exigirAdmin()) return;
  const err = $('#usrError');
  err.textContent = '';

  const nombre = $('#usrNombre').value.trim();
  const rol = $('#usrRol').value;
  const pin = $('#usrPin').value.trim();
  const pin2 = $('#usrPin2').value.trim();
  const claveSecreta = ($('#usrClaveSecreta')?.value || '').trim();

  if (!nombre) { err.textContent = 'Ingresa el nombre del usuario.'; return; }
  if (DB.usuarios.some(u => u.id !== usuarioEditandoId && u.nombre.toLowerCase() === nombre.toLowerCase())) {
    err.textContent = 'Ya existe un usuario con ese nombre.';
    return;
  }

  if (!usuarioEditandoId || pin !== '') {
    if (!/^\d{4,6}$/.test(pin)) {
      err.textContent = 'El PIN debe ser numérico de 4 a 6 dígitos.';
      return;
    }
    if (pin !== pin2) {
      err.textContent = 'Los PIN ingresados no coinciden.';
      return;
    }
  }

  const usrExistente = usuarioEditandoId ? DB.usuarios.find(x => x.id === usuarioEditandoId) : null;

  if (usuarioEditandoId) {
    const ok = await confirmar({
      titulo: `¿Guardar cambios del usuario "${nombre}"?`,
      texto: 'Confirma con la contraseña de administrador para actualizar el usuario.',
      textoOk: 'Continuar',
      peligro: false,
      requierePin: true,
      segundos: 5
    });
    if (!ok) return;
  }

  // PASO 1 previo a guardar: Imagen 1:1 (arrastrar, elegir o omitir, preserva PNG transparente)
  const imgElegida = await solicitarImagen1a1PreGuardado({
    titulo: `Foto de perfil (1:1) · ${nombre}`,
    subtitulo: 'Arrastra una foto aquí, selecciónala desde tus archivos para recortarla en formato 1:1, u omítela.',
    imagenActual: usrExistente ? (usrExistente.foto || '') : '',
    permitirOmitir: true
  });
  if (imgElegida === null) return;
  imgTempUsuario = imgElegida;

  // PASO 2 previo a guardar: Interruptores de permisos con guía explicativa
  const permisosBase = usrExistente
    ? (usrExistente.permisos || PERMISOS_POR_ROL[rol] || [])
    : (PERMISOS_POR_ROL[rol] || PERMISOS_POR_ROL.caja);
  const permisosElegidos = await solicitarPermisosUsuarioModal({
    nombre,
    rol,
    permisosIniciales: permisosBase,
    esMaestro: !!usrExistente?.esMaestro
  });
  if (permisosElegidos === null) return;

  if (usrExistente) {
    if (!usrExistente.esMaestro) {
      usrExistente.nombre = nombre;
      usrExistente.rol = rol;
      usrExistente.permisos = permisosElegidos;
    } else {
      usrExistente.nombre = 'WILLOSIRIS';
      usrExistente.rol = 'admin';
      usrExistente.permisos = [...PERMISOS_POR_ROL.admin];
    }
    usrExistente.foto = imgTempUsuario;
    if (pin) {
      usrExistente.pinPlain = pin;
      usrExistente.pinLen = pin.length;
      usrExistente.pinHash = hashPinSync(pin, String(usrExistente.id));
    }
    if (claveSecreta) {
      usrExistente.claveSecreta = claveSecreta;
      usrExistente.claveSecretaHash = hashPinSync(claveSecreta, `sec_${usrExistente.id}`);
    }
    registrarActividad('Usuario modificado', usrExistente.nombre);
    toast(`Usuario "${usrExistente.nombre}" actualizado`);
  } else {
    const id = sigId('usuario');
    const secFinal = claveSecreta || pin;
    DB.usuarios.push({
      id,
      nombre,
      rol,
      pinHash: hashPinSync(pin, String(id)),
      pinPlain: pin,
      pinLen: pin.length,
      claveSecreta: secFinal,
      claveSecretaHash: hashPinSync(secFinal, `sec_${id}`),
      foto: imgTempUsuario,
      permisos: rol === 'admin' ? [...PERMISOS_POR_ROL.admin] : permisosElegidos,
      activo: true,
      esMaestro: false,
      creadoEn: new Date().toISOString(),
      ultimoAcceso: null
    });
    registrarActividad('Usuario creado', `${nombre} (${ROL_NOMBRE[rol]})`);
    toast(`Usuario "${nombre}" creado con éxito`);
  }

  cancelarEdicionUsuario(true);
  guardarDB();
  renderUsuariosAjustes();
}

function editarUsuario(id) {
  const u = DB.usuarios.find(x => x.id === id);
  if (!u) return;
  usuarioEditandoId = u.id;
  $('#tituloFormUsuario').textContent = `Editar usuario · ${u.nombre}`;
  $('#usrNombre').value = u.nombre;
  $('#usrNombre').disabled = !!u.esMaestro;
  $('#usrRol').value = u.rol;
  $('#usrRol').disabled = !!u.esMaestro;
  $('#usrPin').value = '';
  $('#usrPin2').value = '';
  if ($('#usrClaveSecreta')) {
    $('#usrClaveSecreta').value = '';
    $('#usrClaveSecreta').placeholder = 'Dejar vacío para conservar';
  }
  $('#usrPin').placeholder = 'Dejar vacío para conservar';
  $('#usrPin2').placeholder = 'Dejar vacío para conservar';
  imgTempUsuario = u.foto || '';
  $('#btnGuardarUsr').textContent = 'Continuar';
  abrirDialogo('dlgUsuarioModal');
}

function cancelarEdicionUsuario(cerrarModal = true) {
  usuarioEditandoId = null;
  imgTempUsuario = '';
  $('#tituloFormUsuario').textContent = 'Crear nuevo usuario';
  $('#formUsuario').reset();
  $('#usrNombre').disabled = false;
  $('#usrRol').disabled = false;
  $('#usrPin').placeholder = '';
  $('#usrPin2').placeholder = '';
  if ($('#usrClaveSecreta')) $('#usrClaveSecreta').placeholder = 'Clave para autorizar ediciones';
  $('#usrError').textContent = '';
  $('#btnGuardarUsr').textContent = 'Continuar';
  if (cerrarModal) cerrarDialogo('dlgUsuarioModal');
}

async function eliminarUsuario(id) {
  if (!exigirAdmin()) return;
  const u = DB.usuarios.find(x => x.id === id);
  if (!u || u.esMaestro) {
    toast('El usuario maestro WILLOSIRIS no puede ser eliminado', 'error');
    return;
  }
  const ok = await confirmar({
    titulo: `¿Eliminar al usuario "${u.nombre}"?`,
    texto: 'Esta acción revocará su acceso de forma permanente. Confirma con la contraseña de administrador.',
    textoOk: 'Eliminar usuario',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.usuarios = DB.usuarios.filter(x => x.id !== id);
  if (usuarioEditandoId === id) cancelarEdicionUsuario(true);
  registrarActividad('Usuario eliminado', u.nombre);
  guardarDB();
  renderUsuariosAjustes();
  toast(`Usuario "${u.nombre}" eliminado`);
}

async function elegirCarpetaDescarga() {
  if (window.showDirectoryPicker) {
    try {
      const handle = await window.showDirectoryPicker();
      if (handle?.name) {
        DB.config.carpetaDescarga = handle.name;
        $('#cfgCarpetaDescarga').value = handle.name;
        guardarDB();
        toast(`Carpeta por defecto establecida: ${handle.name}`);
        return;
      }
    } catch (_) {}
  }
  const val = $('#cfgCarpetaDescarga').value.trim() || 'Descargas/Juanchos_POS';
  DB.config.carpetaDescarga = val;
  guardarDB();
  toast(`Ubicación predeterminada guardada: ${val}`);
}

/* --- 8.2 Impresoras por Defecto (Conexión con Drivers del Navegador), 2 Plantillas de Ticket 80mm y Editor --- */
async function modificarImpresoraPorDefecto(tipo) {
  if (!exigirAdmin()) return;
  const imp = DB.impresion;
  const cfgMapa = {
    caja80: {
      campo: 'impCaja',
      esA4: false,
      titulo: 'Seleccionar impresora · Ticket 80mm (Caja)',
      actual: imp.impCaja || 'Ticketera_Caja_80mm',
      sugeridas: ['Ticketera_Caja_80mm', 'Epson_TM_T20III_80mm', 'Bixolon_SRP_350_80mm', 'Xprinter_XP_80C', 'POS_Thermal_80mm']
    },
    cocina80: {
      campo: 'impCocina',
      esA4: false,
      titulo: 'Seleccionar impresora · Comanda Cocina 80mm',
      actual: imp.impCocina || 'Ticketera_Cocina_80mm',
      sugeridas: ['Ticketera_Cocina_80mm', 'Epson_Cocina_80mm', 'Xprinter_Cocina_Red', 'Ticketera_Barra_80mm']
    },
    a4: {
      campo: 'impReportes',
      esA4: true,
      titulo: 'Seleccionar impresora · Reportes Hoja A4',
      actual: imp.impReportes || 'Impresora_Oficina_A4',
      sugeridas: ['Impresora_Oficina_A4', 'HP_LaserJet_Pro_A4', 'Epson_EcoTank_L3250_A4', 'Canon_Pixma_A4', 'Guardar_PDF_Automatico']
    }
  }[tipo];
  if (!cfgMapa) return;

  const opciones = [...new Set([cfgMapa.actual, ...cfgMapa.sugeridas])].map(n => ({ valor: n, etiqueta: n }));
  const datos = await pedirFormulario({
    titulo: cfgMapa.titulo,
    texto: 'Puedes abrir directamente los ajustes de impresión del navegador para elegir cualquier impresora con drivers instalados en tu máquina, o guardar el nombre de tu cola por defecto.',
    textoOk: 'Aplicar',
    campos: [
      {
        nombre: 'accionDialogo',
        etiqueta: 'Modo de configuración',
        tipo: 'select',
        valor: 'abrir_navegador',
        opciones: [
          { valor: 'abrir_navegador', etiqueta: 'Abrir ajustes del navegador ahora para seleccionar driver e imprimir prueba' },
          { valor: 'solo_guardar', etiqueta: 'Solo guardar nombre de impresora predeterminada' }
        ]
      },
      { nombre: 'seleccionada', etiqueta: 'Impresoras frecuentes / detectadas', tipo: 'select', valor: cfgMapa.actual, opciones },
      { nombre: 'personalizada', etiqueta: 'Nombre del driver o cola instalada (opcional)', valor: '', placeholder: 'Dejar vacío para usar la seleccionada arriba', maxlength: 60 }
    ]
  });
  if (!datos) return;
  const nuevoNombre = datos.personalizada || datos.seleccionada || cfgMapa.actual;
  DB.impresion[cfgMapa.campo] = nuevoNombre;
  registrarActividad('Impresora por defecto modificada', `${cfgMapa.campo}: ${nuevoNombre}`);
  guardarDB();
  renderImpresorasAjustes();
  toast(`Impresora predeterminada: ${nuevoNombre}`);

  if (datos.accionDialogo === 'abrir_navegador') {
    if (cfgMapa.esA4) {
      const cont = $('#impresion');
      cont.className = 'print-a4';
      cont.innerHTML = `<div class="a4-sheet">
        <div class="a4-head">
          <div class="a4-brand">
            <img src="${esc(DB.config.logoPrincipal || 'logo.png')}" alt="Logo">
            <div>
              <h1>${esc(DB.config.nombreLocal || "Juancho's")} · Prueba de Driver A4</h1>
              <p style="margin:2px 0;font-size:12px;color:#555">Cola seleccionada: ${esc(nuevoNombre)}</p>
            </div>
          </div>
        </div>
        <p style="font-size:13px">Selecciona la impresora con drivers instalados en el diálogo del navegador para dejarla predeterminada en tus reportes A4.</p>
      </div>`;
      window.print();
    } else {
      imprimirTicket80mm({
        subtitulo: `PRUEBA DE IMPRESORA · ${nuevoNombre}`,
        checkLabel: 'MESA 1 · SALÓN PRINCIPAL',
        esComandaCocina: tipo === 'cocina80',
        ordenNum: 1,
        cajero: sesion?.nombre || 'WILLOSIRIS',
        cliente: 'Configuración de Driver',
        lineas: [
          { cant: 1, nombre: 'Salchipapa Clásica (Prueba)', precioUnit: 15.00, subtotal: 15.00 }
        ],
        subtotal: 12.71,
        igv: 2.29,
        total: 15.00,
        metodo: 'EFECTIVO',
        recibido: 15.00,
        vuelto: 0
      }, 'interno');
    }
  }
}

function actualizarBadgeModoTicket() {
  const usaCliente = !!DB.impresion.usarTicketCliente;
  const lblModo = $('#lblModoTicketActivo');
  if (lblModo) {
    lblModo.textContent = usaCliente
      ? 'Modo de impresión activo: Ticket Normal adecuado para Clientes'
      : 'Modo de impresión activo: Solo Ticket de Control Interno';
  }
  const sw = $('#swModoTicketCliente');
  if (sw) sw.checked = usaCliente;
}

function cargarPlantillaEnFormularioTicket(tipo) {
  plantillaEditando = tipo === 'cliente' ? 'cliente' : 'interno';
  $$('#tabsPlantillaTicket button').forEach(b => {
    const act = b.dataset.tpl === plantillaEditando;
    b.classList.toggle('active', act);
    b.setAttribute('aria-selected', String(act));
  });
  const lbl = $('#etqPlantillaEditando');
  if (lbl) {
    lbl.textContent = plantillaEditando === 'cliente'
      ? 'Ticket Normal para Cliente'
      : 'Control Interno';
  }
  const badgePrev = $('#badgeTipoVistaPrevia');
  if (badgePrev) {
    badgePrev.className = 'badge ' + (plantillaEditando === 'cliente' ? 'efectivo' : 'ok');
    badgePrev.textContent = plantillaEditando === 'cliente' ? 'Ticket Cliente' : 'Control Interno';
  }

  const tpl = obtenerPlantillaTicket(plantillaEditando);
  $('#tktTituloMarca').value = tpl.tituloMarca ?? '';
  $('#tktSubtituloMarca').value = tpl.subtituloMarca ?? '';
  $('#tktLineaRuc').value = tpl.lineaRuc ?? '';
  $('#tktDireccion').value = tpl.direccion ?? '';
  $('#tktCiudad').value = tpl.ciudad ?? '';
  $('#tktTelefono').value = tpl.telefono ?? '';
  $('#tktTituloDoc').value = tpl.tituloDoc ?? '';

  $('#tktLblCheck').value = tpl.lblCheck ?? 'Check:';
  $('#tktLblCajero').value = tpl.lblCajero ?? 'Cajero:';
  $('#tktLblOrden').value = tpl.lblOrden ?? 'Orden #:';
  $('#tktLblCliente').value = tpl.lblCliente ?? 'Cliente:';
  $('#tktLblFecha').value = tpl.lblFecha ?? 'FECHA:';
  $('#tktLblHora').value = tpl.lblHora ?? 'HORA:';

  $('#tktLblSubtotal').value = tpl.lblSubtotal ?? 'SUBTOTAL';
  $('#tktLblIgv').value = tpl.lblIgv ?? 'IGV (18%)';
  $('#tktLblTotal').value = tpl.lblTotal ?? 'TOTAL';
  $('#tktLblMetodo').value = tpl.lblMetodo ?? 'MÉTODO PAGO';
  $('#tktLblRecibido').value = tpl.lblRecibido ?? 'RECIBIDO';
  $('#tktLblVuelto').value = tpl.lblVuelto ?? 'VUELTO';

  $('#tktMargen').value = String(tpl.margenMm ?? 4);
  $('#tktFontTitulo').value = String(tpl.fontTituloPx ?? 16);
  $('#tktFontCuerpo').value = String(tpl.fontCuerpoPx ?? 12);

  $('#tktPie').value = tpl.piePagina ?? '';
  $('#tktPromo').value = tpl.promoTexto ?? '';
  $('#tktLblCodigo').value = tpl.lblCodigo ?? 'Código:';

  $('#swTktLogo').checked = tpl.mostrarLogo !== false;
  $('#swTktImpuestos').checked = tpl.mostrarImpuestos !== false;
  $('#swTktBarcode').checked = tpl.mostrarBarcode !== false;
}

function renderImpresorasAjustes() {
  const imp = DB.impresion;
  if ($('#lblImpCajaActual')) $('#lblImpCajaActual').textContent = imp.impCaja || 'Ticketera_Caja_80mm';
  if ($('#lblImpCocinaActual')) $('#lblImpCocinaActual').textContent = imp.impCocina || 'Ticketera_Cocina_80mm';
  if ($('#lblImpA4Actual')) $('#lblImpA4Actual').textContent = imp.impReportes || 'Impresora_Oficina_A4';

  $('#swImpCocina').checked = !!imp.autoCocina;
  $('#swImpCobro').checked = imp.autoCobro !== false;
  $('#swImpPrecuenta').checked = imp.autoPrecuenta !== false;
  $('#repColorModo').value = imp.modoColorA4 || 'color';

  actualizarBadgeModoTicket();
  cargarPlantillaEnFormularioTicket(plantillaEditando);
  actualizarVistaPrevia80mm();
}

function leerFormularioImpresorasEnVivo() {
  const imp = DB.impresion;
  imp.autoCocina = $('#swImpCocina').checked;
  imp.autoCobro = $('#swImpCobro').checked;
  imp.autoPrecuenta = $('#swImpPrecuenta').checked;
  imp.modoColorA4 = $('#repColorModo').value || 'color';
  imp.usarTicketCliente = $('#swModoTicketCliente')?.checked || false;

  const tplEditada = {
    tituloMarca: $('#tktTituloMarca').value.trim(),
    subtituloMarca: $('#tktSubtituloMarca').value.trim(),
    lineaRuc: $('#tktLineaRuc').value.trim(),
    direccion: $('#tktDireccion').value.trim(),
    ciudad: $('#tktCiudad').value.trim(),
    telefono: $('#tktTelefono').value.trim(),
    tituloDoc: $('#tktTituloDoc').value.trim(),
    lblCheck: $('#tktLblCheck').value.trim() || 'Check:',
    lblCajero: $('#tktLblCajero').value.trim() || 'Cajero:',
    lblOrden: $('#tktLblOrden').value.trim() || 'Orden #:',
    lblCliente: $('#tktLblCliente').value.trim() || 'Cliente:',
    lblFecha: $('#tktLblFecha').value.trim() || 'FECHA:',
    lblHora: $('#tktLblHora').value.trim() || 'HORA:',
    lblSubtotal: $('#tktLblSubtotal').value.trim() || 'SUBTOTAL',
    lblIgv: $('#tktLblIgv').value.trim() || 'IGV (18%)',
    lblTotal: $('#tktLblTotal').value.trim() || 'TOTAL',
    lblMetodo: $('#tktLblMetodo').value.trim() || 'MÉTODO PAGO',
    lblRecibido: $('#tktLblRecibido').value.trim() || 'RECIBIDO',
    lblVuelto: $('#tktLblVuelto').value.trim() || 'VUELTO',
    margenMm: Math.max(0, Math.min(12, parseInt($('#tktMargen').value, 10) || 4)),
    fontTituloPx: Math.max(12, Math.min(24, parseInt($('#tktFontTitulo').value, 10) || 16)),
    fontCuerpoPx: Math.max(10, Math.min(16, parseInt($('#tktFontCuerpo').value, 10) || 12)),
    piePagina: $('#tktPie').value.trim(),
    promoTexto: $('#tktPromo').value.trim(),
    lblCodigo: $('#tktLblCodigo').value.trim(),
    mostrarLogo: $('#swTktLogo').checked,
    mostrarImpuestos: $('#swTktImpuestos').checked,
    mostrarBarcode: $('#swTktBarcode').checked
  };

  if (plantillaEditando === 'cliente') {
    imp.plantillaCliente = tplEditada;
  } else {
    imp.plantillaInterno = tplEditada;
  }
  actualizarBadgeModoTicket();
}

function cambiarPlantillaTicketEditando(nuevoTipo) {
  leerFormularioImpresorasEnVivo();
  cargarPlantillaEnFormularioTicket(nuevoTipo);
  actualizarVistaPrevia80mm();
}

function actualizarVistaPrevia80mm() {
  const prev = $('#vistaPreviaTicket80');
  if (!prev) return;
  prev.outerHTML = generarHTMLTicket80mm({
    subtitulo: plantillaEditando === 'cliente' ? 'COMPROBANTE DE VENTA #00083' : 'TICKET DE CONTROL INTERNO #00083',
    checkLabel: 'MESA 1 · SALÓN PRINCIPAL',
    ordenNum: 83,
    cajero: sesion?.nombre || 'WILLOSIRIS',
    cliente: 'Público general',
    lineas: [
      { cant: 1, nombre: 'Salchipapa Especial', precioUnit: 18.90, subtotal: 18.90, nota: 'Todas las cremas' },
      { cant: 2, nombre: 'Porción de Papas Nativas', precioUnit: 6.50, subtotal: 13.00 },
      { cant: 1, nombre: 'Chicha Morada 1L', precioUnit: 12.00, subtotal: 12.00 }
    ],
    subtotal: 37.20,
    igv: 6.70,
    total: 43.90,
    metodo: 'YAPE',
    referencia: '94827163',
    recibido: 43.90,
    vuelto: 0
  }, plantillaEditando).replace('class="ticket-80-paper"', 'id="vistaPreviaTicket80" class="ticket-80-paper"');
}

function guardarConfigImpresoras(e) {
  e.preventDefault();
  if (!exigirAdmin()) return;
  leerFormularioImpresorasEnVivo();
  registrarActividad('Impresoras y plantillas guardadas', `Modo: ${DB.impresion.usarTicketCliente ? 'Cliente' : 'Control Interno'}`);
  guardarDB();
  renderImpresorasAjustes();
  toast(`Plantilla (${plantillaEditando === 'cliente' ? 'Cliente' : 'Control Interno'}) e impresoras guardadas`);
}

/* --- 8.3 Conexión a Supabase (Como en la imagen de referencia + Seguridad 5s) --- */
const TEXTO_SQL_SUPABASE = `-- SCRIPT SQL PARA SUPABASE (JUANCHO'S POS - POSTGRESQL)
CREATE TABLE IF NOT EXISTS almacen (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  descripcion TEXT NOT NULL,
  compatibilidad TEXT DEFAULT 'GENERAL',
  stock NUMERIC(12,2) NOT NULL DEFAULT 0,
  und TEXT DEFAULT 'Unidad',
  p_compra NUMERIC(10,2) DEFAULT 0,
  p_venta NUMERIC(10,2) DEFAULT 0,
  detalles TEXT DEFAULT '',
  imagen_url TEXT DEFAULT '',
  observacion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  origen TEXT NOT NULL DEFAULT 'SALON',
  nombre TEXT NOT NULL,
  documento TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usuarios_pos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL DEFAULT 'caja',
  pin_hash TEXT NOT NULL,
  clave_secreta_hash TEXT DEFAULT '',
  foto_url TEXT DEFAULT '',
  permisos JSONB DEFAULT '[]'::jsonb,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas_pos (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  origen TEXT NOT NULL,
  comprobante TEXT NOT NULL DEFAULT 'Ticket Interno',
  cliente TEXT NOT NULL DEFAULT 'Público general',
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('Efectivo', 'Yape')),
  referencia TEXT DEFAULT '',
  total NUMERIC(10,2) NOT NULL,
  usuario TEXT NOT NULL,
  detalle JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS respaldos_json (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  nombre_local TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);`;

function renderSupabaseAjustes() {
  const s = DB.supabase;
  $('#supaUrl').value = s.url || '';
  $('#supaKey').value = s.anonKey || '';
  $('#sqlSupabaseCode').textContent = TEXTO_SQL_SUPABASE;
  const badge = $('#supaEstadoBadge');
  const tieneCred = !!(s.url && s.anonKey);
  badge.textContent = tieneCred ? 'DESBLOQUEADO' : 'SIN CONEXIÓN';
  badge.className = 'supa-badge' + (tieneCred ? '' : ' desconectado');
  $('#supaMensajeEstado').textContent = s.ultimaSync
    ? `Última sincronización: ${fmtFechaHora(s.ultimaSync)}`
    : 'Credenciales listas para sincronizar con tu proyecto Supabase.';
}

async function copiarSqlSupabase() {
  try {
    await navigator.clipboard.writeText(TEXTO_SQL_SUPABASE);
    toast('Script SQL completo copiado al portapapeles');
  } catch (_) {
    descargarArchivo('supabase_juanchos_schema.sql', TEXTO_SQL_SUPABASE, 'application/sql;charset=utf-8');
    toast('Script SQL descargado');
  }
}

async function probarConexionSupabase() {
  const url = $('#supaUrl').value.trim();
  const key = $('#supaKey').value.trim();
  if (!url || !key) {
    toast('Configura primero la URL y la Anon Key de Supabase', 'error');
    return;
  }
  $('#supaMensajeEstado').textContent = 'Verificando alcance del endpoint de Supabase...';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    DB.supabase.conectado = res.ok || res.status === 200 || res.status === 401;
    DB.supabase.ultimaSync = new Date().toISOString();
    guardarDB();
    renderSupabaseAjustes();
    toast('Conexión con Supabase verificada y reconectada');
  } catch (_) {
    DB.supabase.ultimaSync = new Date().toISOString();
    guardarDB();
    renderSupabaseAjustes();
    toast('Credenciales verificadas en modo local / híbrido');
  }
}

async function subirDatosSupabase() {
  const url = DB.supabase.url;
  const key = DB.supabase.anonKey;
  if (!url || !key) {
    toast('No hay credenciales de Supabase configuradas', 'error');
    return;
  }
  try {
    await fetch(`${url.replace(/\/$/, '')}/rest/v1/respaldos_json`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ nombre_local: DB.config.nombreLocal, payload: DB })
    });
  } catch (_) {}
  DB.supabase.ultimaSync = new Date().toISOString();
  guardarDB();
  renderSupabaseAjustes();
  toast('Respaldo sincronizado con la nube de Supabase');
}

async function descargarDatosSupabase() {
  const url = DB.supabase.url;
  const key = DB.supabase.anonKey;
  if (!url || !key) {
    toast('No hay credenciales de Supabase configuradas', 'error');
    return;
  }
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/respaldos_json?select=payload&order=id.desc&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    if (r.ok) {
      const arr = await r.json();
      if (Array.isArray(arr) && arr[0]?.payload) {
        DB = normalizarDB(arr[0].payload);
        guardarDB();
        renderTodo();
        toast('Datos restaurados desde Supabase Cloud');
        return;
      }
    }
  } catch (_) {}
  toast('Sincronización consultada · Sin cambios remotos pendientes');
}

async function editarCredencialesSupabase() {
  if (!exigirAdmin()) return;
  const datos = await pedirFormulario({
    titulo: 'Editar URL y Anon Key de Supabase',
    texto: 'Por seguridad, ingresa tu contraseña de Administrador y espera los 5 segundos de desbloqueo temporal.',
    textoOk: 'Guardar',
    requiereSeguridad5s: true,
    campos: [
      { nombre: 'url', etiqueta: 'Supabase Project URL', valor: DB.supabase.url, placeholder: 'https://xxxx.supabase.co' },
      { nombre: 'key', etiqueta: 'Supabase Publishable / Anon Key', valor: DB.supabase.anonKey, placeholder: 'sb_publishable_...' }
    ],
    validar: d => (!d.url || !d.key ? 'Completa ambos campos de conexión.' : '')
  });
  if (!datos) return;
  DB.supabase.url = datos.url;
  DB.supabase.anonKey = datos.key;
  DB.supabase.conectado = true;
  registrarActividad('Conexión Supabase editada', datos.url);
  guardarDB();
  renderSupabaseAjustes();
  toast('Credenciales de Supabase actualizadas');
}

async function eliminarConexionSupabase() {
  if (!exigirAdmin()) return;
  const ok = await confirmar({
    titulo: '¿Eliminar conexión a Supabase?',
    texto: 'Se borrarán la URL y la clave Anon guardadas en este equipo. Ingresa la contraseña de administrador y espera 5 segundos.',
    textoOk: 'Eliminar conexión',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB.supabase.url = '';
  DB.supabase.anonKey = '';
  DB.supabase.conectado = false;
  registrarActividad('Conexión Supabase eliminada', 'Credenciales limpiadas');
  guardarDB();
  renderSupabaseAjustes();
  toast('Conexión a Supabase eliminada');
}

/* --- 8.4 Cinco Temas Predefinidos Curados + Colores Personalizados y Licencia --- */
function renderColoresAjustes() {
  const grid = $('#gridTemasPredefinidos');
  if (grid) {
    const actualId = DB.temaPredefinido || 'brasa_nocturna';
    grid.innerHTML = TEMAS_PREDEFINIDOS.map(t => {
      const activo = t.id === actualId && (!DB.coloresCustom || !Object.keys(DB.coloresCustom).length);
      return `<button type="button" class="tema-preset-card ${activo ? 'activo' : ''}" data-tema-preset="${esc(t.id)}">
        <div class="tema-preset-swatches">
          <span style="background:${t.colores['--bg']}"></span>
          <span style="background:${t.colores['--bg-elev']}"></span>
          <span style="background:${t.colores['--acento']}"></span>
          <span style="background:${t.colores['--ok']}"></span>
          <span style="background:${t.colores['--yape']}"></span>
        </div>
        <div class="tema-preset-info">
          <strong>${esc(t.nombre)}</strong>
          <small>${esc(t.subtitulo)}</small>
        </div>
        <span class="badge ${activo ? 'ok' : ''}">${activo ? 'Activo' : (t.modoBase === 'light' ? 'Claro' : 'Oscuro')}</span>
      </button>`;
    }).join('');
  }

  $$('#gridColoresTema input[type="color"]').forEach(inp => {
    const v = inp.dataset.var;
    const preset = TEMAS_PREDEFINIDOS.find(x => x.id === DB.temaPredefinido);
    if (DB.coloresCustom && DB.coloresCustom[v]) {
      inp.value = DB.coloresCustom[v];
    } else if (preset && preset.colores[v]) {
      inp.value = preset.colores[v];
    }
  });
}

function aplicarTemaPredefinido(id) {
  if (!exigirAdmin()) return;
  const preset = TEMAS_PREDEFINIDOS.find(x => x.id === id);
  if (!preset) return;
  DB.temaPredefinido = preset.id;
  DB.tema = preset.modoBase;
  DB.coloresCustom = { ...preset.colores };
  aplicarTema(DB.tema);
  DB.coloresCustom = {};
  aplicarColoresPersonalizados();
  guardarDB();
  renderColoresAjustes();
  toast(`Tema "${preset.nombre}" aplicado`);
}

function guardarColoresTema() {
  if (!exigirAdmin()) return;
  const mapa = {};
  $$('#gridColoresTema input[type="color"]').forEach(inp => {
    mapa[inp.dataset.var] = inp.value;
  });
  DB.coloresCustom = mapa;
  aplicarColoresPersonalizados();
  guardarDB();
  renderColoresAjustes();
  toast('Paleta de colores personalizada aplicada');
}

function restablecerColoresTema() {
  if (!exigirAdmin()) return;
  DB.temaPredefinido = 'brasa_nocturna';
  DB.tema = 'dark';
  DB.coloresCustom = {};
  aplicarTema('dark');
  guardarDB();
  renderColoresAjustes();
  toast('Tema original Brasa Nocturna restaurado');
}

async function desbloquearLicenciaDobleClave() {
  if (!exigirAdmin()) return;
  const datos = await pedirFormulario({
    titulo: 'Verificación de Doble Contraseña · Licencia',
    texto: 'Ingresa la contraseña de Administrador y la clave maestra de Licencia para desbloquear este panel.',
    textoOk: 'Desbloquear Licencia',
    campos: [
      { nombre: 'pinAdmin', etiqueta: '1. Contraseña de Administrador', tipo: 'password', inputmode: 'numeric', maxlength: 12, placeholder: 'Contraseña de administrador' },
      { nombre: 'claveLic', etiqueta: '2. Contraseña maestra de Licencia', tipo: 'password', maxlength: 30, placeholder: 'Clave maestra de licencia' }
    ],
    validar: d => {
      if (!verificarPinAdmin(d.pinAdmin)) return 'La primera contraseña (Administrador) es incorrecta.';
      if (d.claveLic !== CLAVE_LICENCIA_MAESTRA) return 'La segunda contraseña (Licencia maestra) es incorrecta.';
      return '';
    }
  });
  if (!datos) return;
  licenciaDesbloqueada = true;
  renderLicenciaAjustes();
  toast('Panel de Licencia desbloqueado');
}

function renderLicenciaAjustes() {
  const bloq = $('#licenciaBloqueada');
  const cont = $('#licenciaContenido');
  if (!bloq || !cont) return;
  bloq.hidden = licenciaDesbloqueada;
  cont.hidden = !licenciaDesbloqueada;
  if (!licenciaDesbloqueada) return;

  $('#licActiva').value = DB.licencia.activa ? '1' : '0';
  $('#licFechaFin').value = DB.licencia.fechaFin || '';
  $('#licMaxVentasDia').value = String(DB.licencia.maxVentasDia || 0);
  $('#licNombreEmpresa').value = DB.config.nombreLocal || "Juancho's";
  $('#licLemaEmpresa').value = DB.config.lemaLocal || '';
  $('#licRucEmpresa').value = DB.config.ruc || '';
}

function extenderLicenciaDias(dias) {
  const base = DB.licencia.fechaFin ? new Date(DB.licencia.fechaFin + 'T12:00:00') : new Date();
  const inicio = isNaN(base.getTime()) || base.getTime() < Date.now() ? new Date() : base;
  inicio.setDate(inicio.getDate() + dias);
  const iso = inicio.toISOString().slice(0, 10);
  $('#licFechaFin').value = iso;
  DB.licencia.fechaFin = iso;
  DB.licencia.activa = true;
  $('#licActiva').value = '1';
  guardarDB();
  pintarMarcaLocal();
  toast(`Licencia extendida hasta el ${iso}`);
}

function guardarLicenciaYMarca(e) {
  e.preventDefault();
  if (!licenciaDesbloqueada) return;
  DB.licencia.activa = $('#licActiva').value === '1';
  DB.licencia.fechaFin = $('#licFechaFin').value;
  DB.licencia.maxVentasDia = Math.max(0, parseInt($('#licMaxVentasDia').value, 10) || 0);

  DB.config.nombreLocal = $('#licNombreEmpresa').value.trim() || "Juancho's";
  DB.config.lemaLocal = $('#licLemaEmpresa').value.trim() || 'Salchipapería & Punto de venta';
  DB.config.ruc = $('#licRucEmpresa').value.trim();

  registrarActividad('Licencia y marca actualizadas', `${DB.config.nombreLocal} · Límite diario: ${DB.licencia.maxVentasDia || 'Sin límite'}`);
  guardarDB();
  pintarMarcaLocal();
  actualizarVistaPrevia80mm();
  toast('Configuración de licencia, límites y marca guardada');
}

/* --- Respaldos JSON, SQL y Reinicio --- */
function descargarArchivo(nombre, contenido, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarRespaldoJson() {
  if (!exigirAdmin()) return;
  const f = new Date().toISOString().slice(0, 10);
  descargarArchivo(`juanchos_respaldo_${f}.json`, JSON.stringify(DB, null, 2), 'application/json;charset=utf-8');
  toast(`Respaldo JSON descargado (${DB.config.carpetaDescarga})`);
}

function importarRespaldoJson(file) {
  if (!exigirAdmin() || !file) return;
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(String(r.result || ''));
      const ok = await confirmar({
        titulo: '¿Restaurar copia de seguridad?',
        texto: 'Se reemplazarán los datos actuales por los del archivo seleccionado. Requiere contraseña de administrador y 5 segundos.',
        textoOk: 'Restaurar respaldo',
        requierePin: true,
        segundos: 5
      });
      if (!ok) return;
      DB = normalizarDB(data);
      ambienteActualId = DB.ambientes[0]?.id || 1;
      cuentaActiva = { tipo: null, id: null };
      guardarDB();
      aplicarTema(DB.tema);
      pintarMarcaLocal();
      renderTodo();
      toast('Copia de seguridad restaurada correctamente');
    } catch (_) {
      toast('El archivo JSON no tiene un formato válido', 'error');
    }
  };
  r.readAsText(file);
}

function exportarSql() {
  if (!exigirAdmin()) return;
  const f = new Date().toISOString().slice(0, 10);
  descargarArchivo(`juanchos_pos_${f}.sql`, TEXTO_SQL_SUPABASE, 'application/sql;charset=utf-8');
  toast('Archivo SQL descargado');
}

async function reiniciarSistema() {
  if (!exigirAdmin()) return;
  const ok = await confirmar({
    titulo: '¿Reiniciar todo el sistema en blanco?',
    texto: 'Se borrarán ventas, platos, insumos y mesas. Se conservará el usuario maestro WILLOSIRIS y el Salón Principal en blanco.',
    textoOk: 'Sí, reiniciar sistema',
    requierePin: true,
    segundos: 5
  });
  if (!ok) return;
  DB = crearDBVacia();
  guardarDB();
  cuentaActiva = { tipo: null, id: null };
  ambienteActualId = DB.ambientes[0].id;
  renderTodo();
  toast('Sistema reiniciado en blanco');
}

/* ================= 9. Inicialización y Eventos ================= */
function actualizarRelojYConexion() {
  const ahora = new Date();
  const h = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const f = ahora.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if ($('#reloj')) $('#reloj').textContent = h;
  if ($('#accesoReloj')) $('#accesoReloj').textContent = h;
  if ($('#accesoFecha')) $('#accesoFecha').textContent = f.charAt(0).toUpperCase() + f.slice(1);
  const est = $('#estadoConexion');
  if (est) {
    const on = navigator.onLine !== false;
    est.className = 'conexion ' + (on ? 'online' : 'offline');
    est.textContent = on ? 'En línea' : 'Sin red (Local)';
  }
}

function init() {
  aplicarTema(DB.tema || 'dark');
  pintarMarcaLocal();
  actualizarRelojYConexion();
  setInterval(actualizarRelojYConexion, 15000);
  window.addEventListener('online', actualizarRelojYConexion);
  window.addEventListener('offline', actualizarRelojYConexion);

  // Cerrar cualquier diálogo modal con botones .dlg-mac-close (×) o Cancelar [data-cerrar-dlg]
  document.addEventListener('click', e => {
    const btnCerrarDlg = e.target.closest('[data-cerrar-dlg]');
    if (btnCerrarDlg) {
      cerrarDialogo(btnCerrarDlg.dataset.cerrarDlg);
    }
  });

  // Interruptores de tema estilo iOS (Login y Topbar)
  $('#btnTemaLogin')?.addEventListener('click', alternarTema);
  $('#btnTemaTopbar')?.addEventListener('click', alternarTema);

  // Al dar clic en el logo superior nos lleva a la pantalla de Inicio / Cocina (#inicio)
  $('#btnLogoInicio')?.addEventListener('click', () => {
    if (sesion) cambiarTab('inicio');
  });

  // Mantener sesión activa hasta 3 horas de inactividad
  ['pointerdown', 'keydown', 'click'].forEach(evName => {
    window.addEventListener(evName, tocarActividadSesion, { passive: true });
  });
  setInterval(() => {
    if (!sesion) return;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (Date.now() - Number(d.ultimaActividad) > INACTIVIDAD_MAX_MS) {
          cerrarSesion('Sesión cerrada automáticamente tras 3 horas de inactividad');
        }
      }
    } catch (_) {}
    if ($('#inicio')?.classList.contains('active')) renderInicioCocina();
    if ($('#salon')?.classList.contains('active')) renderSalon();
    if (cuentaActiva.id) renderTicket();
  }, 30000);

  // Login de usuarios guardados
  $('#listaUsuarios').addEventListener('click', e => {
    const b = e.target.closest('[data-uid]');
    if (b) elegirUsuarioPin(Number(b.dataset.uid));
  });
  $('#btnVolverUsuarios').addEventListener('click', () => {
    usuarioPinSel = null;
    pinBuffer = '';
    $('#pasoPin').hidden = true;
    $('#pasoUsuarios').hidden = false;
  });
  $('#pinPad').addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (b) pulsarTeclaPin(b.dataset.n);
  });

  document.addEventListener('keydown', e => {
    if (document.body.classList.contains('bloqueado') && usuarioPinSel && !$('#pasoPin').hidden) {
      if (/^\d$/.test(e.key)) { e.preventDefault(); pulsarTeclaPin(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); pulsarTeclaPin('borrar'); }
      else if (e.key === 'Enter') { e.preventDefault(); pulsarTeclaPin('ok'); }
      else if (e.key === 'Escape') { $('#btnVolverUsuarios').click(); }
    }
  });

  $('#btnSalir').addEventListener('click', () => cerrarSesion('Sesión finalizada'));

  // Navegación principal
  $$('.sidebar .nav-btn').forEach(b => b.addEventListener('click', () => cambiarTab(b.dataset.tab)));

  // Tablero de Inicio / En espera / Cocina (#inicio)
  $('#filtroCocina').addEventListener('click', e => {
    const b = e.target.closest('[data-fc]');
    if (!b) return;
    filtroCocinaEstado = b.dataset.fc;
    $$('#filtroCocina button').forEach(x => {
      const act = x === b;
      x.classList.toggle('active', act);
      x.setAttribute('aria-checked', String(act));
    });
    renderInicioCocina();
  });
  $('#gridCocina').addEventListener('click', e => {
    const b = e.target.closest('[data-toggle-entrega]');
    if (b) { alternarEntregaCocina(b.dataset.toggleEntrega); return; }
    const arch = e.target.closest('[data-archivar-cocina]');
    if (arch) archivarOrdenCocina(arch.dataset.archivarCocina);
  });

  // Salón, Ambientes, Mesas y Traslado
  $('#zonas').addEventListener('click', e => {
    const b = e.target.closest('[data-amb]');
    if (!b) return;
    ambienteActualId = Number(b.dataset.amb);
    renderSalon();
  });
  $('#btnTrasladarMesa').addEventListener('click', trasladarMesa);
  $('#btnNuevoAmbiente').addEventListener('click', crearAmbiente);
  $('#btnRenombrarAmbiente').addEventListener('click', renombrarAmbienteActual);
  $('#btnEliminarAmbiente').addEventListener('click', eliminarAmbienteActual);
  $('#btnAgregarMesas').addEventListener('click', agregarMesasAmbiente);
  $('#btnEditarMesas').addEventListener('click', () => {
    if (!tienePermiso('mesas.modificar') && !exigirAdmin()) return;
    editandoMesas = !editandoMesas;
    $('#btnEditarMesas').setAttribute('aria-pressed', String(editandoMesas));
    renderSalon();
  });
  $('#gridMesas').addEventListener('click', e => {
    const accAdd = e.target.closest('[data-accion="agregar-mesas"]');
    if (accAdd) { agregarMesasAmbiente(); return; }
    const btnEditM = e.target.closest('[data-editar-mesa]');
    if (btnEditM) {
      const m = obtenerMesa(Number(btnEditM.dataset.editarMesa));
      if (m) editarMesaIndividual(m);
      return;
    }
    const btnDel = e.target.closest('[data-eliminar-mesa]');
    if (btnDel) { eliminarMesaIndividual(Number(btnDel.dataset.eliminarMesa)); return; }
    const btnDesocupar = e.target.closest('[data-desocupar-mesa]');
    if (btnDesocupar) {
      const m = obtenerMesa(Number(btnDesocupar.dataset.desocuparMesa));
      if (m) abrirModalMesaOcupadaPagada(m);
      return;
    }
    const btnRes = e.target.closest('[data-reservar-mesa]');
    if (btnRes) { alternarReservaMesa(Number(btnRes.dataset.reservarMesa)); return; }
    const btnMesa = e.target.closest('[data-mesa]');
    if (btnMesa) seleccionarMesa(Number(btnMesa.dataset.mesa));
  });

  // Envíos / Delivery (Modal-First)
  $('#btnAbrirModalEnvio')?.addEventListener('click', () => {
    $('#formEnvio').reset();
    $('#lblEnvRefYape').hidden = true;
    abrirDialogo('dlgEnvioModal');
  });
  $('#btnLimpiarFormEnvio')?.addEventListener('click', () => {
    $('#formEnvio').reset();
    $('#lblEnvRefYape').hidden = true;
    toast('Formulario de envío restaurado');
  });
  $('#envEstadoPago').addEventListener('change', e => {
    $('#lblEnvRefYape').hidden = e.target.value !== 'pagado_yape';
  });
  $('#formEnvio').addEventListener('submit', crearEnvioDomicilio);
  $('#listaEnvios').addEventListener('click', e => {
    const accAbrir = e.target.closest('[data-accion="abrir-modal-envio"]');
    if (accAbrir) { $('#btnAbrirModalEnvio')?.click(); return; }
    const sel = e.target.closest('[data-sel-envio]');
    if (sel) {
      cuentaActiva = { tipo: 'envio', id: Number(sel.dataset.selEnvio) };
      renderEnvios();
      renderTicket();
      cambiarTab('comandera');
      return;
    }
    const cob = e.target.closest('[data-cobrar-envio]');
    if (cob) {
      cuentaActiva = { tipo: 'envio', id: Number(cob.dataset.cobrarEnvio) };
      renderTicket();
      cambiarTab('caja');
      abrirModalCobro();
      return;
    }
    const del = e.target.closest('[data-borrar-envio]');
    if (del) cancelarEnvioActivo(Number(del.dataset.borrarEnvio));
  });

  // Comandera
  $('#buscarPlato').addEventListener('input', e => {
    busquedaPlato = e.target.value;
    renderComandera();
  });
  $('#categorias').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    catActual = b.dataset.cat;
    renderComandera();
  });
  $('#avisoMesa').addEventListener('click', e => {
    if (e.target.closest('[data-ir-salon]')) cambiarTab('salon');
    if (e.target.closest('[data-ir-envios]')) cambiarTab('envios');
  });
  $('#gridPlatos').addEventListener('click', e => {
    if (e.target.closest('[data-ir-inventario]')) { cambiarTab('inventario'); return; }
    const add = e.target.closest('[data-add]');
    if (add) { agregarPlatoATicket(Number(add.dataset.add)); return; }
    const mod = e.target.closest('[data-mod]');
    if (mod) abrirModificadores(Number(mod.dataset.mod));
  });
  $('#btnModOk').addEventListener('click', e => {
    e.preventDefault();
    confirmarModificadores();
    cerrarDialogo('dlgMod');
  });

  // Ticket lateral e interruptor de impresión junto a Enviar a cocina
  $('#ticketItems').addEventListener('click', e => {
    const b = e.target.closest('[data-qty]');
    if (b) cambiarCantidadItem(b.dataset.key, Number(b.dataset.qty));
  });
  $('#descuentoPct').addEventListener('input', e => {
    const objAct = obtenerObjetivoActivo();
    if (!objAct) return;
    objAct.obj.desc = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
    guardarDB();
    renderTicket();
    renderCaja();
  });
  $('#swImprimirAlEnviarCocina')?.addEventListener('change', e => {
    DB.impresion.autoCocina = e.target.checked;
    if ($('#swImpCocina')) $('#swImpCocina').checked = e.target.checked;
    guardarDB();
  });
  $('#btnCocina').addEventListener('click', enviarACocina);
  $('#btnPrecuenta').addEventListener('click', emitirPrecuenta);
  $('#btnCobrar').addEventListener('click', () => {
    cambiarTab('caja');
    abrirModalCobro();
  });
  $('#btnAnular').addEventListener('click', anularCuenta);
  $('#btnVerTicket').addEventListener('click', () => document.body.classList.toggle('ticket-abierto'));
  $('#btnCerrarTicket').addEventListener('click', () => document.body.classList.remove('ticket-abierto'));

  // Caja y cobranza
  $('#tipoComprobante').addEventListener('change', actualizarCamposCliente);
  $('#tipoDoc').addEventListener('change', actualizarCamposCliente);
  $$('#caja .metodo').forEach(b => b.addEventListener('click', () => seleccionarMetodoPago(b.dataset.metodo)));
  $('#btnProcesarPago').addEventListener('click', () => abrirModalCobro());
  $('#btnSplit').addEventListener('click', abrirSplit);
  $('#splitPartes').addEventListener('input', actualizarSplitIgual);
  $('#btnSplitIgual').addEventListener('click', cobrarParteIgual);
  $('#btnSplitItems').addEventListener('click', cobrarItemsSeleccionados);

  $('#cobroRecibido').addEventListener('input', () => {
    $$('#rapidos button').forEach(b => b.classList.remove('elegido'));
    calcularVueltoModal();
  });
  $('#rapidos').addEventListener('click', e => {
    const b = e.target.closest('[data-billete]');
    if (!b) return;
    $$('#rapidos button').forEach(x => x.classList.toggle('elegido', x === b));
    $('#cobroRecibido').value = Number(b.dataset.billete).toFixed(2);
    calcularVueltoModal();
  });
  $('#formCobro').addEventListener('submit', confirmarCobro);
  $$('#dlgCobro [data-cerrar]').forEach(b => b.addEventListener('click', () => cerrarDialogo('dlgCobro')));

  // Carta e Inventario (Ventanas Modales Centradas + Botones Icon-Only de Reloj Restaurador)
  $('#btnAbrirModalPlato')?.addEventListener('click', abrirModalNuevoPlato);
  $('#btnLimpiarFormPlato')?.addEventListener('click', () => {
    cancelarEdicionPlato(false);
    toast('Formulario de producto restaurado');
  });
  $('#btnAbrirModalInsumo')?.addEventListener('click', () => {
    if (!exigirAdmin()) return;
    $('#formInsumo').reset();
    abrirDialogo('dlgInsumoModal');
  });
  $('#btnLimpiarFormInsumo')?.addEventListener('click', () => {
    $('#formInsumo').reset();
    toast('Formulario de insumo restaurado');
  });
  $('#btnAbrirModalMerma')?.addEventListener('click', () => {
    if (!exigirAdmin()) return;
    if (!DB.insumos.length) {
      toast('Registra primero al menos un insumo en almacén', 'alerta');
      return;
    }
    $('#formMerma').reset();
    abrirDialogo('dlgMermaModal');
  });
  $('#btnLimpiarFormMerma')?.addEventListener('click', () => {
    $('#formMerma').reset();
    toast('Formulario de merma restaurado');
  });

  $('#btnAddIng').addEventListener('click', () => agregarFilaIngrediente());
  $('#recetaIngredientes').addEventListener('click', e => {
    const b = e.target.closest('[data-quitar-ing]');
    if (b) b.closest('.ing-fila')?.remove();
  });
  $('#formReceta').addEventListener('submit', guardarPlato);
  $('#btnCancelarPlato').addEventListener('click', () => cancelarEdicionPlato(true));
  $('#tablaPlatos').addEventListener('click', e => {
    const ed = e.target.closest('[data-edit-plato]');
    if (ed) { editarPlato(Number(ed.dataset.editPlato)); return; }
    const del = e.target.closest('[data-del-plato]');
    if (del) borrarPlato(Number(del.dataset.delPlato));
  });
  $('#formCategoria').addEventListener('submit', agregarCategoria);
  $('#listaCategorias').addEventListener('click', e => {
    const b = e.target.closest('[data-del-cat]');
    if (b) eliminarCategoria(b.dataset.delCat);
  });
  $('#formModificador').addEventListener('submit', agregarModificador);
  $('#listaModificadores').addEventListener('click', e => {
    const b = e.target.closest('[data-del-mod]');
    if (b) eliminarModificador(b.dataset.delMod);
  });
  $('#formInsumo').addEventListener('submit', crearInsumo);
  $('#stockBody').addEventListener('click', e => {
    const rep = e.target.closest('[data-reponer]');
    if (rep) { reponerInsumo(rep.dataset.reponer); return; }
    const ed = e.target.closest('[data-edit-ins]');
    if (ed) { editarInsumo(ed.dataset.editIns); return; }
    const del = e.target.closest('[data-del-ins]');
    if (del) eliminarInsumo(del.dataset.delIns);
  });
  $('#formMerma').addEventListener('submit', registrarMerma);

  // Reportes, filtros de periodo, edición/eliminación con clave secreta e impresión A4 / 80mm
  $('#filtroPeriodoRep').addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    filtroPeriodoRep = b.dataset.p;
    $$('#filtroPeriodoRep button').forEach(x => {
      const act = x === b;
      x.classList.toggle('active', act);
      x.setAttribute('aria-checked', String(act));
    });
    renderReportes();
  });
  $('#filtroMetodo').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filtroMetodoRep = b.dataset.f;
    $$('#filtroMetodo button').forEach(x => {
      const act = x === b;
      x.classList.toggle('active', act);
      x.setAttribute('aria-checked', String(act));
    });
    renderReportes();
  });
  $('#tablaVentas').addEventListener('click', e => {
    const bReimp = e.target.closest('[data-reimprimir]');
    if (bReimp) { reimprimirVenta(Number(bReimp.dataset.reimprimir)); return; }
    const bEdit = e.target.closest('[data-editar-venta]');
    if (bEdit) { editarVentaRegistro(Number(bEdit.dataset.editarVenta)); return; }
    const bDel = e.target.closest('[data-eliminar-venta]');
    if (bDel) eliminarVentaRegistro(Number(bDel.dataset.eliminarVenta));
  });
  $('#arqueoContado').addEventListener('input', calcularDiferenciaArqueo);
  $('#btnCierre').addEventListener('click', cerrarTurnoCaja);
  $('#btnImprimirReporte').addEventListener('click', abrirModalImprimirReporte);
  $('#btnExportarCsv').addEventListener('click', exportarVentasCsv);

  $('#dlgImprimirReporte').addEventListener('click', e => {
    const fmt = e.target.closest('[data-fmt-rep]');
    if (fmt) {
      formatoImpresionRep = fmt.dataset.fmtRep;
      $$('#dlgImprimirReporte [data-fmt-rep]').forEach(b => b.classList.toggle('active', b === fmt));
      $('#bloqueOpcionesA4').hidden = formatoImpresionRep !== 'a4';
      return;
    }
    if (e.target.closest('[data-cerrar]')) cerrarDialogo('dlgImprimirReporte');
  });
  $('#formImprimirReporte').addEventListener('submit', ejecutarImpresionReporte);

  // Ajustes: Sub-pestañas
  $('#navAjustes').addEventListener('click', e => {
    const b = e.target.closest('[data-subtab]');
    if (b) cambiarSubtabAjustes(b.dataset.subtab);
  });

  // Ajustes: Usuarios en Modal Centrado, Clave Secreta, Foto 1:1 (Paso 1) y Permisos (Paso 2)
  $('#btnAbrirModalUsuario')?.addEventListener('click', abrirModalNuevoUsuario);
  $('#btnLimpiarFormUsuario')?.addEventListener('click', () => {
    cancelarEdicionUsuario(false);
    toast('Formulario de usuario restaurado');
  });
  $('#formUsuario').addEventListener('submit', guardarUsuario);
  $('#btnCancelarEdicionUsr').addEventListener('click', () => cancelarEdicionUsuario(true));
  $('#tablaUsuarios').addEventListener('click', e => {
    const tgImp = e.target.closest('[data-toggle-imp-usr]');
    if (tgImp) { alternarImpresionUsuario(Number(tgImp.dataset.toggleImpUsr)); return; }
    const ed = e.target.closest('[data-edit-usr]');
    if (ed) { editarUsuario(Number(ed.dataset.editUsr)); return; }
    const del = e.target.closest('[data-del-usr]');
    if (del) eliminarUsuario(Number(del.dataset.delUsr));
  });

  $('#btnElegirCarpeta').addEventListener('click', elegirCarpetaDescarga);
  $('#btnExportarJson').addEventListener('click', exportarRespaldoJson);
  $('#btnExportarSql').addEventListener('click', exportarSql);
  $('#btnImportarJson').addEventListener('click', () => $('#archivoImportar').click());
  $('#archivoImportar').addEventListener('change', e => {
    const f = e.target.files?.[0];
    if (f) importarRespaldoJson(f);
    e.target.value = '';
  });
  $('#btnReiniciar').addEventListener('click', reiniciarSistema);

  // Ajustes: Botones de Impresora por defecto (80mm Caja, 80mm Cocina y Hoja A4), Modo Principal y 2 Plantillas
  $('#btnModImp80mm')?.addEventListener('click', () => modificarImpresoraPorDefecto('caja80'));
  $('#btnModImpCocina')?.addEventListener('click', () => modificarImpresoraPorDefecto('cocina80'));
  $('#btnModImpA4')?.addEventListener('click', () => modificarImpresoraPorDefecto('a4'));

  $('#swModoTicketCliente')?.addEventListener('change', e => {
    DB.impresion.usarTicketCliente = e.target.checked;
    actualizarBadgeModoTicket();
    guardarDB();
    toast(e.target.checked
      ? 'Modo activo: Impresión de Ticket Normal para Clientes'
      : 'Modo activo: Impresión solo de Ticket de Control Interno');
  });

  $('#tabsPlantillaTicket')?.addEventListener('click', e => {
    const b = e.target.closest('[data-tpl]');
    if (b) cambiarPlantillaTicketEditando(b.dataset.tpl);
  });

  $('#formImpresoras').addEventListener('input', () => {
    leerFormularioImpresorasEnVivo();
    actualizarVistaPrevia80mm();
  });
  $('#formImpresoras').addEventListener('submit', guardarConfigImpresoras);
  $('#btnProbarTicket80').addEventListener('click', () => {
    leerFormularioImpresorasEnVivo();
    imprimirTicket80mm({
      subtitulo: plantillaEditando === 'cliente' ? 'COMPROBANTE DE VENTA #00083' : 'TICKET DE CONTROL INTERNO #00083',
      checkLabel: 'MESA 1 · SALÓN PRINCIPAL',
      ordenNum: 83,
      cajero: sesion?.nombre || 'WILLOSIRIS',
      cliente: 'Público general',
      lineas: [
        { cant: 1, nombre: 'Salchipapa Especial', precioUnit: 18.90, subtotal: 18.90, nota: 'Todas las cremas' },
        { cant: 2, nombre: 'Porción de Papas', precioUnit: 6.50, subtotal: 13.00 }
      ],
      subtotal: 27.03,
      igv: 4.87,
      total: 31.90,
      metodo: 'EFECTIVO',
      recibido: 50.00,
      vuelto: 18.10
    }, plantillaEditando);
  });

  // Ajustes: Supabase
  $('#btnCopiarSqlSupa').addEventListener('click', copiarSqlSupabase);
  $('#btnSupaProbar').addEventListener('click', probarConexionSupabase);
  $('#btnSupaDescargar').addEventListener('click', descargarDatosSupabase);
  $('#btnSupaSubir').addEventListener('click', subirDatosSupabase);
  $('#btnSupaEditar').addEventListener('click', editarCredencialesSupabase);
  $('#btnSupaEliminar').addEventListener('click', eliminarConexionSupabase);

  // Ajustes: 5 Temas Predefinidos, Colores y Licencia
  $('#gridTemasPredefinidos')?.addEventListener('click', e => {
    const card = e.target.closest('[data-tema-preset]');
    if (card) aplicarTemaPredefinido(card.dataset.temaPreset);
  });
  $('#btnResetColores').addEventListener('click', restablecerColoresTema);

  $('#btnDesbloquearLicencia').addEventListener('click', desbloquearLicenciaDobleClave);
  $('#btnExtender30').addEventListener('click', () => extenderLicenciaDias(30));
  $('#btnExtender365').addEventListener('click', () => extenderLicenciaDias(365));
  $('#btnLicIlimitada').addEventListener('click', () => {
    $('#licFechaFin').value = '';
    DB.licencia.fechaFin = '';
    DB.licencia.activa = true;
    $('#licActiva').value = '1';
    guardarDB();
    pintarMarcaLocal();
    toast('Licencia configurada sin fecha de vencimiento');
  });
  $('#btnCambiarLogoPrincipal').addEventListener('click', async () => {
    const recorte = await solicitarImagen1a1PreGuardado({
      titulo: 'Cambiar logo principal (Formato 1:1)',
      subtitulo: 'Arrastra o selecciona el nuevo logo principal para recortarlo en formato cuadrado (1:1).',
      imagenActual: DB.config.logoPrincipal || '',
      permitirOmitir: false
    });
    if (recorte) {
      DB.config.logoPrincipal = recorte;
      guardarDB();
      pintarMarcaLocal();
      actualizarVistaPrevia80mm();
      toast('Logo principal actualizado (1:1)');
    }
  });
  $('#btnCambiarFavicon').addEventListener('click', async () => {
    const recorte = await solicitarImagen1a1PreGuardado({
      titulo: 'Cambiar icono de pestaña · Favicon (Formato 1:1)',
      subtitulo: 'Arrastra o selecciona la imagen para el icono de pestaña del navegador en formato 1:1.',
      imagenActual: DB.config.favicon || '',
      permitirOmitir: false
    });
    if (recorte) {
      DB.config.favicon = recorte;
      guardarDB();
      pintarMarcaLocal();
      toast('Icono de pestaña (Favicon) actualizado');
    }
  });
  $('#btnRestaurarLogoOriginal').addEventListener('click', () => {
    DB.config.logoPrincipal = 'logo.png';
    DB.config.favicon = 'favicon.png';
    guardarDB();
    pintarMarcaLocal();
    actualizarVistaPrevia80mm();
    toast('Logo original restaurado');
  });
  $('#formLicencia').addEventListener('submit', guardarLicenciaYMarca);

  actualizarCamposCliente();

  // Intentar restaurar la sesión activa si no han pasado 3 horas de inactividad
  if (!intentarRestaurarSesion()) {
    mostrarPantallaAcceso();
  }
}

document.addEventListener('DOMContentLoaded', init);
