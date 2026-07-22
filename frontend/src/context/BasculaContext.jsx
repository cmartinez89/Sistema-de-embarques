import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { basculaDisponible, cargarConfig, extraerPeso, guardarConfig } from '../lib/bascula';

const BasculaContext = createContext(null);

export function BasculaProvider({ children }) {
  const [config, setConfig] = useState(() => cargarConfig());
  const [conectada, setConectada] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [peso, setPeso] = useState(null);
  const [log, setLog] = useState([]);
  const [error, setError] = useState(null);

  const portRef = useRef(null);
  const readerRef = useRef(null);
  const streamClosedRef = useRef(null);
  const leyendoRef = useRef(false);

  function agregarLog(linea) {
    setLog((prev) => [...prev.slice(-49), linea]);
  }

  function actualizarConfig(nuevaConfig) {
    setConfig(nuevaConfig);
    guardarConfig(nuevaConfig);
  }

  async function cicloLectura(patron) {
    const textDecoder = new TextDecoderStream();
    streamClosedRef.current = portRef.current.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;
    leyendoRef.current = true;
    let buffer = '';
    try {
      while (leyendoRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        buffer += value;
        const lineas = buffer.split(/[\r\n]+/);
        buffer = lineas.pop() ?? '';
        for (const linea of lineas) {
          if (!linea.trim()) continue;
          agregarLog(linea);
          const valor = extraerPeso(linea, patron);
          if (valor !== null) setPeso(valor);
        }
      }
    } catch {
      setError('Se perdió la conexión con la báscula');
      setConectada(false);
    } finally {
      try { reader.releaseLock(); } catch { /* ya liberado */ }
      if (streamClosedRef.current) await streamClosedRef.current.catch(() => {});
    }
  }

  const conectar = useCallback(async (configActual) => {
    const cfg = configActual || config;
    setError(null);
    if (!basculaDisponible()) {
      setError('Este navegador no soporta acceso a puerto serial — usa Chrome o Edge en esta máquina.');
      return;
    }
    setConectando(true);
    try {
      const port = await navigator.serial.requestPort();
      await port.open({
        baudRate: Number(cfg.baudRate),
        dataBits: Number(cfg.dataBits),
        stopBits: Number(cfg.stopBits),
        parity: cfg.parity,
      });
      portRef.current = port;
      setConectada(true);
      cicloLectura(cfg.patron);
    } catch (err) {
      if (err.name !== 'NotFoundError') {
        setError(err.message || 'No se pudo conectar con la báscula');
      }
    } finally {
      setConectando(false);
    }
  }, [config]);

  const desconectar = useCallback(async () => {
    leyendoRef.current = false;
    try { await readerRef.current?.cancel(); } catch { /* ya cerrado */ }
    try { await portRef.current?.close(); } catch { /* ya cerrado */ }
    portRef.current = null;
    readerRef.current = null;
    setConectada(false);
    setPeso(null);
  }, []);

  return (
    <BasculaContext.Provider
      value={{
        config,
        actualizarConfig,
        conectada,
        conectando,
        peso,
        log,
        error,
        conectar,
        desconectar,
        disponible: basculaDisponible(),
      }}
    >
      {children}
    </BasculaContext.Provider>
  );
}

export function useBascula() {
  const ctx = useContext(BasculaContext);
  if (!ctx) throw new Error('useBascula debe usarse dentro de BasculaProvider');
  return ctx;
}
