/**
 * Asistente local de Manguaré. Funciona sin conexión: responde con reglas, no
 * con un modelo de IA, y por eso no inventa datos médicos. Ante una emergencia
 * siempre dirige a crear la alerta o a los números de ayuda.
 */
import { SUPPORT_CENTERS } from './community';

export type AssistantAction = 'new-alert' | 'community' | 'wall' | 'match' | 'help';

export interface AssistantReply {
  text: string;
  action?: AssistantAction;
}

export const ASSISTANT_SUGGESTIONS = [
  'Tengo una emergencia',
  '¿Cómo vendo mi miel?',
  'No tengo señal',
  '¿Dónde está la posta?',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

export function assistantReply(input: string): AssistantReply {
  const text = normalize(input);

  if (!text) {
    return { text: 'Escríbeme qué necesitas y te guío paso a paso.' };
  }

  if (
    hasAny(text, [
      'emergencia',
      'urgente',
      'auxilio',
      'socorro',
      'sangr',
      'accidente',
      'mordedura',
      'mordio',
      'serpiente',
      'herido',
      'dolor fuerte',
      'no respira',
      'desmay',
      'sos',
    ])
  ) {
    return {
      text:
        'Si hay peligro de vida, pide ayuda a quien tengas cerca y llama o usa la radio de salud ahora. ' +
        'Yo puedo guardar una alerta con tu ubicación: se enviará sola cuando haya señal. ' +
        'No te doy indicaciones médicas porque no soy personal de salud.',
      action: 'new-alert',
    };
  }

  if (hasAny(text, ['posta', 'hospital', 'centro de salud', 'salud cerca', 'donde atienden'])) {
    const lines = SUPPORT_CENTERS.slice(0, 3)
      .map((center) => `• ${center.name} (${center.distance})`)
      .join('\n');
    return {
      text: `Estos son los centros de apoyo de demostración:\n${lines}\nEn Mapa los ves ubicados.`,
      action: 'help',
    };
  }

  if (hasAny(text, ['sin senal', 'no tengo senal', 'sin internet', 'sin conexion', 'offline', 'no hay senal'])) {
    return {
      text:
        'Sin señal no pasa nada: tu alerta queda como Pendiente en el teléfono y se envía sola al volver la conexión. ' +
        'Tus publicaciones y mensajes también se guardan aquí. Para algo urgente, usa el SMS de respaldo o la radio.',
    };
  }

  if (hasAny(text, ['vender', 'vendo', 'publicar', 'producto', 'miel', 'artesania', 'cacao', 'platano', 'precio', 'mercado', 'tienda'])) {
    return {
      text:
        'Para vender: entra a Comunidad → Publicar, pon título, precio y una foto clara. ' +
        'Luego prueba Red → Match para encontrar compradores que busquen lo que ofreces.',
      action: 'community',
    };
  }

  if (hasAny(text, ['comprar', 'compro', 'buscar', 'busco', 'comprador', 'productor', 'match', 'contacto'])) {
    return {
      text: 'En Match ves productores, compradores y voluntarios. Si ambos se interesan, se abre un chat.',
      action: 'match',
    };
  }

  if (hasAny(text, ['foto', 'publicacion', 'muro', 'noticia', 'compartir', 'comentar'])) {
    return {
      text: 'En el Muro puedes compartir una foto o un aviso con tu comunidad, y comentar o dar «me gusta».',
      action: 'wall',
    };
  }

  if (hasAny(text, ['alerta', 'reportar', 'enviar'])) {
    return {
      text: 'Para crear una alerta: Mis alertas → Nueva, o usa el botón SOS en Inicio si es urgente.',
      action: 'new-alert',
    };
  }

  if (hasAny(text, ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'ayuda', 'que puedes'])) {
    return {
      text:
        'Hola, soy el asistente de Manguaré. Puedo ayudarte a crear una alerta, publicar un producto, ' +
        'encontrar compradores o ubicar la posta más cercana.',
    };
  }

  return {
    text:
      'No estoy seguro de haber entendido. Prueba con: «tengo una emergencia», «quiero vender miel», ' +
      '«no tengo señal» o «dónde está la posta».',
  };
}
