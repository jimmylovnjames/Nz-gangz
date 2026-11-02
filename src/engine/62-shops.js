// Shops on the real map: walk up to a dairy, takeaway, bakery, supermarket, pharmacy, barber or gym
// (from the mapped shop signs) and TALK. Food heals, energy drinks let you run flat out, the gym makes
// your punches hit harder, a fresh cut earns a bit of respect.
const SHOP_KINDS = [
  ['gym', /\b(GYM|FITNESS)\b/], ['barber', /BARBER/], ['pharmacy', /PHARMACY|CHEMIST/], ['supermarket', /SUPERMARKET|PAK'N'PAY|NU WORLD|GROCER/],
  ['bakery', /BAKERY|BAKEHOUSE|CAFE|HOT BREAD/], ['takeaway', /TAKEAWAY|FISH|CHIPS|CHICKEN|BURGER|PIZZA|KEBAB|SUB STATION|NOODLE|FISHERIES|BBQ|RESTAURANT/],
  ['dairy', /DAIRY|SUPERETTE|CONVENIENCE|ON THE GO|FRUIT/],
];
const SHOP_MENUS = {
  dairy: [{ name: "Mince 'n' cheese pie", price: 6, hp: 35 }, { name: 'Energy drink', price: 5, energy: 60, boost: 45 }, { name: "Chips 'n' dip", price: 4, hp: 15 }, { name: 'Ice block', price: 2, hp: 5 }],
  takeaway: [{ name: "Fish 'n' chips", price: 14, hp: 70 }, { name: "Chicken 'n' chips", price: 12, hp: 60 }, { name: 'Scoop of hot chips', price: 5, hp: 25 }, { name: 'Can of fizzy', price: 3, energy: 25 }],
  bakery: [{ name: "Steak 'n' cheese pie", price: 7, hp: 40 }, { name: 'Custard square', price: 5, hp: 15 }, { name: 'Flat white', price: 6, energy: 40, boost: 20 }],
  supermarket: [{ name: 'Big shop for the whānau', price: 45, hp: 100, rep: 5 }, { name: 'Bread and spread', price: 6, hp: 20 }, { name: 'Sports drink', price: 4, energy: 50, boost: 30 }],
  pharmacy: [{ name: 'First-aid kit', price: 20, hp: 50 }, { name: 'Painkillers', price: 8, hp: 20 }],
  barber: [{ name: 'Fresh fade', price: 25, rep: 5 }, { name: 'Line-up', price: 15, rep: 2 }],
  gym: [{ name: 'Boxing session', price: 0, train: true }],
};
const SHOP_TITLES = { dairy: 'Dairy', takeaway: 'Takeaways', bakery: 'Bakery', supermarket: 'Supermarket', pharmacy: 'Pharmacy', barber: 'Barber', gym: 'Gym' };
const TRAIN_COST = [30, 60, 120];

class Shops {
  constructor(city) {
    this.list = [];
    for (const s of city.signs) {
      const kind = SHOP_KINDS.find(([, re]) => re.test(s.text))?.[0]; if (!kind) continue;
      if (this.list.some(o => o.kind === kind && Math.hypot(o.x - s.pos.x, o.z - s.pos.z) < 6)) continue;
      this.list.push({ kind, name: s.text, x: s.pos.x, z: s.pos.z });
    }
    this.panel = $('shopPanel');
  }
  nearest(p, r = 6) { let best = null, bd = r; for (const s of this.list) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; best = s; } } return best; }
  get isOpen() { return this.panel.style.display === 'flex'; }
  // api: { cash(), spend(n), heal(n), energy(n, boost), rep(n), strength(), train() , close() }
  open(shop, api) {
    this.shop = shop; this.api = api;
    $('shopTitle').textContent = shop.name; $('shopSub').textContent = SHOP_TITLES[shop.kind];
    this.render(); this.panel.style.display = 'flex';
  }
  render() {
    const box = $('shopItems'), api = this.api; box.innerHTML = '';
    $('shopCash').textContent = `You have $${api.cash()}`;
    for (const it of SHOP_MENUS[this.shop.kind]) {
      const lvl = api.strength(), price = it.train ? TRAIN_COST[lvl] : it.price;
      const b = document.createElement('button');
      const fx = it.train ? (lvl >= 3 ? 'Fully trained' : `Punch power ${lvl} → ${lvl + 1}`) : [it.hp && `+${it.hp} health`, it.energy && `+${it.energy} energy`, it.boost && `${it.boost}s full sprint`, it.rep && `+${it.rep} rep`].filter(Boolean).join(' · ');
      b.innerHTML = `<b></b><span></span><i></i>`; b.children[0].textContent = it.name; b.children[1].textContent = price == null ? '' : `$${price}`; b.children[2].textContent = fx;
      b.disabled = (it.train && lvl >= 3) || api.cash() < (price || 0);
      b.onclick = () => this.buy(it, price);
      box.appendChild(b);
    }
  }
  buy(it, price) {
    const api = this.api; if (api.cash() < price) return;
    api.spend(price); SFX.play('cash');
    if (it.hp) api.heal(it.hp); if (it.energy) api.energy(it.energy, it.boost || 0); if (it.rep) api.rep(it.rep); if (it.train) api.train();
    api.say(it.train ? `Good session. Punch power ${api.strength()}.` : `${it.name}: sweet as.`);
    this.render();
  }
  close() { this.panel.style.display = 'none'; this.api?.close(); }
}
