// Registra un movimiento auditable (edición/eliminación con justificación).
// `db` puede ser el pool o una conexión de transacción — ambos exponen .query.
async function registrarBitacora(db, { usuario_id, usuario_nombre, accion, tabla, registro_id, justificacion, datos_antes, datos_despues }) {
  await db.query(
    `INSERT INTO bitacora
     (usuario_id, usuario_nombre, accion, tabla, registro_id, justificacion, datos_antes, datos_despues)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      usuario_id || null,
      usuario_nombre || null,
      accion,
      tabla,
      registro_id || null,
      justificacion,
      datos_antes ? JSON.stringify(datos_antes) : null,
      datos_despues ? JSON.stringify(datos_despues) : null,
    ]
  );
}

module.exports = { registrarBitacora };
