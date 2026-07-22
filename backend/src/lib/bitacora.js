let memBitacora = [];
let bitacoraSeq = 1;

// Registra un movimiento auditable (edición/eliminación con justificación).
// `db` puede ser el pool o una conexión de transacción — ambos exponen .query.
// Si no hay base de datos disponible (desarrollo sin MySQL), cae a un
// arreglo en memoria para que la Bitácora siga siendo consultable.
async function registrarBitacora(db, { usuario_id, usuario_nombre, accion, tabla, registro_id, justificacion, datos_antes, datos_despues }) {
  try {
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
  } catch {
    memBitacora.unshift({
      id: bitacoraSeq++,
      usuario_id: usuario_id || null,
      usuario_nombre: usuario_nombre || null,
      accion,
      tabla,
      registro_id: registro_id || null,
      justificacion,
      datos_antes: datos_antes || null,
      datos_despues: datos_despues || null,
      fecha: new Date().toISOString(),
    });
  }
}

module.exports = { registrarBitacora, getMemBitacora: () => memBitacora };
