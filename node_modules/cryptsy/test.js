var Cryptsy = require('./cryptsy.js');

var cryptsy = new Cryptsy('YOUR-KEY', 'YOUR-SECRET');

cryptsy.api('marketdatav2', null, function (err, data) {
    console.log('marketdatav2', err ? err : data);
});

cryptsy.api('singlemarketdata', { marketid: 26 }, function (err, data) {
    console.log('singlemarketdata', err ? err : data);
});

cryptsy.api('getinfo', null, function (err, data) {
    console.log('getinfo', err ? err : data);
});

cryptsy.api('getmarkets', null, function (err, data) {
    console.log('getmarkets', err ? err : data);
});

cryptsy.api('mytransactions', null, function (err, data) {
    console.log('mytransactions', err ? err : data);
});

cryptsy.api('markettrades', { marketid: 26 }, function (err, data) {
    console.log('markettrades', err ? err : data);
});

cryptsy.api('marketorders', { marketid: 26 }, function (err, data) {
    console.log('marketorders', err ? err : data);
});

cryptsy.api('mytrades', { marketid: 26 }, function (err, data) {
    console.log('mytrades', err ? err : data);
});

cryptsy.api('allmytrades', null, function (err, data) {
    console.log('allmytrades', err ? err : data);
});

cryptsy.api('myorders', { marketid: 26 }, function (err, data) {
    console.log('myorders', err ? err : data);
});

cryptsy.api('allmyorders', null, function (err, data) {
    console.log('allmyorders', err ? err : data);
});

cryptsy.api('createorder', { marketid: 26, ordertype: 'Sell', quantity: 1000, price: 1000 }, function (err, data) {
    console.log('createorder', err ? err : data);
});

cryptsy.api('cancelorder', { orderid: 123456 }, function (err, data) {
    console.log('cancelorder', err ? err : data);
});

cryptsy.api('calculatefees', { ordertype: 'Buy', quantity: 1000, price: '0.005' }, function (err, data) {
    console.log('calculatefees', err ? err : data);
});
