import { Prisma, Sale } from '@prisma/client';

export type ReceiptContext = {
  sale: Sale & {
    site: { name: string; address: string | null; city: string | null; phone: string | null; organization: { legalName: string; nit: string; phone: string | null; address: string | null; city: string | null } };
    customer: { fullName: string; documentType: string; documentNumber: string; phone: string | null };
    createdBy: { fullName: string };
    payments: Array<{ method: string; amount: Prisma.Decimal }>;
    lines: Array<{ quantity: number; unitPrice: Prisma.Decimal; lineTotal: Prisma.Decimal; product?: { name: string } | null; category: string }>;
  };
};

const formatMoney = (value: Prisma.Decimal | number) => {
  const num = typeof value === 'number' ? value : Number(value);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num);
};

const pad = (text: string, len: number) => text.padEnd(len, ' ').slice(0, len);

export function buildReceiptTxt(ctx: ReceiptContext) {
  const { sale } = ctx;
  const org = sale.site.organization;
  const site = sale.site;
  const customer = sale.customer;

  const receiptNumber = sale.receiptNumber || `RC-${sale.createdAt.getTime().toString().slice(-8)}`;

  const header = [
    'POLIVERSE',
    org.legalName,
    `NIT: ${org.nit}`,
    `${site.address ?? org.address ?? ''}`.trim(),
    `${site.city ?? org.city ?? ''}`.trim(),
    `Tel: ${site.phone ?? org.phone ?? ''}`.trim(),
    '----------------------------------------',
    `Fecha: ${sale.createdAt.toLocaleString('es-CO')}`,
    `Recibo: ${receiptNumber}`,
    `Caja/Turno: ${sale.cashSessionId} / ${sale.shiftId}`,
    `Vendedor: ${sale.createdBy.fullName}`,
    '----------------------------------------',
  ].filter(Boolean);

  const customerBlock = [
    'CLIENTE',
    `Nombre: ${customer.fullName}`,
    `Documento: ${customer.documentType} ${customer.documentNumber}`,
    customer.phone ? `Tel: ${customer.phone}` : null,
    '----------------------------------------',
  ].filter(Boolean);

  const detailHeader = [
    pad('ITEM', 20) + pad('CANT', 6) + pad('VAL', 10) + pad('SUB', 10),
    '----------------------------------------',
  ];

  const detailLines = sale.lines.map((l) => {
    const name = l.product?.name ?? l.category;
    return [
      pad(name, 20),
      pad(String(l.quantity), 6),
      pad(formatMoney(l.unitPrice), 10),
      pad(formatMoney(l.lineTotal), 10),
    ].join('');
  });

  const bonus = sale.bonusTotal ?? new Prisma.Decimal(0);
  const totals = [
    '----------------------------------------',
    `Subtotal: ${formatMoney(sale.subtotal)}`,
    `Bonos: ${formatMoney(bonus)}`,
    `Total: ${formatMoney(sale.total)}`,
    `Pagado: ${formatMoney(sale.totalPaid)}`,
    `Saldo pendiente: ${formatMoney(sale.balanceDue)}`,
    `Puntos generados: ${sale.pointsEarned}`,
  ];

  const payments = [
    '----------------------------------------',
    'MEDIOS DE PAGO',
    ...sale.payments.map((p) => `- ${p.method}: ${formatMoney(p.amount)}`),
  ];

  const footer = [
    '----------------------------------------',
    `Factura electrónica solicitada: ${sale.requiresElectronicInvoice ? 'SI' : 'NO'}`,
    sale.electronicInvoiceCode ? `Cod. factura externa: ${sale.electronicInvoiceCode}` : null,
    'Documento no válido como factura DIAN.',
    'Gracias por su visita.',
  ].filter(Boolean);

  return [...header, ...customerBlock, ...detailHeader, ...detailLines, ...totals, ...payments, ...footer].join('\n');
}
