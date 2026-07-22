<?php
// Espejo de backend/src/routes/bitacora.js — todo admin-gated.

const BITACORA_TABLAS = ['canales', 'entradas', 'salidas', 'etiquetas', 'movimientos_inventario'];
const BITACORA_ACCIONES = ['crear', 'editar', 'eliminar', 'autorizar', 'rechazar'];

$router->get('/tablas', function () {
    requireAdmin(requireAuth());
    jsonResponse(BITACORA_TABLAS);
});

$router->get('/acciones', function () {
    requireAdmin(requireAuth());
    jsonResponse(BITACORA_ACCIONES);
});

$router->get('/', function () {
    requireAdmin(requireAuth());
    $fi = queryParam('fecha_inicio');
    $ff = queryParam('fecha_fin');
    $tabla = queryParam('tabla');
    $accion = queryParam('accion');
    $usuario = queryParam('usuario');

    $sql = 'SELECT * FROM bitacora WHERE 1=1';
    $p = [];
    if ($fi !== null) { $sql .= ' AND DATE(fecha) >= ?'; $p[] = $fi; }
    if ($ff !== null) { $sql .= ' AND DATE(fecha) <= ?'; $p[] = $ff; }
    if ($tabla !== null) { $sql .= ' AND tabla = ?'; $p[] = $tabla; }
    if ($accion !== null) { $sql .= ' AND accion = ?'; $p[] = $accion; }
    if ($usuario !== null) { $sql .= ' AND usuario_nombre LIKE ?'; $p[] = "%{$usuario}%"; }
    $sql .= ' ORDER BY fecha DESC, id DESC LIMIT 500';

    try {
        $stmt = db()->prepare($sql);
        $stmt->execute($p);
        $rows = $stmt->fetchAll();
        // PDO regresa las columnas JSON como string (a diferencia de mysql2 en
        // Node, que las autoparsea) — hay que decodificarlas explícitamente
        // para que el frontend reciba objetos, no un string doblemente serializado.
        foreach ($rows as &$row) {
            $row['datos_antes'] = $row['datos_antes'] !== null ? json_decode($row['datos_antes'], true) : null;
            $row['datos_despues'] = $row['datos_despues'] !== null ? json_decode($row['datos_despues'], true) : null;
        }
        unset($row);
        jsonResponse($rows);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        jsonError(500, 'No se pudo consultar la bitácora');
    }
});
