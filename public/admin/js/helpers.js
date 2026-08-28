(function () {
  function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d + (String(d).indexOf('T') === -1 ? 'T00:00:00Z' : ''));
    return dt.toISOString().split('T')[0];
  }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }
  function inr(n) {
    if (n === null || n === undefined) return '—';
    const num = Number(n);
    if (isNaN(num)) return '—';
    return '\u20B9' + num.toLocaleString('en-IN');
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function statusLabel(s) {
    const map = {
      pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked in',
      checked_out: 'Checked out', cancelled: 'Cancelled', completed: 'Completed',
      no_show: 'No show',
    };
    return map[s] || s || '';
  }
  function fmtDateTime(d) {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  window.AdminUI = { fmtDate: fmtDate, todayStr: todayStr, inr: inr, esc: esc, statusLabel: statusLabel, fmtDateTime: fmtDateTime };
})();