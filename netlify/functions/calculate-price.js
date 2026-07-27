var ROOM_PRICES = {
  'Romantic Getaway': 2500,
  'Family Vacation': 6000,
  'Work From Mountains': 2000,
  'Adventure Trek': 3000,
  'Solo Retreat': 2000,
  'Friends Trip': 3000,
  'Wellness Escape': 4500
};

var ADDON_PRICES = {
  bonfire: 500,
  trek: 1500,
  breakfast: 350,
  pickup: 2500,
  photo: 2000,
  laundry: 300,
  cab: 800
};

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  var body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  var roomId = body.roomId;
  var checkIn = body.checkIn;
  var checkOut = body.checkOut;
  var addons = body.addons || {};
  var rooms = typeof body.rooms === 'number' ? Math.max(1, Math.floor(body.rooms)) : 1;

  if (!roomId || !ROOM_PRICES[roomId]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown room ID' }) };
  }

  if (!checkIn || !checkOut) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Check-in and check-out dates are required' }) };
  }

  var checkInDate = new Date(checkIn);
  var checkOutDate = new Date(checkOut);

  if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid date format' }) };
  }

  if (checkOutDate <= checkInDate) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Check-out must be after check-in' }) };
  }

  var nights = Math.max(1, Math.round((checkOutDate - checkInDate) / 86400000));

  for (var id in addons) {
    if (addons[id] && !ADDON_PRICES[id]) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unknown addon: ' + id }) };
    }
  }

  var baseRate = ROOM_PRICES[roomId];
  var roomTotal = nights * rooms * baseRate;

  var addonTotal = 0;
  for (var id in addons) {
    if (addons[id]) {
      addonTotal += ADDON_PRICES[id];
    }
  }

  var tax = Math.round(roomTotal * 0.12);
  var discount = nights >= 3 ? Math.round(roomTotal * 0.08) : 0;

  var weekendSurcharge = 0;
  var day = checkInDate.getDay();
  if (day === 5 || day === 6) {
    weekendSurcharge = Math.round(roomTotal * 0.1);
  }

  var total = Math.max(0, roomTotal + tax + addonTotal + weekendSurcharge - discount);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify({
      roomTotal: roomTotal,
      addonTotal: addonTotal,
      tax: tax,
      discount: discount,
      weekendSurcharge: weekendSurcharge,
      total: total,
      nights: nights,
      baseRate: baseRate
    })
  };
};
