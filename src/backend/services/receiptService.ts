import { Prisma, Sale } from '@prisma/client';

export type ReceiptContext = {
  sale: Sale & {
    site: { name: string; address: string | null; city: string | null; phone: string | null; organization: { legalName: string; nit: string; phone: string | null; address: string | null; city: string | null } };
    customer: { fullName: string; documentType: string; documentNumber: string; phone: string | null };
    createdBy: { fullName: string };
    payments: Array<{ method: string; amount: Prisma.Decimal }>;
    lines: Array<{
      quantity: number;
      unitPrice: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      product?: { name: string; sku: string | null } | null;
      card?: { uid: string } | null;
      category: string;
      metadata?: Prisma.JsonValue | null;
    }>;
  };
};

const formatMoney = (value: Prisma.Decimal | number) => {
  const num = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
};

const pad = (text: string, len: number) => text.padEnd(len, ' ').slice(0, len);
const maskUid = (uid: string) => (uid.length <= 4 ? uid : `****${uid.slice(-4)}`);
const asObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};
const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const paymentLabel = (method: string) => {
  const map: Record<string, string> = {
    CASH: 'Efectivo',
    TRANSFER: 'Transferencia',
    TRANSFER_ACCOUNT_1: 'Transferencia Cta 1',
    TRANSFER_ACCOUNT_2: 'Transferencia Cta 2',
    NEQUI: 'Nequi',
    QR: 'QR',
    CARD: 'Tarjeta',
    CREDIT_CARD: 'Tarjeta crédito',
    CREDIT: 'Crédito',
    MIXED: 'Mixto',
  };
  return map[method] ?? method;
};

