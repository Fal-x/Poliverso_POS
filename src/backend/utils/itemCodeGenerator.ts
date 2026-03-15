import type { PrismaClient, TipoOperacionVendible } from '@prisma/client';

type CodeRule = {
  prefix: string;
  digits: number;
};

const MANUAL_CODE_REGEX = /^[A-Z]{3}-\d{3}$/;

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function onlyLetters(value: string) {
  return normalizeLabel(value).replace(/[^A-Z]/g, '');
}

function resolveRule(categoryName: string, subcategoryName: string, tipoOperacion: TipoOperacionVendible): CodeRule {
  const categoryLetters = onlyLetters(categoryName);
  const subcategoryLetters = onlyLetters(subcategoryName);
  const categoryInitial = categoryLetters.charAt(0) || 'X';
  const subcategoryPrefix = (subcategoryLetters.slice(0, 2) || '').padEnd(2, 'X');
  const prefix = `${categoryInitial}${subcategoryPrefix}`;

  // tipoOperacion se conserva en la firma por compatibilidad de llamadas;
  // el código queda gobernado por categoría/subcategoría para ser 100% parametrizable.
  void tipoOperacion;
  return { prefix, digits: 3 };
}

function parseCode(code: string) {
  const [prefix, rawConsecutive] = code.split('-');
  const consecutive = Number.parseInt(rawConsecutive || '', 10);
  return {
    prefix,
    consecutive: Number.isFinite(consecutive) ? consecutive : 0,
    digits: rawConsecutive?.length ?? 0,
  };
}

function buildCode(prefix: string, consecutive: number, digits: number) {
  return `${prefix}-${String(consecutive).padStart(digits, '0')}`;
}

export async function reserveNextItemCode(params: {
  prisma: PrismaClient;
  siteId: string;
  categoryName: string;
  subcategoryName: string;
  tipoOperacion: TipoOperacionVendible;
}) {
  const { prisma, siteId, categoryName, subcategoryName, tipoOperacion } = params;
  const rule = resolveRule(categoryName, subcategoryName, tipoOperacion);

  const [reservedMax, existingCodes] = await Promise.all([
    prisma.codigoReservado.aggregate({
      where: { siteId, prefijo: rule.prefix },
      _max: { consecutivo: true },
    }),
    prisma.itemVendible.findMany({
      where: { siteId, codigo: { startsWith: `${rule.prefix}-` } },
      select: { codigo: true },
    }),
  ]);

  const maxFromItems = existingCodes.reduce((acc, row) => {
    const parsed = parseCode(row.codigo);
    if (parsed.prefix !== rule.prefix || parsed.digits !== rule.digits) return acc;
    return Math.max(acc, parsed.consecutive);
  }, 0);

  const start = Math.max(reservedMax._max.consecutivo ?? 0, maxFromItems) + 1;
  const codigo = buildCode(rule.prefix, start, rule.digits);

  await prisma.codigoReservado.create({
    data: {
      siteId,
      codigo,
      prefijo: rule.prefix,
      consecutivo: start,
    },
  });

  return codigo;
}

export async function validateAndReserveManualCode(params: {
  prisma: PrismaClient;
  siteId: string;
  code: string;
  categoryName: string;
  subcategoryName: string;
  tipoOperacion: TipoOperacionVendible;
  currentItemId?: string;
}) {
  const { prisma, siteId, code, categoryName, subcategoryName, tipoOperacion, currentItemId } = params;
  const cleaned = normalizeLabel(code).replace(/\s/g, '');
  if (!MANUAL_CODE_REGEX.test(cleaned)) {
    throw new Error('Código inválido. Formato esperado: ABC-001');
  }

  const rule = resolveRule(categoryName, subcategoryName, tipoOperacion);
  const parsed = parseCode(cleaned);
  if (parsed.prefix !== rule.prefix || parsed.digits !== rule.digits) {
    throw new Error(`Código no válido para la categoría/subcategoría. Debe usar prefijo ${rule.prefix} y ${rule.digits} dígitos.`);
  }

  const inItems = await prisma.itemVendible.findFirst({
    where: { siteId, codigo: cleaned },
    select: { id: true },
  });
  if (inItems && inItems.id !== currentItemId) {
    throw new Error('El código ya existe en un ítem vendible.');
  }

  const reserved = await prisma.codigoReservado.findUnique({
    where: { siteId_codigo: { siteId, codigo: cleaned } },
  });
  if (reserved) {
    if (!currentItemId) throw new Error('El código ya fue utilizado históricamente y no se puede reutilizar.');
    const current = await prisma.itemVendible.findUnique({ where: { id: currentItemId }, select: { codigo: true } });
    if (!current || current.codigo !== cleaned) {
      throw new Error('El código ya fue utilizado históricamente y no se puede reutilizar.');
    }
    return cleaned;
  }

  await prisma.codigoReservado.create({
    data: {
      siteId,
      codigo: cleaned,
      prefijo: parsed.prefix,
      consecutivo: parsed.consecutive,
    },
  });
  return cleaned;
}
