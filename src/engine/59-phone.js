// In-game phone: texts arrive one by one with a buzz; JOBS lists who still owes what.
const CONTACTS = { shorty: 'SHORTY', manu: 'MANU', you: 'YOU' };
class Phone {
  constructor() {
    this.el = $('phone'); this.msgsEl = $('phMsgs'); this.jobsEl = $('phJobs'); this.btn = $('phoneBtn'); this.toast = $('toast');
    this.log = []; this.jobs = []; this.queue = []; this.timer = 0; this.unread = 0; this.tab = 'msgs';
    this.btn.addEventListener('click', () => this.isOpen ? this.close() : this.open(this.tab));
    $('phClose').addEventListener('click', () => this.close());
    document.querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => this.open(b.dataset.ph)));
  }
  get isOpen() { return this.el.classList.contains('show'); }
  open(tab = 'msgs') {
    this.tab = tab; this.el.classList.add('show');
    document.querySelectorAll('[data-ph]').forEach(b => b.classList.toggle('on', b.dataset.ph === tab));
    this.msgsEl.style.display = tab === 'msgs' ? 'flex' : 'none'; this.jobsEl.style.display = tab === 'jobs' ? 'block' : 'none';
    if (tab === 'msgs') { this.unread = 0; this.badge(); this.msgsEl.scrollTop = 1e6; }
  }
  close() { this.el.classList.remove('show'); }
  badge() { this.btn.dataset.unread = this.unread || ''; this.btn.classList.toggle('ring', this.unread > 0); }
  // Queue texts; each arrives after a short "typing" pause. onDone fires after the last one.
  receive(list, vars, onDone) {
    const fill = t => t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    list.forEach((m, i) => this.queue.push({ from: m.from, text: fill(m.text), last: i === list.length - 1 ? onDone : null }));
  }
  push(m, silent) {
    this.log.push({ from: m.from, text: m.text }); if (this.log.length > 60) this.log.shift();
    this.renderMsg(m);
    if (!silent && m.from !== 'you') {
      this.unread++; this.badge();
      this.toast.textContent = `📱 ${CONTACTS[m.from] || m.from}: ${m.text}`; this.toast.classList.add('show');
      clearTimeout(this.toastT); this.toastT = setTimeout(() => this.toast.classList.remove('show'), 3800);
      try { navigator.vibrate?.(120); } catch (_) { }
    }
  }
  renderMsg(m) {
    const b = document.createElement('div'); b.className = 'bubble ' + (m.from === 'you' ? 'me' : 'them');
    if (m.from !== 'you') { const n = document.createElement('b'); n.textContent = CONTACTS[m.from] || m.from; b.appendChild(n); }
    b.appendChild(document.createTextNode(m.text)); this.msgsEl.appendChild(b); this.msgsEl.scrollTop = 1e6;
  }
  setJobs(jobs) {
    this.jobs = jobs;
    this.jobsEl.innerHTML = jobs.length ? '' : '<p class="empty">No jobs right now.</p>';
    for (const j of jobs) {
      const row = document.createElement('div'); row.className = 'job' + (j.done ? ' done' : '');
      row.innerHTML = `<b></b><span></span><i></i>`;
      row.children[0].textContent = `${j.name} · $${j.amount}`; row.children[1].textContent = j.where; row.children[2].textContent = j.status;
      this.jobsEl.appendChild(row);
    }
  }
  load(log) { this.log = []; this.msgsEl.innerHTML = ''; for (const m of (log || [])) if (m && typeof m.text === 'string') this.push({ from: String(m.from), text: m.text }, true); this.unread = 0; this.badge(); }
  update(dt) {
    if (!this.queue.length) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    const m = this.queue.shift(); this.push(m);
    this.timer = m.from === 'you' ? 0.8 : 1.4 + Math.min(2, m.text.length * 0.03);
    if (m.last) m.last();
  }
  clear() { this.queue = []; this.load([]); this.setJobs([]); this.close(); }
}
