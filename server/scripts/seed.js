const base = process.env.MANGUARE_URL ?? 'http://localhost:8787';

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

const seeds = [
  {
    id: 'demo-enfermedad-001',
    type: 'enfermedad',
    note: 'Fiebre alta desde ayer y dificultad para respirar en un niño.',
    community: 'Nueva Esperanza',
    deviceName: 'Equipo de demostración',
    consentLocation: true,
    location: {
      lat: -5.9012,
      lng: -76.1043,
      accuracy: 24,
      capturedAt: minutesAgo(95),
    },
    clientCreatedAt: minutesAgo(95),
  },
  {
    id: 'demo-mordedura-002',
    type: 'mordedura',
    note: 'Mordedura de serpiente en el pie derecho. La familia pide apoyo para traslado.',
    community: 'Comunidad Awajún (Amazonas)',
    deviceName: 'Equipo de demostración',
    consentLocation: true,
    location: {
      lat: -4.5721,
      lng: -77.9134,
      accuracy: 38,
      capturedAt: minutesAgo(40),
    },
    clientCreatedAt: minutesAgo(40),
  },
  {
    id: 'demo-parto-003',
    type: 'parto',
    note: 'Trabajo de parto avanzado. No hay partera disponible en la comunidad.',
    community: 'Yurimaguas',
    deviceName: 'Equipo de demostración',
    consentLocation: false,
    clientCreatedAt: minutesAgo(12),
  },
];

async function post(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} → HTTP ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

try {
  for (const seed of seeds) {
    await post('/api/alerts', seed);
    console.log(`Creada (o ya existente): ${seed.type} · ${seed.community}`);
  }
  await post('/api/alerts/demo-enfermedad-001/received');
  console.log('Alerta demo-enfermedad-001 marcada como recibida.');
  console.log('');
  console.log(`Listo. Abre el panel en ${base}/panel`);
} catch (error) {
  console.error('');
  console.error('No se pudieron cargar los datos de demostración.');
  console.error('Inicia el servidor con "npm start" (o "npm run dev") y vuelve a ejecutar.');
  console.error('');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
