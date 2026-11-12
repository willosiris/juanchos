# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS sin framework (index.html, estiloswi.css, dinawil.js). Persistencia local en `localStorage` y esquema MySQL/MariaDB en `juanchos_pos.sql` para un backend futuro. La app exporta respaldos en JSON y en SQL compatible con ese esquema.

## Users

- **Administrador**: dueño o encargado. Configura el local, ambientes, mesas, carta, insumos, recetas y usuarios. Ve el historial completo y todos los cierres.
- **Operador**: cajero o mozo que maneja el sistema durante el turno. Toma pedidos, cobra, imprime pre-cuentas y cierra su turno. No puede crear ni eliminar ambientes, platos, insumos ni usuarios.

Usan una tablet o PC en el mostrador, con prisa, a veces de pie y con poca luz al final del día.

## Product Purpose

Punto de venta del restaurante Juancho's: salón con mesas por ambiente, comandera, cobro, inventario con recetas (escandallo) y cierre de caja por turno.

## Operating Context

- El sistema arranca **vacío**: un solo ambiente por defecto ("Salón Principal"), sin mesas, sin carta, sin insumos y sin ventas. Todo se registra a mano.
- Al abrirlo por primera vez se crea el administrador (nombre + PIN). Después, cada persona entra con su usuario y su PIN.
- Métodos de pago: **Efectivo** y **Yape** (Yape solo como registro informativo, con número de operación opcional).
- Comprobantes: Boleta, Factura (requiere RUC) y Ticket interno. Precios con IGV 18 % incluido.

## Capabilities and Constraints

- Privilegios aplicados en la interfaz y en la lógica. En SQL, mediante `roles`, `permisos` y `fn_tiene_permiso`.
- No debe existir menos de un ambiente. No se eliminan mesas ni ambientes con cuentas abiertas.
- Sin backend todavía: la seguridad del PIN es local (hash SHA-256 con sal).

## Product Principles

1. Rapidez en el turno: lo frecuente se hace con un toque y sin animaciones que hagan esperar.
2. Nada inventado: el sistema empieza vacío y cada dato lo carga el administrador.
3. Trazabilidad: cada cobro, anulación, merma y cierre queda registrado con usuario y hora.
4. Privilegios claros: el operador nunca ve lo que no puede tocar.
