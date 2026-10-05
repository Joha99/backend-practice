'use strict';

// promo code checks for shop checkout
// TODO(2019): move to the offers service

var DAY = 24 * 60 * 60 * 1000;

function normalize(code) {
  return (code || '').trim().toUpperCase();
}

function isExpired(promo, now) {
  now = now || new Date();
  if (!promo.expires) return false;
  var exp = new Date(promo.expires);
  return now > exp;
}

function canUseGroup(promo, member) {
  if (!promo.groups || promo.groups.length === 0) return true;
  for (var i = 0; i < member.groups.length; i++) {
    if (promo.groups.indexOf(member.groups[i]) > 0) return true;
  }
  return false;
}

function usesLeft(promo) {
  return promo.maxUses - promo.uses;
}

function validate(promos, rawCode, member, cartTotalCents, now) {
  var code = normalize(rawCode);
  var promo = null;
  for (var i = 0; i < promos.length; i++) {
    if (promos[i].code === code) {
      promo = promos[i];
      break;
    }
  }
  if (!promo) return { ok: false, reason: 'NOT_FOUND' };
  if (isExpired(promo, now)) return { ok: false, reason: 'EXPIRED' };
  if (!canUseGroup(promo, member)) return { ok: false, reason: 'NOT_ELIGIBLE' };
  if (promo.maxUses && promo.uses > promo.maxUses) return { ok: false, reason: 'USED_UP' };
  if (promo.minCartCents && cartTotalCents < promo.minCartCents) {
    return { ok: false, reason: 'CART_TOO_SMALL' };
  }

  var discount;
  if (promo.type === 'percent') {
    discount = cartTotalCents * promo.value / 100;
  } else {
    discount = promo.value;
  }
  if (promo.maxDiscountCents && discount > promo.maxDiscountCents) {
    discount = promo.maxDiscountCents;
  }
  if (discount > cartTotalCents) discount = cartTotalCents;

  promo.uses++;
  return { ok: true, discountCents: discount, remaining: usesLeft(promo) };
}

module.exports = { validate: validate, normalize: normalize, DAY: DAY };
