import api from './api';

const d = (p) => p.then((r) => r.data);

export function apiError(error, fallback = 'Erro inesperado.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((x) => x.msg).join('; ');
  return fallback;
}

export const modules = {
  get: () => d(api.get('/modules/me')),
  patch: (body) => d(api.patch('/modules/me', body)),
};

export const loansApi = {
  listBorrowers: (includeArchived = false) => d(api.get('/loans/borrowers', { params: { include_archived: includeArchived } })),
  createBorrower: (body) => d(api.post('/loans/borrowers', body)),
  patchBorrower: (id, body) => d(api.patch(`/loans/borrowers/${id}`, body)),
  statement: (id, includeVoided = false) => d(api.get(`/loans/borrowers/${id}/statement`, { params: { include_voided: includeVoided } })),

  listPix: () => d(api.get('/loans/pix-accounts')),
  createPix: (body) => d(api.post('/loans/pix-accounts', body)),
  patchPix: (id, body) => d(api.patch(`/loans/pix-accounts/${id}`, body)),
  setDefaultPix: (id) => d(api.post(`/loans/pix-accounts/${id}/default`)),

  simulate: (body) => d(api.post('/loans/simulate', body)),
  listContracts: (params) => d(api.get('/loans/contracts', { params })),
  createContract: (body) => d(api.post('/loans/contracts', body)),
  contract: (id) => d(api.get(`/loans/contracts/${id}`)),
  fund: (id, body) => d(api.post(`/loans/contracts/${id}/fund`, body)),
  cancel: (id) => d(api.post(`/loans/contracts/${id}/cancel`)),
  void: (id, body) => d(api.post(`/loans/contracts/${id}/void`, body)),
  prepaymentPreview: (id, body) => d(api.post(`/loans/contracts/${id}/prepayment-preview`, body)),

  createReceipt: (body) => d(api.post('/loans/receipts', body)),
  listReceipts: (params) => d(api.get('/loans/receipts', { params })),
  reverseReceipt: (id, reason) => d(api.post(`/loans/receipts/${id}/reverse`, { reason })),

  createAdjustment: (installmentId, body) => d(api.post(`/loans/installments/${installmentId}/adjustments`, body)),
  reverseAdjustment: (id) => d(api.post(`/loans/adjustments/${id}/reverse`)),

  createCharge: (body) => d(api.post('/loans/charges', body)),
  charge: (id) => d(api.get(`/loans/charges/${id}`)),
  markShared: (id) => d(api.post(`/loans/charges/${id}/shared`)),

  dashboard: () => d(api.get('/loans/dashboard')),
  monthly: (month) => d(api.get('/loans/reports/monthly', { params: { month } })),
};
