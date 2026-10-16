export const MIN_CREDIT_QUANTITY = 10;

export const checkoutPrice = (subtotalCop: number) => {
  const safeSubtotal = Math.max(0, Math.trunc(subtotalCop));
  const totalCop = Math.round((safeSubtotal * 8) / 7);
  return {
    subtotalCop: safeSubtotal,
    feeCop: totalCop - safeSubtotal,
    totalCop,
  };
};