export function buildReceiptTxt(ctx: ReceiptContext) {
  const { sale } = ctx;
  const org = sale.site.organization;
  const site = sale.site;
  const customer = sale.customer;

  const receiptNumber = sale.receiptNumber || `RC-${sale.createdAt.getTime().toString().slice(-8)}`;
  const created = sale.createdAt;
  const date = created.toLocaleDateString('es-CO');
  const hour = created.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  const receiptId = sale.id.slice(0, 8).toUpperCase();
  const terminal = sale.terminalId?.slice(0, 8).toUpperCase() ?? 'N/D';
  const shift = sale.shiftId?.slice(0, 8).toUpperCase() ?? 'N/D';
  const cashSession = sale.cashSessionId?.slice(0, 8).toUpperCase() ?? 'N/D';

  const header = [
    'POLIVERSO',
    org.legalName || 'POLIVERSO S.A.S',
    `NIT: ${org.nit}`,
    `${site.address ?? org.address ?? ''}`.trim(),
    `${site.city ?? org.city ?? ''}`.trim(),
    `Tel: ${(site.phone ?? org.phone ?? 'N/D').trim()}`,
    'Correo: contacto@poliverso.co',
    'Régimen tributario: No informado',
    'Resolución DIAN: No informada',
    '----------------------------------------',
    `Factura No: ${receiptNumber}`,
    `Fecha: ${date}  Hora: ${hour}`,
    `Caja: ${cashSession}`,
    `Turno: ${shift}`,
    `Cajero: ${sale.createdBy.fullName}`,
    `Terminal: ${terminal}`,
    '----------------------------------------',
  ].filter(Boolean);

  const isGenericCustomer = !customer?.documentNumber || customer.fullName.trim().toLowerCase() === 'publico general';
  const customerBlock = [
    'DATOS DEL CLIENTE',
    isGenericCustomer ? 'Cliente: Público General' : `Nombre: ${customer.fullName}`,
    isGenericCustomer ? null : `Documento: ${customer.documentType} ${customer.documentNumber}`,
    customer.phone ? `Teléfono: ${customer.phone}` : 'Teléfono: N/D',
    `Email: ${'N/D'}`,
    '----------------------------------------',
  ].filter(Boolean);

  const detailHeader = [
    'DETALLE DE LA VENTA',
    pad('Cant', 5) + pad('Código', 10) + pad('Descripción', 16) + pad('P.Unit', 11) + pad('Desc', 8) + pad('Total', 10),
    '----------------------------------------',
  ];

  let discountTotal = 0;
  let rechargeBase = 0;
  let promoAdditional = 0;
  let promoCode: string | null = null;
  let rechargeUid: string | null = null;
  let rechargePoints = 0;
  const prizeLines: Array<{ desc: string; points: number; qty: number }> = [];

  const detailLines = sale.lines.map((l) => {
    const metadata = asObject(l.metadata);
    const lineDiscount = asNumber(metadata?.discountAmount);
    discountTotal += lineDiscount;
    if (l.category === 'RECHARGE') {
      rechargeBase += Number(l.lineTotal);
      promoAdditional += asNumber(metadata?.promoAmount);
      if (!promoCode && typeof metadata?.promoCode === 'string' && metadata.promoCode.trim()) {
        promoCode = metadata.promoCode.trim();
      }
      rechargePoints += asNumber(metadata?.points);
      if (l.card?.uid) rechargeUid = l.card.uid;
    }
    if (l.category === 'PRIZE') {
      prizeLines.push({
        desc: l.product?.name ?? 'Premio',
        points: asNumber(metadata?.pointsTotal),
        qty: l.quantity,
      });
    }
    const code = l.product?.sku ?? (l.category === 'RECHARGE' ? (promoCode ? `RECA/${promoCode}` : 'RECA-BASE') : l.category);
    const name = l.product?.name ?? l.category;
    return [
      pad(String(l.quantity), 5),
      pad(code, 10),
      pad(name, 16),
      pad(formatMoney(l.unitPrice), 11),
      pad(lineDiscount > 0 ? formatMoney(lineDiscount) : '$0', 8),
      pad(formatMoney(l.lineTotal), 10),
    ].join('');
  });

  const bonus = Number(sale.bonusTotal ?? new Prisma.Decimal(0));
  const discounts = discountTotal > 0 ? discountTotal : 0;
  const totals = [
    '----------------------------------------',
    'TOTALES FINANCIEROS',
    `Subtotal: ${formatMoney(sale.subtotal)}`,
    `Descuentos: -${formatMoney(discounts)}`,
    `Total a pagar: ${formatMoney(sale.total)}`,
  ];

  const payments = [
    ...sale.payments.map((p) => `- ${paymentLabel(p.method)}: ${formatMoney(p.amount)}`),
    `Total pagado: ${formatMoney(sale.totalPaid)}`,
    `Cambio: ${formatMoney(Math.max(0, Number(sale.totalPaid) - Number(sale.total)))}`,
  ];

  const promoBlock = promoCode
    ? [
        '----------------------------------------',
        'PROMOCIONES',
        `Promoción aplicada: ${promoCode}`,
        `Descuento total aplicado: ${formatMoney(discounts)}`,
      ]
    : [];

  const rechargeAdditionalBlock = promoAdditional > 0
    ? [
        '----------------------------------------',
        'RECARGA ADICIONAL',
        `Recarga base: ${formatMoney(rechargeBase)}`,
        `Saldo adicional promocional: ${formatMoney(promoAdditional)}`,
        'Nota: El saldo adicional no suma al ingreso contable.',
      ]
    : [];

  const cardBlock = rechargeUid
    ? [
        '----------------------------------------',
        'INFORMACIÓN DE TARJETA',
        `UID: ${maskUid(rechargeUid)}`,
        'Saldo anterior: N/D',
        `Saldo recargado: ${formatMoney(rechargeBase)}`,
        'Saldo actual: N/D',
        `Puntos acumulados: +${rechargePoints || sale.pointsEarned}`,
        'Total puntos actuales: N/D',
      ]
    : [];

  const prizeBlock = prizeLines.length > 0
    ? [
        '----------------------------------------',
        'PREMIOS',
        ...prizeLines.map((prize) => `Premio: ${prize.desc} x${prize.qty} | Puntos usados: ${prize.points || 0}`),
      ]
    : [];

  const footer = [
    '----------------------------------------',
    `Factura electrónica: ${sale.requiresElectronicInvoice ? 'SI' : 'NO'}`,
    sale.electronicInvoiceCode ? `Cod. factura externa: ${sale.electronicInvoiceCode}` : null,
    `Código verificación: PV-${receiptId}`,
    'Gracias por vivir la experiencia POLIVERSO',
    'Conserve este comprobante',
    'Política: no devoluciones en servicios consumidos.',
  ].filter(Boolean);

  return [
    ...header,
    ...customerBlock,
    ...detailHeader,
    ...detailLines,
    ...promoBlock,
    ...rechargeAdditionalBlock,
    ...totals,
    ...payments,
    ...cardBlock,
    ...prizeBlock,
    ...footer,
  ].join('\n');
}
